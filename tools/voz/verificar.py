"""Escucha cada audio de Nebula con Whisper (sherpa-onnx) y lo compara con el texto original.
Sirve para detectar voces que balbucean o se saltan palabras sin tener que oírlas una por una.

Uso: python tools/voz/verificar.py --whisper modelos/sherpa-onnx-whisper-small
(modelo: release "asr-models" de github.com/k2-fsa/sherpa-onnx)
"""
import argparse, difflib, json, os, re, subprocess
import numpy as np, sherpa_onnx

p = argparse.ArgumentParser()
p.add_argument('--whisper', required=True); p.add_argument('--carpeta', default='assets/voz')
a = p.parse_args()
d = a.whisper.rstrip('/') + '/'

def palabras(t):
    t = re.sub(r'<[^>]+>', ' ', t.lower())
    return re.findall(r"[a-záéíóúñü0-9']+", t)

peores = []
for idioma in ('es', 'en'):
    rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d + 'small-encoder.int8.onnx', decoder=d + 'small-decoder.int8.onnx',
                                                     tokens=d + 'small-tokens.txt', language=idioma, task='transcribe', num_threads=4)
    indice = json.load(open(os.path.join(a.carpeta, idioma, 'indice.json')))
    for texto, archivo in indice.items():
        pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(a.carpeta, idioma, archivo), '-ar', '16000', '-ac', '1', '-f', 'f32le', '-'], capture_output=True).stdout
        s = rec.create_stream(); s.accept_waveform(16000, np.frombuffer(pcm, dtype=np.float32)); rec.decode_stream(s)
        parecido = difflib.SequenceMatcher(None, palabras(texto), palabras(s.result.text)).ratio()
        peores.append((parecido, idioma, archivo, texto, s.result.text.strip()))
peores.sort()
for parecido, idioma, archivo, texto, oido in peores[:8]:
    print(f'{parecido:.2f} {idioma} {archivo}\n  texto: {texto[:150]}\n  oído:  {oido[:150]}')
print('promedio', round(sum(x[0] for x in peores) / len(peores), 3), '· mínimo', round(peores[0][0], 2), '·', len(peores), 'audios')
