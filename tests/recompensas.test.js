import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/recompensas.js';

test('recompensa: premia predecir bien, no rebobinar, jugar sin pistas y aprender de un error', () => {
  const max = R.calcularRecompensa({ exito: true, estrellas: 3, predijo: true, acerto: true, rebobinados: 0, sinPistas: true, falloAntes: true });
  assert.equal(max.total, 20 + 30 + 10 + 15 + 10 + 15);
  const falla = R.calcularRecompensa({ exito: false, predijo: true, acerto: true });
  assert.equal(falla.total, 3 + 15); // fallar y haberlo predicho también se premia
  assert.equal(R.calcularRecompensa({ exito: false }).total, 3);
});

test('tienda: no se compra sin créditos; al comprar un objeto queda colocado', () => {
  const rec = R.estadoInicial();
  assert.ok(rec.objetos.includes('obj-bandera'));
  assert.equal(R.comprar(rec, 'obj-dron').ok, false);
  rec.creditos = 100;
  assert.equal(R.comprar(rec, 'obj-dron').ok, true);
  assert.equal(rec.creditos, 20);
  assert.ok(rec.objetos.includes('obj-dron') && rec.comprados.includes('obj-dron'));
  assert.equal(R.comprar(rec, 'obj-dron').ok, true); // ya era suyo: no cobra otra vez
  assert.equal(rec.creditos, 20);
});

test('insignias: se ganan una vez, según el progreso real', () => {
  const e = { historial: [{ mision: 'noche', exito: false, motivo: 'energia', prediccion: 'energia', rebobinados: 0 }, { mision: 'noche', exito: true, prediccion: 'agua', rebobinados: 2 }], progreso: { noche: 1 }, visitados: [], fichas: [], notas: {} };
  const nuevas = R.nuevasInsignias(e, []);
  assert.deepEqual(nuevas.sort(), ['leccion', 'noche', 'primera', 'profeta'].sort());
  assert.deepEqual(R.nuevasInsignias(e, nuevas), []);
});
