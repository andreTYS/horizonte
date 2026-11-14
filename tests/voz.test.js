import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { textos, normalizar } from '../tools/voz/textos.mjs';

const leer = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url)));
const fuenteVoz = fs.readFileSync(new URL('../js/voz.js', import.meta.url), 'utf8');

test('cada frase de Nebula tiene su archivo de voz en ambos idiomas', async () => {
  const lista = textos();
  for (const idioma of ['es', 'en']) {
    const indice = leer(`assets/voz/${idioma}/indice.json`);
    for (const html of lista[idioma]) {
      const archivo = indice[normalizar(html)];
      assert.ok(archivo, `falta voz (${idioma}): ${normalizar(html).slice(0, 60)}`);
      assert.ok(fs.existsSync(new URL(`../assets/voz/${idioma}/${archivo}`, import.meta.url)), archivo);
    }
  }
});

test('el juego normaliza el texto igual que el generador', () => {
  const m = fuenteVoz.match(/export const normalizar = \(html\) => (.*);/);
  assert.ok(m);
  const delJuego = new Function('html', `return ${m[1]};`);
  for (const s of ['¡Hola!<br><br>Mira <b>esto</b>.', 'a  <i>b</i>\n c']) assert.equal(delJuego(s), normalizar(s));
});

test('los efectos de sonido existen', () => {
  for (const n of ['clic', 'abrir', 'atras', 'modulo', 'interruptor', 'alarma', 'aviso', 'exito', 'falla', 'impacto', 'tormenta', 'despegue', 'rebobinar', 'habitat', 'hidraulica']) {
    assert.ok(fs.existsSync(new URL(`../assets/sonidos/${n}.mp3`, import.meta.url)), n);
  }
});
