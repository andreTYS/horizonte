import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../js/sim.js';

const leer = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url)));
const nasa = leer('nasa.json');
const juego = leer('juego.json');
const misiones = leer('misiones.json');
const M = Object.fromEntries(misiones.map((m) => [m.id, m]));
const { amanecer, noche, tormenta } = M;
const refugioEn = (dias) => (d) => ({ ...S.decisionesPorDefecto(), refugio: dias.includes(d) });

test('cada cifra NASA tiene valor, fuente y url', () => {
  for (const [k, c] of Object.entries(nasa.cifras)) {
    assert.ok(c.valor !== undefined && c.fuente && c.url.startsWith('https://'), k);
  }
});

test('aire y agua: la base sugerida gana', () => {
  const r = S.simular(amanecer, amanecer.sugerido, nasa, juego);
  assert.equal(r.resultado.exito, true);
  assert.ok(S.masa(amanecer.sugerido, juego, nasa) <= amanecer.presupuesto_t);
});

test('la noche larga: la base sugerida falla en la noche lunar y se explica', () => {
  const r = S.simular(noche, noche.sugerido, nasa, juego);
  assert.equal(r.resultado.exito, false);
  const a = S.analizarFalla(r.resultado.motivo, r.historial, r.estado, noche, nasa);
  assert.match(a.titulo, /noche lunar/);
  assert.ok(a.datos.includes('fsp_kw'));
});

test('la noche larga: se gana con reactor o con baterías, dentro del presupuesto', () => {
  const base = { reciclador: true, invernadero: false, o2: 10, agua: 175, comida: 185 };
  for (const cfg of [
    { ...base, panel: 3, bateria: 0, reactor: true, blindaje: 1 },
    { ...base, panel: 6, bateria: 12, reactor: false, blindaje: 0 },
  ]) {
    assert.ok(S.masa(cfg, juego, nasa) <= noche.presupuesto_t);
    assert.equal(S.simular(noche, cfg, nasa, juego).resultado.exito, true);
  }
});

test('extra tormenta lunar: sin refugio la tormenta solar mata la misión; con refugio se gana', () => {
  const sin = S.simular(tormenta, tormenta.sugerido, nasa, juego);
  assert.equal(sin.resultado.motivo, 'radiacion');
  assert.match(S.analizarFalla('radiacion', sin.historial, sin.estado, tormenta, nasa).titulo, /tormenta/);
  const con = S.simular(tormenta, tormenta.sugerido, nasa, juego, refugioEn([7, 8]));
  assert.equal(con.resultado.exito, true);
});

test('rebobinar: repetir desde un estado guardado da el mismo resultado (determinista)', () => {
  const r1 = S.simular(noche, noche.sugerido, nasa, juego);
  const r2 = S.simular(noche, noche.sugerido, nasa, juego);
  assert.deepEqual(r1.estado, r2.estado);
});

test('electrólisis: fabricar O₂ consume 1,125 kg de agua por kg', () => {
  const e0 = S.crearEstado(amanecer, { ...amanecer.sugerido, reciclador: false }, juego);
  const { estado } = S.paso(e0, amanecer, S.decisionesPorDefecto(), nasa, juego);
  const n = amanecer.tripulacion;
  const esperado = e0.agua - n * 0.82 * 1.125 - n * nasa.cifras.agua_persona_dia.valor;
  assert.ok(Math.abs(estado.agua - esperado) < 0.02);
  assert.equal(estado.o2, e0.o2);
});

test('misión 4 (hielo): sin extractor se acaba el agua; con extractor se gana', () => {
  const sin = S.simular(M.hielo, M.hielo.sugerido, nasa, juego);
  assert.equal(sin.resultado.exito, false);
  const a = S.analizarFalla(sin.resultado.motivo, sin.historial, sin.estado, M.hielo, nasa);
  assert.match(a.consejo, /extractor/);
  const con = { ...M.hielo.sugerido, extractor: true };
  assert.ok(S.masa(con, juego, nasa) <= M.hielo.presupuesto_t);
  assert.equal(S.simular(M.hielo, con, nasa, juego).resultado.exito, true);
});

test('misión 5 (todo sale mal): hace falta energía para la noche y refugio en la tormenta', () => {
  assert.equal(S.simular(M.cadena, M.cadena.sugerido, nasa, juego).resultado.motivo, 'energia');
  const cfg = { ...M.cadena.sugerido, reactor: true, panel: 2, bateria: 0, agua: 200 };
  assert.ok(S.masa(cfg, juego, nasa) <= M.cadena.presupuesto_t);
  assert.equal(S.simular(M.cadena, cfg, nasa, juego).resultado.motivo, 'radiacion');
  assert.equal(S.simular(M.cadena, cfg, nasa, juego, refugioEn([17])).resultado.exito, true);
});

test('primera cosecha (Marte): el polvo deja sin energía; reactor o paneles+baterías ganan; MOXIE ahorra agua', () => {
  const sin = S.simular(M.marte, M.marte.sugerido, nasa, juego);
  assert.equal(sin.resultado.motivo, 'energia');
  assert.match(S.analizarFalla('energia', sin.historial, sin.estado, M.marte, nasa).titulo, /polvo/);
  for (const cfg of [{ ...M.marte.sugerido, reactor: true, panel: 2, bateria: 0 }, { ...M.marte.sugerido, panel: 12, bateria: 10 }]) {
    assert.ok(S.masa(cfg, juego, nasa) <= M.marte.presupuesto_t);
    assert.equal(S.simular(M.marte, cfg, nasa, juego).resultado.exito, true);
  }
  const pocaAgua = { ...M.marte.sugerido, panel: 12, bateria: 9, agua: 90 };
  assert.equal(S.simular(M.marte, pocaAgua, nasa, juego).resultado.exito, false);
  assert.equal(S.simular(M.marte, { ...pocaAgua, moxie: true }, nasa, juego).resultado.exito, true);
});

test('todas las misiones: diseño sugerido dentro del presupuesto y datos NASA existentes', () => {
  for (const m of misiones) {
    assert.ok(S.masa(m.sugerido, juego, nasa) <= m.presupuesto_t, m.id);
    for (const ev of m.eventos) if (ev.dato) assert.ok(nasa.cifras[ev.dato], `${m.id}: ${ev.dato}`);
    if (m.dosis_dato) assert.ok(nasa.cifras[m.dosis_dato], m.id);
  }
});

test('campaña: 4 misiones en orden (Luna → Marte); la última abre la prueba final', () => {
  const campana = misiones.filter((m) => !m.avanzada && !m.tutorial).map((m) => m.id);
  assert.deepEqual(campana, ['noche', 'amanecer', 'marte', 'tormenta_marte']);
  assert.equal(misiones.filter((m) => m.evaluacion).map((m) => m.id).join(), 'tormenta_marte');
  for (const m of misiones) if (m.reserva_a) assert.ok(M[m.reserva_a], m.id);
});

test('M4 tormenta solar en Marte: sin refugio supera el límite; con refugio se gana', () => {
  const m = M.tormenta_marte;
  const sin = S.simular(m, m.sugerido, nasa, juego);
  assert.equal(sin.resultado.motivo, 'radiacion');
  const a = S.analizarFalla('radiacion', sin.historial, sin.estado, m, nasa);
  assert.ok(a.datos.includes('tormenta_marte_mayo_2024') && a.datos.includes('dosis_marte_msv_dia'));
  assert.equal(S.simular(m, m.sugerido, nasa, juego, refugioEn([7, 8])).resultado.exito, true);
});

test('reserva: lo que sobró entra a la siguiente misión sin pesar en el cohete', () => {
  const e = S.crearEstado(amanecer, amanecer.sugerido, juego, { o2: 2, agua: 10, comida: 5 });
  assert.equal(e.o2, amanecer.sugerido.o2 + 2);
  assert.equal(e.agua, amanecer.sugerido.agua + 10);
  assert.equal(e.comida, amanecer.sugerido.comida + 5);
});

test('episodio 0: sin baterías la noche apaga la base; con 2 baterías se gana', () => {
  const m = M.cero;
  assert.equal(misiones[0].id, 'cero');
  const sin = S.simular(m, m.sugerido, nasa, juego);
  assert.equal(sin.resultado.motivo, 'energia');
  assert.match(S.analizarFalla('energia', sin.historial, sin.estado, m, nasa).titulo, /noche/);
  const con = { ...m.sugerido, bateria: 2 };
  assert.ok(S.masa(con, juego, nasa) <= m.presupuesto_t);
  assert.equal(S.simular(m, con, nasa, juego).resultado.exito, true);
});
