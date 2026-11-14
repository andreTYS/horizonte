import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../js/evaluacion.js';

const ev = JSON.parse(fs.readFileSync(new URL('../data/evaluacion.json', import.meta.url)));
const nasa = JSON.parse(fs.readFileSync(new URL('../data/nasa.json', import.meta.url)));

test('prueba inicial y final son paralelas: mismos conceptos, en el mismo orden', () => {
  assert.deepEqual(ev.inicial.preguntas.map((p) => p.concepto), ev.final.preguntas.map((p) => p.concepto));
});

test('cada pregunta tiene 4 opciones y una correcta válida; la final explica con un dato NASA real', () => {
  for (const p of [...ev.inicial.preguntas, ...ev.final.preguntas]) {
    assert.equal(p.opciones.length, 4);
    assert.ok(p.correcta >= 0 && p.correcta < 4);
  }
  for (const p of ev.final.preguntas) assert.ok(nasa.cifras[p.dato], `dato inexistente: ${p.dato}`);
});

test('la respuesta correcta no está siempre en la misma posición', () => {
  assert.ok(new Set(ev.inicial.preguntas.map((p) => p.correcta)).size >= 3);
  assert.ok(new Set(ev.final.preguntas.map((p) => p.correcta)).size >= 3);
});

test('puntaje de la prueba', () => {
  const todas = ev.final.preguntas.map((p) => p.correcta);
  assert.equal(E.puntuarPrueba(ev.final, todas).puntaje, 5);
  assert.equal(E.puntuarPrueba(ev.final, [9, 9, 9, 9, 9]).puntaje, 0);
});

test('rúbrica: cada criterio tiene exactamente una opción de 2 puntos; máximo 8 = AD, mínimo 0 = C', () => {
  for (const c of ev.caso.criterios) assert.equal(c.opciones.filter((o) => o.puntos === 2).length, 1, c.id);
  const mejor = ev.caso.criterios.map((c) => c.opciones.findIndex((o) => o.puntos === 2));
  const peor = ev.caso.criterios.map((c) => c.opciones.findIndex((o) => o.puntos === 0));
  const r1 = E.puntuarRubrica(ev.caso, mejor, ev.niveles);
  assert.equal(r1.puntaje, 8); assert.equal(r1.nivel.codigo, 'AD');
  const r0 = E.puntuarRubrica(ev.caso, peor, ev.niveles);
  assert.equal(r0.puntaje, 0); assert.equal(r0.nivel.codigo, 'C');
});

test('niveles MINEDU por puntaje', () => {
  assert.deepEqual([8, 7, 6, 5, 4, 3, 2, 0].map((p) => E.nivel(p, ev.niveles).codigo), ['AD', 'AD', 'A', 'A', 'B', 'B', 'C', 'C']);
});

test('ganancia normalizada de Hake', () => {
  assert.equal(E.ganancia(1, 5, 5), 1);
  assert.equal(E.ganancia(3, 4, 5), 0.5);
  assert.equal(E.ganancia(null, 4, 5), null);
});
