// Voz de Nebula: archivos pregenerados con Piper TTS (assets/voz/<idioma>/) y, si una frase no
// tiene archivo (textos que cambian en cada partida), la voz del propio navegador como respaldo.
import { reproducirVoz, callarVoz, sonidoActivo } from './sonido.js';
import { getIdioma } from './i18n.js';

const indices = {};
let ultimo = '';
let activa = (() => { try { return localStorage.getItem('horizonte.voz') !== 'no'; } catch { return true; } })();

export const vozActiva = () => activa;

/** Igual que en tools/voz/textos.mjs: sin etiquetas HTML y con espacios simples. */
export const normalizar = (html) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function indice(idioma) {
  indices[idioma] ||= fetch(`assets/voz/${idioma}/indice.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return indices[idioma];
}

function vozNavegador(texto, idioma) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  // Español latino (Perú primero, nunca España si hay otra) e inglés de EE. UU.
  const PREFERIDAS = idioma === 'es' ? ['es-pe', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-cl', 'es-ar', 'es'] : ['en-us', 'en'];
  u.lang = idioma === 'es' ? 'es-PE' : 'en-US';
  u.pitch = 1.1;
  u.rate = 1;
  const voces = speechSynthesis.getVoices();
  const norm = (v) => (v.lang || '').toLowerCase().replace('_', '-');
  for (const pref of PREFERIDAS) {
    const opciones = voces.filter((v) => norm(v) === pref || (pref.length === 2 && norm(v).startsWith(pref) && norm(v) !== 'es-es'));
    const voz = opciones.find((v) => /natural|neural|online|google/i.test(v.name)) || opciones[0];
    if (voz) { u.voice = voz; u.lang = voz.lang; break; }
  }
  u.onstart = () => document.body.classList.add('nebula-habla');
  u.onend = () => document.body.classList.remove('nebula-habla');
  speechSynthesis.speak(u);
}

export function callar() {
  callarVoz();
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  document.body.classList.remove('nebula-habla');
}

/** Nebula dice este texto (HTML). No repite la última frase. */
export async function decir(html) {
  const texto = normalizar(html);
  if (!activa || !sonidoActivo() || !texto || texto === ultimo) return;
  ultimo = texto;
  const idioma = getIdioma();
  const archivo = (await indice(idioma))[texto];
  if (archivo && (await reproducirVoz(`assets/voz/${idioma}/${archivo}`))) return;
  vozNavegador(texto, idioma);
}

/** Permite que Nebula repita la misma frase (al volver a una pantalla). */
export const olvidarUltimo = () => { ultimo = ''; };

export function fijarVoz(on) {
  if (on !== activa) alternarVoz();
}

export function alternarVoz() {
  activa = !activa;
  try { localStorage.setItem('horizonte.voz', activa ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  if (!activa) callar();
  return activa;
}
