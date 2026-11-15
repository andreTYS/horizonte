import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PUERTO = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://localhost:${PUERTO}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horizonte-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['--no-warnings', 'server/server.mjs'], {
    env: { ...process.env, PORT: String(PUERTO), DB_PATH: path.join(dir, 'h.db'), DOCENTE_TOKEN: 'secreto', NASA_API_KEY: '' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/salud`)).ok) return; } catch { /* aún no arranca */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('el servidor no arrancó');
});
after(() => { proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test('sirve el juego y bloquea archivos fuera de la lista pública', async () => {
  assert.equal((await fetch(`${BASE}/`)).status, 200);
  assert.equal((await fetch(`${BASE}/js/sim.js`)).status, 200);
  assert.equal((await fetch(`${BASE}/server/server.mjs`)).status, 404);
  assert.equal((await fetch(`${BASE}/package.json`)).status, 404);
  assert.equal((await fetch(`${BASE}/..%2f..%2fetc/passwd`)).status, 404);
});

test('guarda partidas y el docente las ve solo con su clave', async () => {
  const partida = { mision: 'noche', exito: false, motivo: 'energia', dias: 9, ciencia: 9, rebobinados: 1, estrellas: 0, nombre: 'Ana', aula: '3b-2026' };
  assert.equal((await fetch(`${BASE}/api/partidas`, { method: 'POST', body: JSON.stringify(partida) })).status, 201);
  assert.equal((await fetch(`${BASE}/api/partidas`, { method: 'POST', body: '{"x":1}' })).status, 400);
  assert.equal((await fetch(`${BASE}/api/resultados?aula=3B-2026`)).status, 401);
  const r = await fetch(`${BASE}/api/resultados?aula=3b-2026`, { headers: { Authorization: 'Bearer secreto' } });
  const d = await r.json();
  assert.equal(d.partidas.length, 1);
  assert.equal(d.fallas[0].motivo, 'energia');
});

test('guarda evaluaciones y el panel calcula promedios, ganancia y niveles', async () => {
  const enviar = (e) => fetch(`${BASE}/api/evaluaciones`, { method: 'POST', body: JSON.stringify({ aula: 'EV-1', ...e }) });
  assert.equal((await enviar({ nombre: 'Ana', tipo: 'inicial', puntaje: 1, maximo: 5 })).status, 201);
  assert.equal((await enviar({ nombre: 'Ana', tipo: 'final', puntaje: 5, maximo: 5 })).status, 201);
  assert.equal((await enviar({ nombre: 'Ana', tipo: 'caso', puntaje: 7, maximo: 8, nivel: 'AD' })).status, 201);
  assert.equal((await enviar({ nombre: 'Luis', tipo: 'inicial', puntaje: 3, maximo: 5 })).status, 201);
  assert.equal((await enviar({ nombre: 'Luis', tipo: 'final', puntaje: 4, maximo: 5 })).status, 201);
  assert.equal((await enviar({ nombre: 'X', tipo: 'otro', puntaje: 1, maximo: 5 })).status, 400);
  assert.equal((await enviar({ nombre: 'X', tipo: 'final', puntaje: 9, maximo: 5 })).status, 400);
  const d = await (await fetch(`${BASE}/api/resultados?aula=ev-1`, { headers: { Authorization: 'Bearer secreto' } })).json();
  assert.equal(d.aprendizaje.inicial, 2);
  assert.equal(d.aprendizaje.final, 4.5);
  assert.equal(d.aprendizaje.ganancia, 0.75); // Ana 100 %, Luis 50 %
  assert.equal(d.aprendizaje.niveles.AD, 1);
  assert.equal(d.aprendizaje.estudiantes.length, 2);
});

test('predicciones y bitácora llegan al panel docente', async () => {
  const post = (ruta, x) => fetch(`${BASE}/api/${ruta}`, { method: 'POST', body: JSON.stringify({ aula: 'PR-1', ...x }) });
  assert.equal((await post('partidas', { mision: 'noche', exito: false, motivo: 'energia', prediccion: 'energia', nombre: 'Ana' })).status, 201);
  assert.equal((await post('partidas', { mision: 'noche', exito: true, prediccion: 'agua', nombre: 'Luis' })).status, 201);
  assert.equal((await post('notas', { mision: 'noche', nota: 'Apagué el invernadero de noche', nombre: 'Ana' })).status, 201);
  assert.equal((await post('notas', { mision: 'noche', nota: '' })).status, 400);
  const d = await (await fetch(`${BASE}/api/resultados?aula=pr-1`, { headers: { Authorization: 'Bearer secreto' } })).json();
  assert.deepEqual(d.predicciones, [{ mision: 'noche', total: 2, aciertos: 1 }]);
  assert.equal(d.notas[0].nota, 'Apagué el invernadero de noche');
});

test('modo aula: solo el docente pausa; el juego consulta el estado', async () => {
  const pausar = (pausa, clave = 'secreto') => fetch(`${BASE}/api/aula`, { method: 'POST', headers: { Authorization: `Bearer ${clave}` }, body: JSON.stringify({ aula: '3b', pausa, mensaje: 'Miren la pizarra' }) });
  assert.equal((await pausar(true, 'otra')).status, 401);
  assert.deepEqual(await (await fetch(`${BASE}/api/aula?aula=3B`)).json(), { aula: '3B', pausa: false, mensaje: null });
  assert.equal((await pausar(true)).status, 200);
  assert.deepEqual(await (await fetch(`${BASE}/api/aula?aula=3b`)).json(), { aula: '3B', pausa: true, mensaje: 'Miren la pizarra' });
  assert.equal((await pausar(false)).status, 200);
  assert.equal((await (await fetch(`${BASE}/api/aula?aula=3B`)).json()).pausa, false);
});

test('progreso: se guarda por aula + nombre, no se pisa con uno más viejo, y el docente ve los logros', async () => {
  const guardar = (datos, actualizado) => fetch(`${BASE}/api/progreso`, { method: 'POST', body: JSON.stringify({ aula: 'lg-1', nombre: 'Ana', datos, actualizado }) });
  assert.equal((await guardar({ rec: { creditos: 50, insignias: ['primera'] }, progreso: { cero: 3 } }, 2000)).status, 200);
  assert.equal((await guardar({ rec: { creditos: 5, insignias: [] }, progreso: {} }, 1000)).status, 200); // más viejo: se ignora
  const r = await (await fetch(`${BASE}/api/progreso?aula=LG-1&nombre=Ana`)).json();
  assert.equal(r.datos.rec.creditos, 50);
  assert.equal((await fetch(`${BASE}/api/progreso`, { method: 'POST', body: JSON.stringify({ aula: 'x' }) })).status, 400);
  const d = await (await fetch(`${BASE}/api/resultados?aula=lg-1`, { headers: { Authorization: 'Bearer secreto' } })).json();
  assert.deepEqual(d.logros.map((x) => [x.nombre, x.creditos, x.insignias.length, x.misiones]), [['Ana', 50, 1, 1]]);
});

test('sin NASA_API_KEY el proxy de DONKI lo dice claramente', async () => {
  assert.equal((await fetch(`${BASE}/api/donki?tipo=GST&inicio=2024-05-01&fin=2024-05-31`)).status, 503);
});

test('clase propia: el docente crea su clase con su clave, entra con ella y nadie más', async () => {
  const crear = (x) => fetch(`${BASE}/api/clase`, { method: 'POST', body: JSON.stringify(x) });
  const r = await crear({ clave: 'kahoot123' });
  assert.equal(r.status, 201);
  const { aula } = await r.json();
  assert.match(aula, /^[A-Z]+-\d{4,6}$/);
  assert.equal((await crear({ aula: 'mi-clase', clave: 'abcd' })).status, 201);
  assert.equal((await crear({ aula: 'MI-CLASE', clave: 'otra' })).status, 409); // ya tiene dueño
  assert.equal((await crear({ clave: '12' })).status, 400); // clave muy corta
  const ver = (a, clave) => fetch(`${BASE}/api/resultados?aula=${a}`, { headers: { Authorization: `Bearer ${clave}` } });
  assert.equal((await ver(aula, 'kahoot123')).status, 200);
  assert.equal((await ver(aula, 'mala')).status, 401);
  assert.equal((await ver('mi-clase', 'kahoot123')).status, 401); // la clave de una clase no abre otra
  assert.equal((await ver('mi-clase', 'secreto')).status, 200); // administración
  const pausar = await fetch(`${BASE}/api/aula`, { method: 'POST', headers: { Authorization: 'Bearer abcd' }, body: JSON.stringify({ aula: 'mi-clase', pausa: true }) });
  assert.equal(pausar.status, 200);
});
