"""Marca de agua visible «Imagen generada con IA · AI-generated» en las ilustraciones hechas con IA
(regla del envío de NASA Space Apps). Lee los originales de tools/ia-originales/ y escribe en assets/.

Uso: python3 tools/marca-agua.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
TEXTO = 'Imagen generada con IA · AI-generated'
FUENTE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def marcar(origen: Path, destino: Path, chica=False):
    im = Image.open(origen).convert('RGBA')
    w, h = im.size
    tam = max(11, int(min(w, h) * (0.03 if not chica else 0.045)))
    capa = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    while True:  # achica la letra hasta que el texto quepa en el 88 % del ancho
        f = ImageFont.truetype(FUENTE, tam)
        caja = d.textbbox((0, 0), TEXTO, font=f)
        tw, th = caja[2] - caja[0], caja[3] - caja[1]
        if tw <= w * 0.88 or tam <= 9: break
        tam -= 1
    pad = int(tam * 0.5)
    x, y = w - tw - pad * 3, h - th - pad * 3
    d.rounded_rectangle((x - pad, y - pad, x + tw + pad, y + th + pad * 1.4), radius=pad, fill=(14, 6, 36, 170))
    d.text((x, y), TEXTO, font=f, fill=(255, 255, 255, 235))
    out = Image.alpha_composite(im, capa)
    if origen.parent.name == 'historia':
        out = out.convert('RGB')
    out.save(destino, quality=82)

for o in sorted((RAIZ / 'tools/ia-originales/historia').glob('*.webp')):
    marcar(o, RAIZ / 'assets/historia' / o.name)
for o in sorted((RAIZ / 'tools/ia-originales/marca').glob('*.webp')):
    marcar(o, RAIZ / 'assets/marca' / o.name, chica=True)
print('listo')
