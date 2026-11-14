import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { t, tr, trAnalisis, setIdioma } from '../js/i18n.js';
import * as S from '../js/sim.js';

const leer = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url)));
const nasa = leer('nasa.json'), juego = leer('juego.json'), misiones = leer('misiones.json');

test('español por defecto; inglés con variables', () => {
  setIdioma('es');
  assert.equal(t('Día {n}', { n: 3 }), 'Día 3');
  setIdioma('en');
  assert.equal(t('Día {n}', { n: 3 }), 'Day 3');
  assert.equal(t('texto sin traducir'), 'texto sin traducir');
  setIdioma('es');
});

test('cada falla de cada misión se traduce completa al inglés', () => {
  setIdioma('en');
  const decisiones = [() => S.decisionesPorDefecto(), (d) => ({ ...S.decisionesPorDefecto(), racion: true })];
  const vistos = new Set();
  for (const m of misiones) {
    for (const cfg of [m.sugerido, { ...m.sugerido, reciclador: false }, { ...m.sugerido, comida: 20 }]) {
      for (const dec of decisiones) {
        const r = S.simular(m, cfg, nasa, juego, dec);
        if (r.resultado.exito) continue;
        const a = trAnalisis(S.analizarFalla(r.resultado.motivo, r.historial, r.estado, m, nasa));
        for (const txt of [a.titulo, a.consejo, ...a.cadena]) {
          vistos.add(txt);
          assert.doesNotMatch(txt, /\b(Día|días|agua|baterías|tripulación|refugio|energía)\b/, `sin traducir: ${txt}`);
        }
      }
    }
  }
  assert.ok(vistos.size > 10);
  setIdioma('es');
});

test('las traducciones de datos cubren todas las misiones, cifras y eventos', () => {
  const mEn = leer('en/misiones.json'), nEn = leer('en/nasa.json'), evEn = leer('en/evaluacion.json'), ev = leer('evaluacion.json');
  for (const m of misiones) {
    assert.ok(mEn[m.id], m.id);
    assert.equal(mEn[m.id].eventos.length, m.eventos.length, `${m.id}: eventos`);
  }
  for (const k of Object.keys(nasa.cifras)) assert.ok(nEn[k], k);
  assert.deepEqual(evEn.final.preguntas.map((p) => p.correcta), ev.final.preguntas.map((p) => p.correcta));
  assert.equal(tr('Se apagó: electrolizador, reciclador'), 'Se apagó: electrolizador, reciclador'); // en español no cambia
});
