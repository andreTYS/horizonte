"""Genera la voz de Nebula con Piper TTS (MIT, github.com/rhasspy/piper) y le da un toque de "gata robot" con ffmpeg.

Uso:
  node tools/voz/textos.mjs > /tmp/textos.json
  python tools/voz/generar.py /tmp/textos.json --piper venv/bin/piper \
      --es voces/es-mls_10246-low.onnx --en voces/en-us-amy-low.onnx
Salida: assets/voz/<idioma>/<hash>.mp3 y assets/voz/<idioma>/indice.json ({texto: archivo}).
"""
import argparse, hashlib, json, os, subprocess, tempfile

p = argparse.ArgumentParser()
p.add_argument('textos'); p.add_argument('--piper', required=True)
p.add_argument('--es', required=True); p.add_argument('--en', required=True)
p.add_argument('--salida', default='assets/voz')
a = p.parse_args()

# Las voces en español de Piper (MLS) hablan lento: se acelera más y se recortan silencios.
AJUSTE = {
    'es': {'modelo': a.es, 'largo': '0.78', 'tono': 1.10},
    'en': {'modelo': a.en, 'largo': '0.95', 'tono': 1.10},
}
FILTRO = ('asetrate=16000*{tono},aresample=24000,highpass=f=110,'
          'aecho=0.85:0.5:9|17:0.22|0.12,'          # leve brillo metálico (robot)
          'loudnorm=I=-17:TP=-2:LRA=9')

import re

def para_hablar(texto, idioma):
    """Texto adaptado a la pronunciación (no cambia la clave del índice)."""
    # Frases que el modelo en español pronuncia mal: se reordenan solo para la voz
    for malo, bueno in {'Las partículas llegan mañana.': 'Mañana llegan las partículas.'}.items():
        texto = texto.replace(malo, bueno)
    t = texto.replace('¡', '').replace('¿', '').replace('×', ' por ' if idioma == 'es' else ' times ').replace('…', '.')
    t = t.replace('%', ' por ciento' if idioma == 'es' else ' percent').replace('O₂', 'oxígeno' if idioma == 'es' else 'oxygen')
    t = t.replace('ISRU', 'I S R U').replace('kg', 'kilos' if idioma == 'es' else 'kilograms')
    t = re.sub(r'(\d),(\d)', r'\1 coma \2' if idioma == 'es' else r'\1.\2', t)
    return [o.strip() for o in re.split(r'(?<=[.!?:;])\s+', t) if o.strip()]

def duracion(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

def sintetizar(oracion, cfg, wav, intento):
    ruido = ['0.45', '0.35', '0.25'][intento]
    subprocess.run([a.piper, '-m', cfg['modelo'], '--length-scale', cfg['largo'], '--noise-scale', ruido, '--noise-w-scale', '0.4',
                    '--sentence-silence', '0', '-f', wav], input=oracion.encode(), check=True, capture_output=True)
    # recortar silencios del principio y del final
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af',
                    'silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse,'
                    'silenceremove=stop_periods=-1:stop_duration=0.18:stop_threshold=-40dB', wav + '.r.wav'], check=True)
    os.replace(wav + '.r.wav', wav)
    return duracion(wav)

textos = json.load(open(a.textos))
for idioma, lista in textos.items():
    cfg = AJUSTE[idioma]
    carpeta = os.path.join(a.salida, idioma)
    os.makedirs(carpeta, exist_ok=True)
    indice = {}
    for texto in lista:
        nombre = hashlib.sha1(texto.encode()).hexdigest()[:12] + '.mp3'
        indice[texto] = nombre
        destino = os.path.join(carpeta, nombre)
        if os.path.exists(destino):
            continue
        with tempfile.TemporaryDirectory() as tmp:
            partes = []
            for k, oracion in enumerate(para_hablar(texto, idioma)):
                wav = os.path.join(tmp, f'{k}.wav')
                palabras = max(1, len(oracion.split()))
                for intento in range(3):  # si suena demasiado lento (balbuceo), se repite con menos ruido
                    d = sintetizar(oracion, cfg, wav, intento)
                    if d / palabras < 0.62:
                        break
                partes.append(wav)
            lista = os.path.join(tmp, 'lista.txt')
            silencio = os.path.join(tmp, 'pausa.wav')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '0.18', silencio], check=True)
            open(lista, 'w').write(''.join(f"file '{x}'\nfile '{silencio}'\n" for x in partes))
            unido = os.path.join(tmp, 'unido.wav')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', unido], check=True)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', unido, '-af', FILTRO.format(tono=cfg['tono']),
                            '-ac', '1', '-b:a', '56k', destino], check=True)
        print(idioma, nombre, texto[:60])
    json.dump(indice, open(os.path.join(carpeta, 'indice.json'), 'w'), ensure_ascii=False, indent=1)
