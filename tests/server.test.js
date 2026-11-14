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

test('sin NASA_API_KEY el proxy de DONKI lo dice claramente', async () => {
  assert.equal((await fetch(`${BASE}/api/donki?tipo=GST&inicio=2024-05-01&fin=2024-05-31`)).status, 503);
});
