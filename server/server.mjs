// Servidor de HORIZONTE para el VPS.
// - Sirve el juego (archivos estáticos).
// - /api/salud           comprobación de vida
// - /api/partidas  POST  guarda el resultado de una misión
// - /api/resultados GET  resultados por aula (requiere DOCENTE_TOKEN)
// - /api/donki     GET   proxy de NASA DONKI con caché; la API key solo vive en el servidor
// Sin dependencias: usa node:http y node:sqlite (Node ≥ 22.5).

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PORT || 8080);
const DB_PATH = process.env.DB_PATH || path.join(RAIZ, 'datos', 'horizonte.db');
const NASA_API_KEY = process.env.NASA_API_KEY || '';
const DOCENTE_TOKEN = process.env.DOCENTE_TOKEN || '';
const PUBLICO = ['index.html', 'manifest.webmanifest', 'sw.js', 'css/', 'js/', 'data/', 'icons/', 'vendor/', 'assets/', 'docente.html'];

// ── Base de datos ──
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recibido TEXT NOT NULL DEFAULT (datetime('now')),
    fecha TEXT, aula TEXT, nombre TEXT, mision TEXT NOT NULL,
    exito INTEGER NOT NULL, motivo TEXT, dias INTEGER, ciencia INTEGER,
    rebobinados INTEGER, estrellas INTEGER, config TEXT
  );
  CREATE INDEX IF NOT EXISTS partidas_aula ON partidas(aula);
  CREATE TABLE IF NOT EXISTS evaluaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recibido TEXT NOT NULL DEFAULT (datetime('now')),
    fecha TEXT, aula TEXT, nombre TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('inicial', 'final', 'caso')),
    puntaje INTEGER NOT NULL, maximo INTEGER NOT NULL, nivel TEXT, respuestas TEXT
  );
  CREATE INDEX IF NOT EXISTS evaluaciones_aula ON evaluaciones(aula);
  CREATE TABLE IF NOT EXISTS cache_nasa (clave TEXT PRIMARY KEY, guardado INTEGER NOT NULL, cuerpo TEXT NOT NULL);
`);
const insertar = db.prepare(`INSERT INTO partidas (fecha, aula, nombre, mision, exito, motivo, dias, ciencia, rebobinados, estrellas, config)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertarEval = db.prepare(`INSERT INTO evaluaciones (fecha, aula, nombre, tipo, puntaje, maximo, nivel, respuestas)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

// ── Utilidades ──
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2',
};
// El importmap de index.html es un script en línea: se permite solo ese, por su hash.
const hashesEnLinea = (() => {
  try {
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    return [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)]
      .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
  } catch { return ''; }
})();
const SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' ${hashesEnLinea}; connect-src 'self' blob: data:; font-src 'self'; worker-src 'self'`,
};

function json(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEGURIDAD });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req, limite = 20_000) {
  return new Promise((ok, mal) => {
    let datos = '';
    req.on('data', (c) => { datos += c; if (datos.length > limite) { mal(new Error('demasiado grande')); req.destroy(); } });
    req.on('end', () => ok(datos));
    req.on('error', mal);
  });
}

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const entero = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

// Límite simple por IP para POST (evita spam)
const golpes = new Map();
function permitido(ip) {
  const ahora = Date.now();
  const lista = (golpes.get(ip) || []).filter((t) => ahora - t < 60_000);
  lista.push(ahora);
  golpes.set(ip, lista);
  return lista.length <= 30;
}

// ── API ──
async function api(req, res, url) {
  if (url.pathname === '/api/salud') return json(res, 200, { ok: true, nasa: Boolean(NASA_API_KEY) });

  if (url.pathname === '/api/partidas' && req.method === 'POST') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    if (!permitido(ip)) return json(res, 429, { error: 'demasiadas solicitudes' });
    let p;
    try { p = JSON.parse(await leerCuerpo(req)); } catch { return json(res, 400, { error: 'JSON inválido' }); }
    const mision = texto(p.mision, 30);
    if (!mision || typeof p.exito !== 'boolean') return json(res, 400, { error: 'faltan datos' });
    insertar.run(
      texto(p.fecha, 30), texto(p.aula, 20)?.toUpperCase() || null, texto(p.nombre, 40), mision, p.exito ? 1 : 0,
      texto(p.motivo, 20), entero(p.dias, 0, 365), entero(p.ciencia, 0, 1000), entero(p.rebobinados, 0, 1000),
      entero(p.estrellas, 0, 3), JSON.stringify(p.config ?? null).slice(0, 2000),
    );
    return json(res, 201, { ok: true });
  }

  if (url.pathname === '/api/evaluaciones' && req.method === 'POST') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    if (!permitido(ip)) return json(res, 429, { error: 'demasiadas solicitudes' });
    let e;
    try { e = JSON.parse(await leerCuerpo(req)); } catch { return json(res, 400, { error: 'JSON inválido' }); }
    const tipo = ['inicial', 'final', 'caso'].includes(e.tipo) ? e.tipo : null;
    const maximo = entero(e.maximo, 1, 20);
    const puntaje = maximo != null ? entero(e.puntaje, 0, maximo) : null;
    if (!tipo || puntaje == null) return json(res, 400, { error: 'faltan datos' });
    const respuestas = Array.isArray(e.respuestas) ? e.respuestas.slice(0, 20).map((x) => entero(x, 0, 9)) : null;
    insertarEval.run(texto(e.fecha, 30), texto(e.aula, 20)?.toUpperCase() || null, texto(e.nombre, 40), tipo, puntaje, maximo,
      ['AD', 'A', 'B', 'C'].includes(e.nivel) ? e.nivel : null, JSON.stringify(respuestas));
    return json(res, 201, { ok: true });
  }

  if (url.pathname === '/api/resultados' && req.method === 'GET') {
    if (!DOCENTE_TOKEN || req.headers.authorization !== `Bearer ${DOCENTE_TOKEN}`) return json(res, 401, { error: 'no autorizado' });
    const aula = texto(url.searchParams.get('aula'), 20)?.toUpperCase();
    if (!aula) return json(res, 400, { error: 'falta el aula' });
    const filas = db.prepare(`SELECT nombre, mision, exito, motivo, dias, ciencia, rebobinados, estrellas, fecha
      FROM partidas WHERE aula = ? ORDER BY id DESC LIMIT 2000`).all(aula);
    const resumen = db.prepare(`SELECT mision, COUNT(*) intentos, SUM(exito) exitos, ROUND(AVG(rebobinados), 1) rebobinados_prom
      FROM partidas WHERE aula = ? GROUP BY mision`).all(aula);
    const fallas = db.prepare(`SELECT mision, motivo, COUNT(*) veces FROM partidas WHERE aula = ? AND exito = 0
      GROUP BY mision, motivo ORDER BY veces DESC`).all(aula);
    // Aprendizaje: último resultado de cada estudiante en cada tipo de evaluación
    const ultimas = db.prepare(`SELECT e.nombre, e.tipo, e.puntaje, e.maximo, e.nivel FROM evaluaciones e
      JOIN (SELECT COALESCE(nombre, '') n, tipo, MAX(id) id FROM evaluaciones WHERE aula = ? GROUP BY COALESCE(nombre, ''), tipo) u ON u.id = e.id`).all(aula);
    const porEstudiante = {};
    for (const u of ultimas) (porEstudiante[u.nombre || '(sin nombre)'] ||= { nombre: u.nombre || '(sin nombre)' })[u.tipo] = { puntaje: u.puntaje, maximo: u.maximo, nivel: u.nivel };
    const estudiantes = Object.values(porEstudiante);
    const prom = (tipo) => {
      const v = estudiantes.filter((x) => x[tipo]).map((x) => x[tipo].puntaje);
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    };
    const ambos = estudiantes.filter((x) => x.inicial && x.final && x.inicial.puntaje < x.inicial.maximo);
    const ganancia = ambos.length
      ? Math.round((ambos.reduce((a, x) => a + (x.final.puntaje - x.inicial.puntaje) / (x.inicial.maximo - x.inicial.puntaje), 0) / ambos.length) * 100) / 100
      : null;
    const niveles = { AD: 0, A: 0, B: 0, C: 0 };
    for (const x of estudiantes) if (x.caso?.nivel) niveles[x.caso.nivel] += 1;
    const aprendizaje = { inicial: prom('inicial'), final: prom('final'), caso: prom('caso'), ganancia, niveles, estudiantes };
    return json(res, 200, { aula, resumen, fallas, partidas: filas, aprendizaje });
  }

  if (url.pathname === '/api/donki' && req.method === 'GET') {
    if (!NASA_API_KEY) return json(res, 503, { error: 'el servidor no tiene NASA_API_KEY' });
    const tipo = url.searchParams.get('tipo') || 'GST';
    const inicio = url.searchParams.get('inicio') || '';
    const fin = url.searchParams.get('fin') || '';
    if (!['GST', 'SEP', 'FLR', 'CME'].includes(tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) {
      return json(res, 400, { error: 'parámetros inválidos' });
    }
    const clave = `${tipo}:${inicio}:${fin}`;
    const guardado = db.prepare('SELECT guardado, cuerpo FROM cache_nasa WHERE clave = ?').get(clave);
    if (guardado && Date.now() - guardado.guardado < 24 * 3600_000) return json(res, 200, JSON.parse(guardado.cuerpo));
    try {
      const r = await fetch(`https://api.nasa.gov/DONKI/${tipo}?startDate=${inicio}&endDate=${fin}`, { headers: { 'X-Api-Key': NASA_API_KEY } });
      if (!r.ok) return json(res, 502, { error: `NASA respondió ${r.status}` });
      const cuerpo = await r.text();
      db.prepare('INSERT OR REPLACE INTO cache_nasa (clave, guardado, cuerpo) VALUES (?, ?, ?)').run(clave, Date.now(), cuerpo);
      return json(res, 200, JSON.parse(cuerpo || '[]'));
    } catch (err) {
      return json(res, 502, { error: 'no se pudo contactar a la NASA' });
    }
  }

  return json(res, 404, { error: 'no existe' });
}

// ── Archivos estáticos ──
function estatico(req, res, url) {
  let ruta = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (ruta.endsWith('/')) ruta += 'index.html';
  const absoluta = path.resolve(RAIZ, ruta);
  const permitida = absoluta.startsWith(RAIZ + path.sep) && PUBLICO.some((p) => ruta === p || (p.endsWith('/') && ruta.startsWith(p)));
  if (!permitida || !fs.existsSync(absoluta) || !fs.statSync(absoluta).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SEGURIDAD });
    return res.end('No encontrado');
  }
  const ext = path.extname(absoluta);
  const cache = ruta === 'sw.js' || ext === '.html' ? 'no-cache' : ruta.startsWith('vendor/') || ruta.startsWith('assets/fuentes/') ? 'public, max-age=604800, immutable' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cache, ...SEGURIDAD });
  fs.createReadStream(absoluta).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') estatico(req, res, url);
    else json(res, 405, { error: 'método no permitido' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'error interno' });
  }
});

servidor.listen(PUERTO, () => console.log(`HORIZONTE escuchando en http://localhost:${PUERTO}`));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { servidor.close(); db.close(); process.exit(0); });
