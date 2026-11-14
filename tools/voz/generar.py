"""Genera la voz de Nebula (voz natural, sin efectos robóticos).

- Español latino: Piper TTS (MIT) con la voz es_MX "claude" (alta calidad, Apache 2.0), fonética es-419 (seseo, sin "z" española).
- Inglés americano: Kokoro-82M (Apache 2.0) con la voz "af_heart", vía sherpa-onnx (Apache 2.0).

Modelos (se descargan de los releases de GitHub de sherpa-onnx, carpeta "tts-models"):
  vits-piper-es_MX-claude-high.tar.bz2 y kokoro-multi-lang-v1_0.tar.bz2

Uso:
  pip install piper-tts sherpa-onnx soundfile
  node tools/voz/textos.mjs > textos.json
  python tools/voz/generar.py textos.json --piper venv/bin/piper \
      --es modelos/vits-piper-es_MX-claude-high/es_MX-claude-high.onnx --kokoro modelos/kokoro-multi-lang-v1_0
  python tools/voz/verificar.py  # opcional: transcribe cada audio con Whisper y compara con el texto
Salida: assets/voz/<idioma>/<hash>.mp3 y assets/voz/<idioma>/indice.json ({texto: archivo}).
"""
import argparse, hashlib, json, os, re, subprocess, tempfile

p = argparse.ArgumentParser()
p.add_argument('textos')
p.add_argument('--piper', required=True); p.add_argument('--es', required=True)
p.add_argument('--kokoro', required=True, help='carpeta del modelo kokoro-multi-lang-v1_0')
p.add_argument('--voz-en', type=int, default=3, help='3 = af_heart')
p.add_argument('--salida', default='assets/voz')
p.add_argument('--largo-es', default='1.05', help='>1 = más lento')
p.add_argument('--ruido-es', default='0.4')
p.add_argument('--todo', action='store_true', help='regenerar aunque el archivo ya exista')
a = p.parse_args()

FILTRO = 'highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11'

def para_hablar(texto, idioma):
    """Texto adaptado a la pronunciación (no cambia la clave del índice)."""
    es = idioma == 'es'
    t = texto.replace('×', ' por ' if es else ' times ').replace('…', '.')
    t = t.replace('CO₂', 'dióxido de carbono' if es else 'carbon dioxide')
    t = t.replace('%', ' por ciento' if es else ' percent').replace('O₂', 'oxígeno' if es else 'oxygen')
    t = t.replace('ISRU', 'I S R U').replace('ISS', 'I S S').replace('MOXIE', 'Moxie')
    t = re.sub(r'(\d)\s*kg\b', r'\1 kilos' if es else r'\1 kilograms', t).replace(' kg', ' kilos' if es else ' kilograms')
    t = re.sub(r'(\d)\s*mSv\b', r'\1 milisieverts', t).replace('kWh', 'kilovatios hora' if es else 'kilowatt hours')
    t = re.sub(r'(\d),(\d)', r'\1 coma \2' if es else r'\1.\2', t)
    return t

# ── Inglés: Kokoro solo pronuncia palabras de su diccionario; el resto lo saltaría. ──
UNIDADES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
DECENAS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()

def numero_en(n):
    if n < 20: return UNIDADES[n]
    if n < 100: return DECENAS[n // 10 - 2] + ('' if n % 10 == 0 else ' ' + UNIDADES[n % 10])
    if n < 1000: return UNIDADES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + numero_en(n % 100))
    return numero_en(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + numero_en(n % 1000))

def numeros_en(t):
    t = re.sub(r'(\d+)\.(\d+)', lambda m: numero_en(int(m[1])) + ' point ' + ' '.join(UNIDADES[int(c)] for c in m[2]), t)
    return re.sub(r'\d+', lambda m: numero_en(int(m[0])), t)

def lexico_ampliado(original, textos_en):
    """Copia del diccionario + palabras flexionadas que faltan (makes = make + s, reduced = reduce + t...)."""
    lex = {}
    for linea in open(original, encoding='utf-8'):
        w, _, ph = linea.rstrip('\n').partition(' ')
        lex.setdefault(w, ph)
    SORDAS, SIBILANTES = set('ptkfθ'), set('szʃʒʧʤ')
    extra = {}
    for texto in textos_en:
        for w in re.findall(r"[A-Za-z']+", numeros_en(para_hablar(texto, 'en'))):
            w = w.lower()
            if w in lex or w in extra: continue
            for fin, base_de in (("'s", lambda x: x[:-2]), ('ies', lambda x: x[:-3] + 'y'), ('ied', lambda x: x[:-3] + 'y'), ('es', lambda x: x[:-2]), ('s', lambda x: x[:-1]), ('ed', lambda x: x[:-2]), ('d', lambda x: x[:-1])):
                b = base_de(w) if w.endswith(fin) else None
                if not b or b not in lex: continue
                ult = lex[b].split()[-1]
                if fin in ('ed', 'd', 'ied'):
                    extra[w] = lex[b] + (' ᵻ d' if ult in 'td' else ' t' if ult in SORDAS else ' d')
                else:
                    extra[w] = lex[b] + (' ᵻ z' if ult in SIBILANTES else ' s' if ult in SORDAS else ' z')
                break
            else:
                print('AVISO: sin pronunciación en inglés para', w)
    salida = os.path.join(tempfile.mkdtemp(), 'lexico.txt')
    with open(salida, 'w', encoding='utf-8') as f:
        f.writelines(f'{w} {ph}\n' for w, ph in {**lex, **extra}.items())
    return salida

kokoro = None
def sintetizar_en(texto, wav):
    global kokoro
    import sherpa_onnx, soundfile as sf
    texto = numeros_en(texto)
    if kokoro is None:
        d = a.kokoro
        lexico = lexico_ampliado(f'{d}/lexicon-us-en.txt', textos.get('en', []))
        kokoro = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f'{d}/model.onnx', voices=f'{d}/voices.bin', tokens=f'{d}/tokens.txt',
                                                           data_dir=f'{d}/espeak-ng-data', dict_dir=f'{d}/dict', lexicon=lexico),
            num_threads=4)))
    audio = kokoro.generate(texto, sid=a.voz_en, speed=1.0)
    sf.write(wav, audio.samples, audio.sample_rate)

def sintetizar_es(texto, wav):
    subprocess.run([a.piper, '-m', a.es, '--length-scale', a.largo_es, '--noise-scale', a.ruido_es, '--noise-w-scale', '0.5',
                    '--sentence-silence', '0.25', '-f', wav], input=texto.encode(), check=True, capture_output=True)

textos = json.load(open(a.textos))
for idioma, lista in textos.items():
    carpeta = os.path.join(a.salida, idioma)
    os.makedirs(carpeta, exist_ok=True)
    indice = {}
    for texto in lista:
        nombre = hashlib.sha1(texto.encode()).hexdigest()[:12] + '.mp3'
        indice[texto] = nombre
        destino = os.path.join(carpeta, nombre)
        if os.path.exists(destino) and not a.todo:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, 'v.wav')
            (sintetizar_es if idioma == 'es' else sintetizar_en)(para_hablar(texto, idioma), wav)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', FILTRO, '-ar', '24000', '-ac', '1', '-b:a', '64k', destino], check=True)
        print(idioma, nombre, texto[:60])
    for viejo in set(os.listdir(carpeta)) - set(indice.values()) - {'indice.json'}:
        os.remove(os.path.join(carpeta, viejo))
    json.dump(indice, open(os.path.join(carpeta, 'indice.json'), 'w'), ensure_ascii=False, indent=1)
