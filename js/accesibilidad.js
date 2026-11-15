// Accesibilidad de ASU STELLAR · Horizonte:
// - anuncios para lector de pantalla (región viva propia: no se relee toda la pantalla al redibujar)
// - vibración en alarmas (celular)
// - preferencias: texto grande, alto contraste, menos movimiento, vibración, leer el estado cada día
// - panel de accesibilidad con la lista de atajos de teclado
import { t } from './i18n.js';

const CLAVE = 'horizonte.accesibilidad';
const reducidoSistema = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const pref = (() => {
  const base = { textoGrande: false, contraste: false, menosMovimiento: reducidoSistema, vibracion: true, leerEstado: false };
  try { return { ...base, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; } catch { return base; }
})();

let alCambiar = () => {};

/** Aplica las preferencias a la página (clases en <html>) y avisa al mundo 3D. */
export function aplicar(mundo) {
  const h = document.documentElement;
  h.classList.toggle('texto-grande', pref.textoGrande);
  h.classList.toggle('alto-contraste', pref.contraste);
  h.classList.toggle('menos-movimiento', pref.menosMovimiento);
  mundo?.movimientoReducido?.(pref.menosMovimiento);
}

export function guardarPref(mundo) {
  try { localStorage.setItem(CLAVE, JSON.stringify(pref)); } catch { /* sin almacenamiento */ }
  aplicar(mundo);
  alCambiar();
}

/** Lo dice el lector de pantalla. `urgente` interrumpe (alarmas). */
export function anunciar(texto, urgente = false) {
  const el = document.getElementById(urgente ? 'anuncios-urgentes' : 'anuncios');
  if (!el || !texto) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = texto; }, 60); // vaciar y volver a llenar: así se anuncia aunque el texto se repita
}

/** Vibra el celular (si el usuario lo permite y el equipo puede). */
export function vibrar(patron) {
  if (!pref.vibracion || pref.menosMovimiento || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(patron); } catch { /* sin vibración */ }
}

export const ATAJOS = () => [
  ['A', t('Avanzar un día')], ['5', t('Avanzar 5 días')], ['R', t('Refugio')], ['C', t('Ración reducida')], ['I', t('Invernadero')],
  ['E', t('Escuchar el estado de la base')], ['B', t('Bitácora')], ['Z', t('Rebobinar un día con el Cronoscopio')], ['Esc', t('Cerrar ventanas')], ['?', t('Este panel')],
];

/** Panel de accesibilidad (capa encima de todo, no reemplaza la pantalla). */
export function abrirPanel({ mundo, I, alCerrar, alVista2D }) {
  document.getElementById('panel-acc')?.remove();
  const previo = document.activeElement;
  const capa = document.createElement('div');
  capa.id = 'panel-acc';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-labelledby', 'titulo-acc');
  const casilla = (k, ic, txt, ayuda) => `<label class="opcion-acc"><input type="checkbox" data-pref="${k}" ${pref[k] ? 'checked' : ''}>
    <span class="ico">${I(ic)}</span><span><b>${txt}</b><small>${ayuda}</small></span></label>`;
  capa.innerHTML = `<div class="panel-acc-caja">
    <div class="entre"><h2 id="titulo-acc">${I('accesibilidad')} ${t('Accesibilidad')}</h2><button class="boton-icono" id="cerrarAcc" aria-label="${t('Cerrar')}">${I('cerrar')}</button></div>
    ${casilla('textoGrande', 'texto', t('Texto más grande'), t('Agranda letras y botones.'))}
    ${casilla('contraste', 'contraste', t('Alto contraste'), t('Fondos sólidos y bordes más marcados.'))}
    ${casilla('menosMovimiento', 'mano', t('Menos movimiento'), t('Sin animaciones ni cámara que gira sola.'))}
    ${casilla('vibracion', 'vibrar', t('Vibrar en las alarmas'), t('En el celular, cada alarma también vibra.'))}
    ${casilla('leerEstado', 'escuchar', t('Leer el estado cada día'), t('Nebula dice cómo está la base después de avanzar.'))}
    ${mundo && alVista2D ? `<button class="secundario" id="vista2d">${I('capas')} ${t('Usar vista ligera (2D)')}</button><p class="chico suave">${t('Para equipos lentos. Tu misión sigue igual.')}</p>` : ''}
    <h3>${I('teclado')} ${t('Atajos de teclado en la misión')}</h3>
    <dl class="atajos">${ATAJOS().map(([k, d]) => `<div><dt><kbd>${k}</kbd></dt><dd>${d}</dd></div>`).join('')}</dl>
    <p class="chico suave">${t('Las alarmas siempre aparecen también como texto, y la voz de Nebula siempre tiene su globo escrito.')}</p>
  </div>`;
  document.body.appendChild(capa);
  const cerrar = () => { capa.remove(); document.removeEventListener('keydown', teclas, true); previo?.focus?.(); alCerrar?.(); };
  const teclas = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cerrar(); }
    if (ev.key === 'Tab') { // el foco no sale del panel
      const f = [...capa.querySelectorAll('button, input')];
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', teclas, true);
  capa.addEventListener('click', (ev) => { if (ev.target === capa) cerrar(); });
  capa.querySelector('#cerrarAcc').addEventListener('click', cerrar);
  capa.querySelector('#vista2d')?.addEventListener('click', () => { cerrar(); alVista2D(); });
  capa.querySelectorAll('[data-pref]').forEach((c) => c.addEventListener('change', () => { pref[c.dataset.pref] = c.checked; guardarPref(mundo); }));
  capa.querySelector('#cerrarAcc').focus();
}

export function siCambia(fn) { alCambiar = fn; }
