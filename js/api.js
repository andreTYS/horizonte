// Conexión opcional con el servidor del VPS.
// Si no hay servidor (GitHub Pages, sin internet), el juego funciona igual y no envía nada.

let disponible = false;
const pendientes = 'horizonte.pendientes';

export async function detectar() {
  try {
    const r = await fetch('api/salud', { cache: 'no-store' });
    disponible = r.ok && (await r.json()).ok === true;
  } catch {
    disponible = false;
  }
  if (disponible) reenviarPendientes();
  return disponible;
}

export const hayServidor = () => disponible;

function leerPendientes() {
  try { return JSON.parse(localStorage.getItem(pendientes)) || []; } catch { return []; }
}
function guardarPendientes(lista) {
  try { localStorage.setItem(pendientes, JSON.stringify(lista.slice(-50))); } catch { /* sin almacenamiento */ }
}

async function enviar(partida) {
  const r = await fetch(partida.nota ? 'api/notas' : partida.tipo ? 'api/evaluaciones' : 'api/partidas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partida),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

/** Guarda el resultado de una misión. Si falla la conexión, lo reintenta en la próxima visita. */
export async function enviarPartida(partida) {
  if (!disponible) return;
  const conFecha = { ...partida, fecha: new Date().toISOString() };
  try {
    await enviar(conFecha);
  } catch {
    guardarPendientes([...leerPendientes(), conFecha]);
  }
}

async function reenviarPendientes() {
  const lista = leerPendientes();
  if (!lista.length) return;
  const restantes = [];
  for (const p of lista) {
    try { await enviar(p); } catch { restantes.push(p); }
  }
  guardarPendientes(restantes);
}

/** Guarda el resultado de una prueba (inicial, final) o del caso con rúbrica. */
export const enviarEvaluacion = (evaluacion) => enviarPartida(evaluacion);

/** Frase de la bitácora del estudiante («Cuéntalo»). */
export const enviarNota = (nota) => enviarPartida(nota);

/** Modo aula: ¿el docente pausó el aula? Devuelve { pausa, mensaje } o null si no hay servidor. */
export async function estadoAula(aula) {
  if (!disponible || !aula) return null;
  try {
    const r = await fetch(`api/aula?aula=${encodeURIComponent(aula)}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Progreso del estudiante en el servidor (por aula + nombre). */
export async function guardarProgreso(aula, nombre, datos, actualizado) {
  if (!disponible || !aula || !nombre) return false;
  try {
    const r = await fetch('api/progreso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aula, nombre, datos, actualizado }) });
    return r.ok;
  } catch { return false; }
}

export async function leerProgreso(aula, nombre) {
  if (!disponible || !aula || !nombre) return null;
  try {
    const r = await fetch(`api/progreso?aula=${encodeURIComponent(aula)}&nombre=${encodeURIComponent(nombre)}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
