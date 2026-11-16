// Interfaz de ASU STELLAR · Horizonte: HUD de juego sobre el mapa 3D a pantalla completa.
// La lógica del juego vive en sim.js; aquí solo se dibujan pantallas y se pasan decisiones.
import * as S from './sim.js';
import { escena as escenaSVG } from './escena.js';
import * as api from './api.js';
import * as E from './evaluacion.js';
import { t, trLista, trAnalisis, getIdioma, setIdioma } from './i18n.js';
import { sfx, alternarSonido, sonidoActivo, ambienteEstado, fijarSonido, musicaTema } from './sonido.js';
import { guiaPantalla } from './ayuda.js';
import { decir, callar, olvidarUltimo, alternarVoz, vozActiva, fijarVoz, leer as leerEnVoz } from './voz.js';
import { mostrarLanding } from './landing.js';
import * as A from './accesibilidad.js';
import * as R from './recompensas.js';

const $app = document.getElementById('app');
const $svg = document.getElementById('fondo-svg');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Ícono SVG del sprite (Lucide). */
const I = (nombre, clase = '') => `<svg class="i ${clase}" aria-hidden="true"><use href="icons/sprite.svg#i-${nombre}"></use></svg>`;
const fmt = (n, d = 0) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

const G = {
  nasa: null, juego: null, misiones: [], evaluacion: null,
  mision: null, config: null,
  estados: [], registros: [], decisiones: [], hoy: null,
  rebobinados: 0, avisoRebobinado: null, briefingVisto: {},
  progreso: leer('horizonte.progreso', {}),
  jugador: leer('horizonte.jugador', { nombre: '', aula: '' }),
  eval: leer('horizonte.evaluacion', {}),
  reservas: leer('horizonte.reservas', {}), // lo que sobra de una misión de la campaña pasa a la siguiente
  notas: leer('horizonte.notas', {}),
  historial: leer('horizonte.historial', []), // cada intento terminado (para el informe del comandante)
  rec: { ...R.estadoInicial(), ...leer('horizonte.recompensas', {}) },
  introVista: leer('horizonte.intro', false),
  coachVisto: {},
  tripulacion: leer('horizonte.tripulacion', R.TRIPULACION_INICIAL.map((x) => ({ ...x }))),
  actualizado: leer('horizonte.actualizado', 0), // última vez que cambió el progreso (para sincronizar con el servidor)
  prediccion: null,
  aula: leer('horizonte.modoAula', { activo: false, tranquilo: false }), // modo aula (enlace del docente)
  mundo: null,
};

function leer(clave, porDefecto) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
}
const CLAVES_PROGRESO = ['horizonte.recompensas', 'horizonte.tripulacion', 'horizonte.progreso', 'horizonte.historial', 'horizonte.notas', 'horizonte.evaluacion', 'horizonte.reservas'];
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: el juego sigue */ }
  if (CLAVES_PROGRESO.includes(clave) && !G.restaurando) cambioProgreso();
}

// ── Progreso en el servidor (por aula + nombre): no se pierde al cambiar de celular ──
function cambioProgreso() {
  G.actualizado = Date.now();
  try { localStorage.setItem('horizonte.actualizado', JSON.stringify(G.actualizado)); } catch { /* sin almacenamiento */ }
  clearTimeout(G.sincronizando);
  G.sincronizando = setTimeout(subirProgreso, 1500);
}

function subirProgreso() {
  const { aula, nombre } = G.jugador;
  if (!aula || !nombre || G.demo) return;
  api.guardarProgreso(aula, nombre, {
    rec: G.rec, tripulacion: G.tripulacion, progreso: G.progreso, historial: G.historial.slice(-150), notas: G.notas, eval: G.eval, reservas: G.reservas,
  }, G.actualizado);
}

/** Si el servidor tiene un progreso más nuevo (otro celular), lo usa; si el de aquí es más nuevo, lo sube. */
async function restaurarProgreso() {
  const { aula, nombre } = G.jugador;
  if (!aula || !nombre || G.demo) return;
  const r = await api.leerProgreso(aula, nombre);
  if (!r) return;
  if (!r.datos || r.actualizado < G.actualizado) { if (G.actualizado) subirProgreso(); return; }
  if (r.actualizado === G.actualizado) return;
  const d = r.datos;
  G.restaurando = true;
  G.rec = { ...R.estadoInicial(), ...(d.rec || {}) };
  G.tripulacion = d.tripulacion || G.tripulacion;
  G.progreso = d.progreso || {};
  G.historial = d.historial || [];
  G.notas = d.notas || {};
  G.eval = d.eval || G.eval;
  G.reservas = d.reservas || {};
  for (const [k, v] of [['recompensas', G.rec], ['tripulacion', G.tripulacion], ['progreso', G.progreso], ['historial', G.historial], ['notas', G.notas], ['evaluacion', G.eval], ['reservas', G.reservas]]) guardar(`horizonte.${k}`, v);
  G.restaurando = false;
  G.actualizado = r.actualizado;
  try { localStorage.setItem('horizonte.actualizado', JSON.stringify(G.actualizado)); } catch { /* sin almacenamiento */ }
  aplicarPersonalizacion();
  if (document.body.dataset.pantalla === 'portada') inicio();
  const aviso = document.createElement('div');
  aviso.className = 'aviso-insignia';
  aviso.setAttribute('role', 'status');
  aviso.innerHTML = `<span class="medalla">${I('ok')}</span><span><small>${esc(G.jugador.nombre)} · ${esc(G.jugador.aula)}</small><b>${t('Recuperamos tu progreso')}</b></span>`;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 4200);
}

// ───────────────────────── Mundo (3D o, si no hay WebGL, SVG) ─────────────────────────
let ultimoSVG = {};
function pintar(o, vista) {
  G.ultimoPintar = { o: { ...(G.ultimoPintar?.o || {}), ...o }, vista: vista || G.ultimoPintar?.vista };
  if (G.mundo) {
    G.mundo.actualizar(o);
    if (vista && vista !== G.mundo.modo) G.mundo.vista(vista);
    return;
  }
  ultimoSVG = { ...ultimoSVG, ...o };
  $svg.hidden = false;
  $svg.innerHTML = escenaSVG({ ...ultimoSVG, etiquetas: vista === 'diseno' });
}
const resaltar = (tipo) => G.mundo?.resaltar(tipo);

async function iniciarMundo() {
  try {
    if (leer('horizonte.vista', '') === '2d') throw new Error('ligero');
    const { Mundo, soportaWebGL } = await import('./mundo3d.js');
    if (!soportaWebGL()) throw new Error(`sin WebGL${soportaWebGL.motivo ? ': ' + soportaWebGL.motivo : ''}`);
    G.mundo = new Mundo(document.getElementById('mundo'), document.getElementById('etiquetas'));
    A.aplicar(G.mundo);
    G.mundo.alTocar((tipo) => fichaModulo(tipo));
    G.mundo.alVisitar = (id) => { if (!G.rec.visitados.includes(id)) { G.rec.visitados.push(id); guardarRec(); revisarInsignias(); } };
    aplicarPersonalizacion();
  } catch (err) {
    console.warn('Modo 2D:', err);
    G.motivo2D = err.message || String(err);
    document.getElementById('mundo').hidden = true;
    document.body.classList.add('modo-2d');
  }
}

/** Cambia a la vista 2D ligera EN CALIENTE: la misión, el día, el diseño y la predicción siguen igual (no se recarga). */
function pasarA2D() {
  if (!G.mundo) return;
  try { G.mundo.pausar?.(); } catch { /* sin 3D */ }
  G.mundo = null;
  G.motivo2D = 'ligero';
  guardar('horizonte.vista', '2d'); // las próximas veces arranca en 2D
  for (const id of ['mundo', 'etiquetas', 'puntos']) { const el = document.getElementById(id); if (el) el.hidden = true; }
  document.getElementById('ficha-modulo')?.remove();
  document.body.classList.add('modo-2d');
  if (G.ultimoPintar) pintar(G.ultimoPintar.o, G.ultimoPintar.vista);
  const aviso = document.createElement('div');
  aviso.className = 'aviso-insignia';
  aviso.setAttribute('role', 'status');
  aviso.innerHTML = `<span class="medalla">${I('ok')}</span><span><b>${t('Vista ligera activada')}</b><small>${t('Tu misión sigue igual: mismo día, mismo diseño.')}</small></span>`;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 4200);
}

// Si el 3D no arranca (o la tarjeta gráfica lo pierde), se explica por qué y se ofrece reintentar.
function avisoModo2D() {
  if (!document.body.classList.contains('modo-2d') || document.getElementById('aviso-2d')) return;
  const ligero = G.motivo2D === 'ligero';
  const sinWebGL = /WebGL/i.test(G.motivo2D || '');
  const bloqueado = /block|bloque/i.test(G.motivo2D || '');
  const a = document.createElement('div');
  a.id = 'aviso-2d';
  a.innerHTML = `<b>${t('Vista 2D')}</b> <span>${ligero ? t('Elegiste la vista ligera para que el juego vaya fluido en este equipo.') : bloqueado ? t('Chrome bloqueó el 3D en este sitio después de un fallo de la tarjeta gráfica. Cierra Chrome por completo, vuelve a abrirlo y recarga.') : sinWebGL ? t('Tu navegador no tiene el 3D activo. En Chrome: Configuración → Sistema → «Usar aceleración de gráficos», y recarga.') : t('El 3D no pudo iniciar en este equipo ({x}).', { x: esc(G.motivo2D || '?') })}</span>
    <button class="secundario" id="reintentar3d">${ligero ? t('Volver al 3D') : t('Reintentar 3D')}</button><button class="fantasma" id="cerrar2d" aria-label="${t('Cerrar')}">${I('cerrar')}</button>`;
  document.body.appendChild(a);
  a.querySelector('#reintentar3d').addEventListener('click', () => {
    if (['mision', 'resultado', 'viaje'].includes(document.body.dataset.pantalla) && !confirm(t('Para volver al 3D hay que recargar el juego. Tu misión en curso se reiniciará (tus créditos e insignias se guardan). ¿Continuar?'))) return;
    guardar('horizonte.vista', ''); location.reload();
  });
  a.querySelector('#cerrar2d').addEventListener('click', () => a.remove());
}
// Si el 3D va muy lento aun con la calidad al mínimo, se ofrece (una vez) la vista 2D ligera.
window.addEventListener('mundo-calidad', (ev) => {
  if (G.demo || ev.detail.escalon < 3 || ev.detail.fps >= 12 || G.ofrecio2D || leer('horizonte.avisoLento', false) || document.getElementById('aviso-lento')) return;
  G.ofrecio2D = true;
  guardar('horizonte.avisoLento', true); // una sola vez por equipo
  const a = document.createElement('div');
  a.id = 'aviso-lento';
  a.setAttribute('role', 'status');
  a.innerHTML = `<b>${t('Tu equipo va lento con el 3D')}</b> <span>${t('Bajamos los efectos. Si aún va lento, usa la vista 2D ligera: el juego es el mismo.')}</span>
    <button class="secundario" id="usar2d">${t('Usar vista 2D')}</button><button class="fantasma" id="seguir3d">${t('Seguir en 3D')}</button>`;
  document.body.appendChild(a);
  a.querySelector('#usar2d').addEventListener('click', () => { a.remove(); pasarA2D(); });
  a.querySelector('#seguir3d').addEventListener('click', () => a.remove());
  setTimeout(() => a.remove(), 12000);
});
window.addEventListener('mundo-perdido', () => {
  G.motivo2D = t('la tarjeta gráfica se reinició');
  document.body.classList.add('modo-2d');
  document.getElementById('mundo').hidden = true;
  G.mundo = null;
  avisoModo2D();
});

async function cargar() {
  const [nasa, juego, misiones, evaluacion] = await Promise.all([
    leerJson('nasa.json'), leerJson('juego.json'), leerJson('misiones.json'), leerJson('evaluacion.json'), iniciarMundo(),
  ]);
  G.juego = juego;
  G.orig = { nasa, misiones, evaluacion };
  await cargarIdioma();
  leerEnlaceDocente();
  api.detectar().then(() => { vigilarPausa(); restaurarProgreso(); }); // en el VPS hay API; en GitHub Pages no, y el juego funciona igual
  A.aplicar(G.mundo);
  landing();
  avisoModo2D();
  if (new URLSearchParams(location.search).has('demo')) demo();
}

// ───────────────────────── Landing (primera pantalla) ─────────────────────────
function landing() {
  document.getElementById('ficha-modulo')?.remove();
  callar();
  pintar({ config: { panel: 8, bateria: 6, reactor: true, reciclador: true, invernadero: true, blindaje: 1 }, luz: true, carga: 0.9, tripulacion: 4, tormenta: false, polvo: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true, planeta: 'luna' }, 'portada');
  mostrarLanding({
    app: $app, mundo: G.mundo, misiones: G.misiones, nasa: G.nasa,
    alJugar: inicio, alHistoria: () => historia(),
    alCambiarIdioma: async () => { setIdioma(getIdioma() === 'es' ? 'en' : 'es'); G.historia = null; await cargarIdioma(); landing(); },
  });
}

// ───────────────────────── Modo demo (?demo=1) ─────────────────────────
// Para grabar el video: siempre la misma historia (~50 s). No guarda progreso ni envía resultados. Esc lo detiene.
async function demo() {
  G.demo = true;
  G.eval.saltoInicial = true;
  const q = new URLSearchParams(location.search);
  const lento = Number(q.get('ritmo')) || 1; // ?demo=1&ritmo=1.5 para ir más lento
  let parar = false;
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') parar = true; });
  const espera = (ms) => new Promise((r, x) => setTimeout(() => (parar ? x(new Error('demo detenida')) : r()), ms * lento));
  const clic = async (sel, ms = 900) => { const el = document.querySelector(sel); if (!el) throw new Error(`demo: falta ${sel}`); el.focus?.(); await espera(250); el.click(); await espera(ms); };
  const hastaMision = async () => { for (let i = 0; i < 80 && !document.getElementById('dia1'); i++) await espera(250); };
  const avanzarHasta = async (fin, paso = 650) => { for (let i = 0; i < 60 && !fin(); i++) { const b = document.getElementById('dia1'); if (!b) break; b.click(); await espera(paso); } };
  try {
    // 1. Landing con el recorrido de cámara
    await espera(2500);
    const l = document.getElementById('landing');
    for (let i = 1; i <= 30; i++) { l.scrollTop = (l.scrollHeight - l.clientHeight) * 0.24 * (i / 30); await espera(70); }
    await espera(1500);
    l.scrollTop = 0; await espera(600);
    await clic('#lJugar', 1800);
    // 1b. El globo con los lugares reales y el vestidor de la tripulación
    await clic('#globoBtn', 4200);
    await clic('#globoVolver', 900);
    await clic('#tripulacionBtn', 4200);
    await clic('#vestidorVolver', 900);
    // 2. Misión 1 con el diseño sugerido (falla en la noche lunar)
    const i1 = G.misiones.findIndex((m) => m.id === 'noche');
    await clic(`[data-mision="${i1}"]`, 2200);
    await clic('#entendido', 1200);
    await clic('#lanzar', 1500);
    await clic('[data-pred="agua"]', 600);
    await hastaMision();
    await avanzarHasta(() => document.querySelector('.modal'));
    await espera(4500);
    // 3. Rediseñar: reactor de fisión, menos paneles, sin baterías
    await clic('#redisenar', 1200);
    Object.assign(G.config, { panel: 3, bateria: 0, reactor: true, blindaje: 1, reciclador: true, invernadero: false, o2: 10, agua: 175, comida: 185 });
    construir(); resaltar('reactor'); sfx.modulo();
    await espera(2500);
    await clic('#lanzar', 1500);
    await clic('[data-pred="exito"]', 600);
    await hastaMision();
    for (let i = 0; i < 12 && !document.querySelector('.modal'); i++) { (document.getElementById('dia5') || document.getElementById('dia1')).click(); await espera(900); }
    await espera(6000);
  } catch (err) {
    console.info('Demo:', err.message);
  }
}

// ───────────────────────── Episodio 0: guía paso a paso ─────────────────────────
// Resalta un elemento y explica qué hacer. Los pasos avanzan con «Siguiente» o al tocar lo resaltado.
const PASOS_COACH = () => [
  // Diseño: primero conocer la pantalla y los controles
  { id: 'briefing', en: 'diseno', sel: '#entendido', txt: t('¡Hola, cadete! Soy Nebula y te voy a enseñar a jugar paso a paso. Primero lee la misión y toca «¡Entendido!».'), accion: true },
  { id: 'mapa', en: 'diseno', sel: '#mundo', txt: t('Este es el mapa 3D de tu base. Arrastra con el dedo (o el mouse) para girarlo y pellizca (o usa la rueda) para acercarte. Si tocas un módulo, te digo qué hace.') },
  { id: 'masa', en: 'diseno', sel: '.masa', txt: t('Esta barra es el peso del cohete. Todo lo que pongas pesa. Si se pone roja, el cohete no puede despegar.') },
  { id: 'cartas', en: 'diseno', sel: '.cartas', txt: t('Abajo están los módulos de tu base. Desliza la fila hacia los lados para verlos todos.') },
  { id: 'stepper', en: 'diseno', sel: '[data-carta="panel"] .stepper', txt: t('Con + agregas uno más y con − quitas uno. Por ejemplo, más paneles solares = más energía cuando hay Sol.') },
  { id: 'interruptor', en: 'diseno', sel: '.interruptor', txt: t('Estos interruptores prenden o apagan un módulo entero, como el reciclador de agua.') },
  { id: 'widgets', en: 'diseno', sel: '.widgets-diseno', txt: t('Aquí ves si tu base alcanza: energía de día y de noche, agua, comida y radiación. Verde = alcanza, rojo = no alcanza.'), si: () => !G.tutorialFallo },
  { id: 'datos', en: 'diseno', sel: '#deDonde', txt: t('Este botón te muestra de dónde sale cada número: todos son datos reales de la NASA.') },
  { id: 'ayuda', en: 'diseno', sel: '[data-ayuda]', txt: t('Si no sabes qué es algo, toca el signo «?»: la llama te explica cada cosa de la pantalla. Funciona en todas las pantallas.') },
  { id: 'lanzar1', en: 'diseno', sel: '#lanzar', txt: t('Lanza la misión tal como está. ¿Aguantará la noche?'), accion: true, si: () => !G.tutorialFallo },
  { id: 'predice', en: 'predice', sel: '.opciones', txt: t('Antes de lanzar, predice qué fallará primero. Si aciertas, ganas créditos estelares.'), accion: true },
  // Misión: cada barra y cada botón
  { id: 'recursos', en: 'mision', sel: '.recursos', txt: t('Estos son tus recursos. Si uno llega a cero, la base falla.') },
  { id: 'energia', en: 'mision', sel: '.recursos .recurso:nth-child(1)', txt: t('El rayo es la energía guardada en las baterías, en kWh.') },
  { id: 'vida', en: 'mision', sel: '.recursos .recurso:nth-child(2)', txt: t('Luego oxígeno, agua y comida: lo que necesitan los astronautas para vivir.') },
  { id: 'radiacion', en: 'mision', sel: '.recursos .recurso:nth-child(5)', txt: t('Esta es la radiación. Al revés que las demás, debe quedarse BAJA.') },
  { id: 'ciencia', en: 'mision', sel: '.recursos .recurso:nth-child(7)', txt: t('Y la ciencia: tienes que llegar a la meta de experimentos para cumplir la misión.') },
  { id: 'reloj', en: 'mision', sel: '.reloj-dia', txt: t('El reloj te dice qué día es y si hay Sol o es de noche.') },
  { id: 'avanzar', en: 'mision', sel: '#dia1', txt: t('Toca AVANZAR para pasar un día. Mira cómo cambian las barras.'), accion: true },
  { id: 'crono', en: 'mision', sel: '.cronoscopio', txt: t('Este es el Cronoscopio: cada día queda guardado. Si algo sale mal, puedes volver a un día pasado.'), si: () => actual().dia >= 1 },
  { id: 'habilidades', en: 'mision', sel: '.habilidades', txt: t('Estas son tus decisiones del día: Refugio protege de la radiación, Ración ahorra comida e Invernadero se puede apagar para ahorrar energía.'), si: () => actual().dia >= 1 },
  { id: 'bitacora', en: 'mision', sel: '#bitacora', txt: t('En la Bitácora queda escrito lo que pasó cada día.'), si: () => actual().dia >= 1 },
  { id: 'rapido', en: 'mision', sel: '#dia5', txt: t('Con ×5 avanzas cinco días seguidos. Se detiene solo si pasa algo importante.'), si: () => actual().dia >= 1 },
  { id: 'nebulaZona', en: 'mision', sel: '.zona-nebula', txt: t('Aquí te aviso lo que pasa. Y si necesitas ayuda, toca mi botón flotante: te doy una pista. Puedes arrastrarlo a donde quieras.'), si: () => actual().dia >= 1 },
  { id: 'mapa3d', en: 'mision', sel: '#mundo', txt: t('Toca los nombres en el mapa (cráteres, rover, antena) para visitarlos de cerca.'), si: () => actual().dia >= 1 },
  { id: 'noche', en: 'mision', sel: '.reloj-dia', txt: t('Se puso el Sol: los paneles ya no producen. Sigue avanzando y mira qué pasa.'), si: () => !S.hayLuz(G.mision, actual().dia, G.nasa) },
  // Resultado
  { id: 'causa', en: 'resultado-falla', sel: '.cadena', txt: t('Aquí está la causa: así ocurrió la falla, paso a paso. El error es la lección.') },
  { id: 'consejo', en: 'resultado-falla', sel: '.modal .nebula', txt: t('Y aquí te digo qué cambiar para la próxima vez.') },
  { id: 'rebobinarBtn', en: 'resultado-falla', sel: '#rebobinar', txt: t('Con este botón vuelves a un día pasado y cambias tus decisiones sin empezar de nuevo.') },
  { id: 'redisenar', en: 'resultado-falla', sel: '#redisenar', txt: t('Ahora rediseña la base para que aguante la noche.'), accion: true },
  { id: 'baterias', en: 'diseno', sel: '[data-mas="bateria"]', txt: t('Agrega baterías: guardan la energía del día para usarla de noche. Pon 2.'), accion: true, si: () => G.tutorialFallo && G.config.bateria < 2, repetir: true },
  { id: 'lanzar2', en: 'diseno', sel: '#lanzar', txt: t('¡Ahora sí! Lanza otra vez.'), accion: true, si: () => G.tutorialFallo && G.config.bateria >= 2 },
  { id: 'premio', en: 'resultado-exito', sel: '.premio', txt: t('¡Lo lograste! Ganaste créditos estelares. Úsalos en «Tripulación» para personalizar a tus astronautas y tu base.') },
  { id: 'nota', en: 'resultado-exito', sel: '#nota', txt: t('Escribe aquí una frase: ¿qué cambiaste para lograrlo? Tu docente la puede leer.') },
  { id: 'siguiente', en: 'resultado-exito', sel: '#sig', txt: t('¡Ya sabes jugar! Toca aquí para empezar la Misión 1. Recuerda: el «?» y mi botón siempre te ayudan.') },
];

function coach() {
  document.getElementById('coach')?.remove();
  if (G.mision?.id !== 'cero' || G.demo || G.coachSalteado || document.getElementById('recorrido')) return;
  const en = document.querySelector('.guia-pregunta') ? 'predice'
    : (document.body.dataset.pantalla === 'resultado' || document.querySelector('.hud-acciones')) ? (document.querySelector('.premio') && !document.querySelector('#redisenar') ? 'resultado-exito' : 'resultado-falla')
    : document.body.dataset.pantalla;
  const lista = PASOS_COACH();
  const paso = lista.find((p) => p.en === en && (!G.coachVisto[p.id] || p.repetir) && (!p.si || p.si()) && visibleEl(document.querySelector(p.sel)));
  if (!paso) return;
  const el = document.querySelector(paso.sel);
  const r = el.getBoundingClientRect();
  const capa = document.createElement('div');
  capa.id = 'coach';
  const abajo = r.top < innerHeight / 2;
  const grande = r.height > innerHeight * 0.5; // el mapa 3D: el globo va al centro
  const n = Math.min(lista.length, lista.filter((p) => G.coachVisto[p.id]).length + 1);
  capa.innerHTML = `<div class="coach-foco" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${Math.min(r.height, innerHeight - 12) + 12}px"></div>
    <div class="coach-globo ${abajo ? 'abajo' : 'arriba'}" role="dialog" aria-live="polite" style="left:${Math.max(12, Math.min(innerWidth - 332, r.left + r.width / 2 - 160))}px;${grande ? `top:${innerHeight * 0.32}px` : abajo ? `top:${Math.min(innerHeight - 190, r.bottom + 14)}px` : `bottom:${Math.min(innerHeight - 190, innerHeight - r.top + 14)}px`}">
      <div class="coach-cara">${CARA_NEBULA}</div><p>${paso.txt}</p>
      <div class="fila"><span class="coach-n">${t('Paso {n} de {t}', { n, t: lista.length })}</span>${paso.accion ? `<small class="suave">${t('Toca lo resaltado')}</small>` : `<button class="primario chico" id="coachSig">${t('Siguiente')} →</button>`}<button class="fantasma chico" id="coachSaltar">${t('Pausar guía')}</button></div>
    </div>`;
  document.body.appendChild(capa);
  A.anunciar(paso.txt);
  leerEnVoz(paso.txt);
  const marcar = () => { G.coachVisto[paso.id] = true; };
  capa.querySelector('#coachSig')?.addEventListener('click', () => { marcar(); coach(); });
  // Pausar no borra la guía: tocando a Nebula (botón flotante) sigue donde quedó
  capa.querySelector('#coachSaltar').addEventListener('click', () => { G.coachSalteado = true; capa.remove(); callar(); });
  if (paso.accion) el.addEventListener('click', () => { marcar(); setTimeout(coach, 350); }, { once: true, capture: true });
}
const visibleEl = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
addEventListener('resize', () => { if (document.getElementById('coach')) coach(); });

// ───────────────────────── Introducción rápida, guía y personajes ─────────────────────────
function introRapida(i = 0) {
  const pasos = [
    [personaje('astronauta', 'retrato-grande'), t('Eres el comandante'), t('Eres el astronauta peruano al mando de una expedición que va de la Luna a Marte. Tu trabajo: que tu tripulación sobreviva.')],
    [personaje('gato-piloto', 'retrato-grande'), t('Diseña, predice y avanza'), t('Arma tu base, predice qué fallará primero y adelanta el tiempo día por día. Nebula, el gato piloto, te da pistas.')],
    [personaje('llama-astronauta', 'retrato-grande'), t('El error es la lección'), t('Si algo falla, verás la causa con datos reales de NASA y podrás volver atrás con el Cronoscopio. Nunca hay game over.')],
  ];
  const [img, titulo, texto] = pasos[i];
  const c = modal();
  c.innerHTML = `<div class="intro-rapida">${img}<p class="lema">${t('Introducción rápida')} · ${i + 1}/3</p><h2>${titulo}</h2><p>${texto}</p>
    <div class="puntos-historia" aria-hidden="true">${pasos.map((_, k) => `<span class="${k === i ? 'actual' : ''}"></span>`).join('')}</div>
    <div class="fila">${i < 2 ? `<button class="primario" id="introSig">${t('Siguiente')} →</button><button class="fantasma" id="introSaltar">${t('Saltar')}</button>`
      : `<button class="primario" id="introCero">${I('cohete')} ${t('Jugar el Episodio 0')}</button><button class="secundario" id="introGuia">${I('info')} ${t('Ver la guía')}</button>`}</div></div>`;
  c.querySelector('#introSig')?.addEventListener('click', () => introRapida(i + 1));
  c.querySelector('#introSaltar')?.addEventListener('click', inicio);
  c.querySelector('#introGuia')?.addEventListener('click', () => guia());
  c.querySelector('#introCero')?.addEventListener('click', () => { G.mision = G.misiones.find((m) => m.id === 'cero'); G.config = S.configInicial(G.mision); G.rebobinados = 0; G.tutorialFallo = false; G.coachVisto = {}; G.coachSalteado = false; construir(); });
}

function guia() {
  document.body.dataset.pantalla = 'modal';
  const ficha = (ic, nombre, txt) => `<div class="guia-item"><span class="guia-ico">${I(ic)}</span><div><b>${nombre}</b><p>${txt}</p></div></div>`;
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <p class="lema">${t('Guía del juego')}</p><h2>${I('info')} ${t('¿Qué estás jugando?')}</h2>
    <p>${t('ASU STELLAR · Horizonte es un simulador de bases espaciales. Diriges una base en la Luna y luego en Marte: eliges qué módulos llevar en el cohete, decides cada día y aprendes por qué una base falla, con datos reales de NASA.')}</p>
    <h3>${t('Cómo se juega')}</h3>
    <ol class="guia-pasos">
      <li><b>${t('Diseña')}</b> — ${t('elige paneles, baterías, reactor, reciclador, invernadero, blindaje y provisiones, sin pasarte de la masa del cohete.')}</li>
      <li><b>${t('Predice')}</b> — ${t('antes de lanzar, di qué crees que fallará primero.')}</li>
      <li><b>${t('Avanza')}</b> — ${t('cada día puedes activar el refugio, reducir la ración o apagar el invernadero.')}</li>
      <li><b>${t('Mira la causa')}</b> — ${t('si la base falla, ves la cadena causa → efecto y el dato de NASA que la explica.')}</li>
      <li><b>${t('Rebobina')}</b> — ${t('con el Cronoscopio vuelves a un día pasado y cambias una decisión, o rediseñas la base.')}</li>
      <li><b>${t('Cuéntalo')}</b> — ${t('al ganar, escribe en tu bitácora qué cambiaste.')}</li>
    </ol>
    <h3>${t('Tus recursos (arriba)')}</h3>
    <div class="guia-grid">
      ${ficha('energia', t('Energía'), t('La producen los paneles (solo con luz) y el reactor. Las baterías la guardan para la noche.'))}
      ${ficha('o2', t('Oxígeno'), t('Se fabrica partiendo agua con energía. Sin energía, no hay oxígeno nuevo.'))}
      ${ficha('agua', t('Agua'), t('Para beber, cocinar y fabricar oxígeno. El reciclador recupera casi toda.'))}
      ${ficha('comida', t('Comida'), t('Cada astronauta come unos 1,5 kg al día. El invernadero produce una parte.'))}
      ${ficha('radiacion', t('Radiación'), t('Se suma cada día. El blindaje y el refugio protegen. No pases el límite.'))}
      ${ficha('salud', t('Salud'), t('Baja si la tripulación come poco muchos días seguidos.'))}
      ${ficha('ciencia', t('Ciencia'), t('Cada día fuera del refugio suman ciencia. Hay que llegar a la meta de la misión.'))}
    </div>
    <h3>${t('Los módulos de tu base')}</h3>
    <div class="guia-grid">
      ${ficha('panel', t('Paneles solares'), t('Producen energía solo cuando hay luz del Sol.'))}
      ${ficha('bateria', t('Baterías'), t('Guardan la energía que sobra de día para usarla de noche o en una tormenta.'))}
      ${ficha('reactor', t('Reactor'), t('Da energía de día y de noche, sin depender del Sol.'))}
      ${ficha('reciclador', t('Reciclador'), t('Limpia y recupera casi toda el agua que usa la tripulación.'))}
      ${ficha('invernadero', t('Invernadero'), t('Produce parte de la comida, pero gasta agua y energía.'))}
      ${ficha('blindaje', t('Blindaje'), t('Capa de regolito que protege de la radiación todos los días, pero pesa.'))}
      ${ficha('extractor', t('Extractor de hielo'), t('Saca agua del hielo escondido en el suelo.'))}
      ${ficha('moxie', 'MOXIE', t('Fabrica oxígeno a partir del CO₂ del aire de Marte, sin gastar agua.'))}
    </div>
    <h3>${t('Decisiones de cada día')}</h3>
    <div class="guia-grid">
      ${ficha('refugio', t('Refugio'), t('Protege 90 % de la radiación de tormenta; ese día no hay ciencia'))}
      ${ficha('racion', t('Ración'), t('Comen 20 % menos; baja la salud'))}
      ${ficha('invernadero', t('Invernadero'), t('Apágalo para ahorrar energía y agua'))}
    </div>
    <h3>${t('Lo demás')}</h3>
    <div class="guia-grid">
      ${ficha('cronoscopio', t('Cronoscopio'), t('La línea de días de abajo. Toca un día pasado para volver a él.'))}
      ${ficha('predecir', t('Predice'), t('Antes de cada lanzamiento eliges qué fallará. Acertar da créditos.'))}
      ${ficha('caja', t('Reserva'), t('Lo que sobra de una misión de la campaña pasa a la siguiente, sin pesar en el cohete.'))}
      ${ficha('estrella', t('Créditos e insignias'), t('Se ganan al cumplir misiones, predecir bien, no rebobinar y aprender de un error. Sirven para personalizar tu tripulación y tu base.'))}
      ${ficha('datos', t('Datos de NASA'), t('Cada número tiene fuente. Las etiquetas dicen si es dato de NASA, caso histórico o valor del juego.'))}
      ${ficha('lugar', t('Explorar el mapa'), t('Toca un módulo, un objeto o un marcador del mapa para acercarte y ver su ficha.'))}
    </div>
    <div class="fila"><button class="primario" id="guiaCero">${I('cohete')} ${t('Jugar el Episodio 0')}</button><button class="secundario" id="guiaVolver">${t('Menú')}</button></div>`;
  c.querySelector('#guiaVolver').addEventListener('click', inicio);
  c.querySelector('#guiaCero').addEventListener('click', () => { G.mision = G.misiones.find((m) => m.id === 'cero'); G.config = S.configInicial(G.mision); G.rebobinados = 0; G.tutorialFallo = false; G.coachVisto = {}; G.coachSalteado = false; construir(); });
}

function personajes() {
  document.body.dataset.pantalla = 'modal';
  const p = (img, nombre, rol, txt) => `<figure class="personaje-carta"><img src="assets/marca/${img}.webp" alt="" loading="lazy"><figcaption><b>${nombre}</b><span class="rol">${rol}</span><p>${txt}</p></figcaption></figure>`;
  const color = (id) => `#${R.CATALOGO.find((x) => x.id === id).color.toString(16).padStart(6, '0')}`;
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <p class="lema">${t('Galería')}</p><h2>${I('persona')} ${t('Personajes de la expedición')}</h2>
    <div class="personajes-grid">
      ${p('astronauta', t('Astronauta peruano'), t('Protagonista · tú'), t('Comandas la expedición. Tomas las decisiones de diseño y de cada día, y explicas qué cambiaste en tu bitácora.'))}
      ${p('astronauta-peruana', t('Astronauta peruana'), t('Guía de misión'), t('Enseña con preguntas: antes de cada lanzamiento te pide que predigas qué fallará primero.'))}
      ${p('gato-piloto', t('Nebula, el gato piloto'), t('Viajes y pistas'), t('Pilota la nave de la Luna a Marte, te habla en voz alta y te da pistas en las misiones de la campaña.'))}
      ${p('llama-astronauta', t('Llama astronauta'), t('Ciencia y logros'), t('Presenta las fichas con datos de NASA y celebra cuando cumples una misión.'))}
    </div>
    <h3>${t('Tu tripulación')}</h3>
    <p class="suave chico">${t('Los cuatro astronautas que ves caminar por la base. Sus nombres están en quechua: Killa (luna), Inti (sol), Wayra (viento) y Sami (suerte). Puedes cambiar sus nombres y colores en «Tripulación».')}</p>
    <div class="tripulacion-mini">${G.tripulacion.map((a) => `<div class="astro-carta" style="--traje:${color(a.traje)};--acento:${color(a.acento)};--visor:${color(a.visor)}"><div class="astro-figura" aria-hidden="true"><i class="casco"><i class="visor"></i></i><i class="cuerpo"><i class="cinto"></i></i></div><b>${esc(a.nombre)}</b></div>`).join('')}</div>
    <div class="fila"><button class="primario" id="perTrip">${I('tripulacion')} ${t('Personalizar tripulación')}</button><button class="secundario" id="perVolver">${t('Menú')}</button></div>`;
  c.querySelector('#perTrip').addEventListener('click', () => pantallaTripulacion());
  c.querySelector('#perVolver').addEventListener('click', inicio);
}

// ───────────────────────── Recompensas, tripulación y objetos ─────────────────────────
function guardarRec() { guardar('horizonte.recompensas', G.rec); }

function coloresDe(a) {
  const color = (id) => R.CATALOGO.find((x) => x.id === id)?.color;
  return { traje: color(a.traje), acento: color(a.acento), visor: color(a.visor), parche: a.parche || 'parche-peru', accesorio: a.accesorio || 'acc-ninguno' };
}
function coloresTripulacion() {
  return tripulacionActiva().map(coloresDe);
}

function aplicarPersonalizacion() {
  try {
    G.mundo?.vestir(coloresTripulacion());
    G.mundo?.objetos(G.rec.objetos);
  } catch (err) { console.warn('Personalización 3D:', err); } // nunca debe tumbar el 3D
}

/** Suma los créditos de la misión y revisa insignias. Devuelve lo ganado para mostrarlo. */
function darRecompensa(m, res, estrellas) {
  const intentos = G.historial.filter((x) => x.mision === m.id);
  const r = R.calcularRecompensa({
    exito: res.exito, estrellas, rebobinados: G.rebobinados, sinPistas: Boolean(m.sin_pistas),
    predijo: Boolean(G.prediccion), acerto: G.prediccion === (res.exito ? 'exito' : res.motivo),
    falloAntes: intentos.slice(0, -1).some((x) => !x.exito),
  });
  G.rec.creditos += r.total;
  guardarRec();
  return { ...r, insignias: revisarInsignias(false) };
}

/** Busca insignias nuevas; si `avisar`, las celebra con un aviso. */
function revisarInsignias(avisar = true) {
  const nuevas = R.nuevasInsignias({ historial: G.historial, progreso: G.progreso, visitados: G.rec.visitados, fichas: G.rec.fichas, notas: G.notas }, G.rec.insignias);
  if (!nuevas.length) return [];
  G.rec.insignias.push(...nuevas);
  G.rec.creditos += nuevas.length * 10; // cada insignia trae 10 créditos
  guardarRec();
  if (avisar) for (const id of nuevas) avisoInsignia(id);
  return nuevas;
}

function avisoInsignia(id) {
  const b = R.INSIGNIAS.find((x) => x.id === id);
  if (!b) return;
  const el = document.createElement('div');
  el.className = 'aviso-insignia';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="medalla">${I(b.icono)}</span><span><small>${t('¡Nueva insignia!')} · +10 ${I('estrella')}</small><b>${t(b.nombre)}</b></span>`;
  document.body.appendChild(el);
  A.anunciar(`${t('¡Nueva insignia!')} ${t(b.nombre)}`);
  setTimeout(() => el.remove(), 4200);
}

function bloquePremio(p) {
  if (!p) return '';
  return `<div class="premio">
    <div class="premio-total">${I('estrella')} <b>+${p.total + p.insignias.length * 10}</b> <span>${t('créditos estelares')}</span> <small>${t('Total: {n}', { n: G.rec.creditos })}</small></div>
    <ul>${p.desglose.map((d) => `<li>${t(d.texto)}${d.n ? ` ×${d.n}` : ""} <b>+${d.creditos}</b></li>`).join('')}${p.insignias.map((id) => `<li class="nueva">${I(R.INSIGNIAS.find((x) => x.id === id).icono)} ${t('Insignia')}: ${t(R.INSIGNIAS.find((x) => x.id === id).nombre)} <b>+10</b></li>`).join('')}</ul>
    <button class="fantasma chico" id="irTripulacion">${I('tripulacion')} ${t('Personalizar tripulación y base')}</button>
  </div>`;
}

const chipCreditos = () => `<button class="chip-creditos" id="chipCreditos" aria-label="${t('Créditos estelares: {n}. Abrir tripulación', { n: G.rec.creditos })}">${I('estrella')} ${G.rec.creditos}</button>`;

/** Pantalla de la tripulación: personalizar astronautas, comprar y colocar objetos, ver insignias. */
function abrirMision(m) {
  const empezar = () => { G.mision = m; G.config = S.configInicial(m); G.rebobinados = 0; G.tutorialFallo = false; G.coachVisto = {}; G.coachSalteado = false; construir(); };
  if (!G.eval.inicial && !G.eval.saltoInicial) pruebaInicial(empezar); else empezar();
}

// ───────────────────────── Globo de la Luna y de Marte ─────────────────────────
// Coordenadas reales (grados) de los lugares de cada misión.
const COORDENADAS = {
  noche: [0.67, 23.47], // Mar de la Tranquilidad (Apolo 11)
  amanecer: [-88.5, -20], // región del polo sur (Artemis)
  tormenta: [-89.67, 129.78], // cráter Shackleton
  hielo: [-84.9, -35.5], // cráter Cabeus (LCROSS)
  cadena: [32.8, -15.6], // Mar de las Lluvias (Imbrium)
  marte: [18.38, 77.58], // cráter Jezero (Perseverance)
  tormenta_marte: [-5.4, 137.8], // cráter Gale (Curiosity)
};
let globo3d = null;

function globo(planeta = 'luna', elegida = null) {
  document.body.dataset.pantalla = 'globo';
  const lista = G.misiones.filter((m) => COORDENADAS[m.id] && (m.planeta || 'luna') === planeta);
  const sel = lista.find((m) => m.id === elegida) || lista[0];
  const ficha = (m) => {
    const est = G.progreso[m.id] || 0;
    return `<p class="lema">${I('lugar')} ${esc(m.lugar)} · ${COORDENADAS[m.id].map((v, i) => `${Math.abs(v).toFixed(1)}° ${i ? (v >= 0 ? 'E' : 'O') : v >= 0 ? 'N' : 'S'}`).join(' ')}</p>
      <h3>${esc(m.titulo)}</h3><p class="suave">${esc(m.resumen || '')}</p>
      <div class="entre"><span class="estrellas-res chico">${'★'.repeat(est)}<span>${'★'.repeat(3 - est)}</span></span>
      <button class="primario" id="globoJugar">${I('cohete')} ${t('Jugar esta misión')}</button></div>`;
  };
  globo3d?.destruir(); globo3d = null;
  $app.innerHTML = `
    <section class="globo-pantalla" aria-label="${t('La Luna y Marte en globo')}">
      <header class="vestidor-cabecera">
        <button class="boton-icono" id="globoVolver" aria-label="${t('Volver')}">${I('volver')}</button>
        ${botonAyuda()}
        <div><p class="lema">${t('Explora')}</p><h2>${planeta === 'marte' ? t('Marte') : t('La Luna')}</h2></div>
        <div class="vestidor-cats" role="tablist" style="margin-left:auto">
          <button role="tab" aria-selected="${planeta === 'luna'}" data-planeta="luna">${t('La Luna')}</button>
          <button role="tab" aria-selected="${planeta === 'marte'}" data-planeta="marte">${t('Marte')}</button></div>
      </header>
      <div class="globo-cuerpo">
        <div class="globo-escena" id="globoEscena">${G.mundo ? '' : `<ul class="globo-lista">${lista.map((m) => `<li><button data-lugar="${m.id}">${esc(m.lugar)}</button></li>`).join('')}</ul>`}<div class="globo-etiquetas" id="globoEtiquetas"></div>
          ${G.mundo ? `<small class="pista-girar">${I('mano')} ${t('Arrastra para girar · toca un lugar')}</small>` : ''}</div>
        <aside class="globo-ficha" id="globoFicha" aria-live="polite">${sel ? ficha(sel) : ''}</aside>
      </div>
      <p class="suave chico">${t('Mapa simplificado: los mares, cráteres y volcanes principales están en su lugar real; los colores no son una foto.')}</p>
    </section>`;
  const elegir = (id) => {
    const m = lista.find((x) => x.id === id);
    if (!m) return;
    $app.querySelector('#globoFicha').innerHTML = ficha(m);
    $app.querySelector('#globoJugar').addEventListener('click', () => { globo3d?.destruir(); globo3d = null; G.mundo?.reanudar?.(); abrirMision(m); });
    sfx.abrir?.();
  };
  if (sel) elegir(sel.id);
  $app.querySelector('#globoVolver').addEventListener('click', () => { globo3d?.destruir(); globo3d = null; G.mundo?.reanudar?.(); inicio(); });
  $app.querySelectorAll('[data-planeta]').forEach((b) => b.addEventListener('click', () => globo(b.dataset.planeta)));
  $app.querySelectorAll('[data-lugar]').forEach((b) => b.addEventListener('click', () => elegir(b.dataset.lugar)));
  if (G.mundo) {
    G.mundo.pausar?.();
    import('./globo3d.js').then(({ crearGlobo }) => {
      if (document.body.dataset.pantalla !== 'globo') return;
      globo3d = crearGlobo($app.querySelector('#globoEscena'), $app.querySelector('#globoEtiquetas'), { alElegir: elegir });
      globo3d.mostrar(planeta, lista.map((m) => ({ id: m.id, lat: COORDENADAS[m.id][0], lon: COORDENADAS[m.id][1], titulo: esc(sinNumero(m.titulo)), lugar: esc(m.lugar), estrellas: G.progreso[m.id] || 0 })));
      if (sel) globo3d.enfocar(sel.id, false);
    }).catch((err) => console.warn('Globo 3D:', err));
  }
}

// ───────────────────────── Vestidor de la tripulación ─────────────────────────
// Pantalla grande: el astronauta en 3D sobre un pedestal y, al lado, trajes, franjas, visores, parches y accesorios.
// Lo bloqueado muestra su precio en créditos. En el Episodio 0 todo se puede probar gratis (probador).
const CATEGORIAS = [['traje', 'Traje'], ['acento', 'Franjas'], ['visor', 'Visor'], ['parche', 'Parche'], ['accesorio', 'Accesorio']];
const ICONO_ACC = { 'acc-ninguno': 'cerrar', 'acc-bufanda': 'tripulacion', 'acc-luces': 'sol', 'acc-antena': 'antena', 'acc-orejas': 'nebula', 'acc-capitan': 'estrella', 'acc-jetpack': 'cohete' };
const POR_DEFECTO = { parche: 'parche-peru', accesorio: 'acc-ninguno' };
const hex = (n) => `#${(n ?? 0).toString(16).padStart(6, '0')}`;
let vestidor3d = null, miniaturasParche = null;

function tripulacionActiva() { return G.tripulacionPrueba || G.tripulacion; }

function pantallaTripulacion(aviso = '', opciones = {}) {
  const probador = Boolean(opciones.probador ?? G.vestidor?.probador);
  G.vestidor = { astro: G.vestidor?.astro ?? 0, cat: G.vestidor?.cat ?? 'traje', seccion: G.vestidor?.seccion ?? 'astros', probador, volver: opciones.volver ?? G.vestidor?.volver ?? inicio };
  if (probador && !G.tripulacionPrueba) G.tripulacionPrueba = structuredClone(G.tripulacion);
  const V = G.vestidor, crew = tripulacionActiva();
  document.body.dataset.pantalla = 'vestidor';
  const tiene = (id) => probador || G.rec.comprados.includes(id) || R.CATALOGO.find((x) => x.id === id)?.precio === 0;
  const a = crew[V.astro];
  const valor = (cat) => a[cat] || POR_DEFECTO[cat];
  const items = R.CATALOGO.filter((x) => x.tipo === V.cat);
  const vista = (it) => {
    if (V.cat === 'parche') return miniaturasParche?.[it.id] ? `<img src="${miniaturasParche[it.id]}" alt="" width="64" height="64">` : `<span class="parche-plano">${esc(t(it.nombre)).slice(0, 2)}</span>`;
    if (V.cat === 'accesorio') return `<span class="acc-ico">${I(ICONO_ACC[it.id] || 'estrella')}</span>`;
    return `<span class="color" style="--c:${hex(it.color)}"></span>`;
  };
  const tarjeta = (it) => {
    const mio = tiene(it.id), puesto = valor(V.cat) === it.id;
    return `<button class="pieza ${mio ? '' : 'bloqueada'} ${puesto ? 'puesta' : ''}" data-pieza="${it.id}" aria-pressed="${puesto}"
      aria-label="${t(it.nombre)}${mio ? '' : ` · ${t('{n} créditos', { n: it.precio })}`}">
      ${vista(it)}<b>${t(it.nombre)}</b>
      <small>${puesto ? `${I('check')} ${t('Puesto')}` : mio ? t('Ponérselo') : `${I('candado')} ${it.precio}`}</small></button>`;
  };
  const objetos = R.CATALOGO.filter((x) => x.tipo === 'objeto').map((it) => {
    const mio = G.rec.comprados.includes(it.id) || it.precio === 0, puesto = G.rec.objetos.includes(it.id);
    return `<div class="objeto-tienda ${mio ? '' : 'bloqueado'}"><b>${t(it.nombre)}</b>
      ${mio ? `<label class="casilla"><input type="checkbox" data-objeto="${it.id}" ${puesto ? 'checked' : ''}> ${t('En la base')}</label>` : `<button class="secundario chico" data-comprar="${it.id}">${I('estrella')} ${it.precio}</button>`}</div>`;
  }).join('');
  const insignias = R.INSIGNIAS.map((b) => { const ok = G.rec.insignias.includes(b.id); return `<div class="insignia ${ok ? 'ganada' : ''}" title="${t(b.desc)}"><span class="medalla">${I(ok ? b.icono : 'candado')}</span><b>${t(b.nombre)}</b><small>${t(b.desc)}</small></div>`; }).join('');
  const desbloqueadas = R.CATALOGO.filter((x) => x.tipo !== 'objeto' && G.rec.comprados.includes(x.id) && x.precio > 0).length;
  const totalPagas = R.CATALOGO.filter((x) => x.tipo !== 'objeto' && x.precio > 0).length;

  if (vestidor3d && !document.getElementById('vestidorEscena')) { vestidor3d.destruir(); vestidor3d = null; }
  if (V.seccion !== 'astros' && vestidor3d) { vestidor3d.destruir(); vestidor3d = null; }
  const reusar = vestidor3d && document.querySelector('.vestidor');
  const html = `
    <header class="vestidor-cabecera">
      <button class="boton-icono" id="vestidorVolver" aria-label="${t('Volver')}">${I('volver')}</button>
      <div><p class="lema">${probador ? t('Probador del Episodio 0') : t('Tu expedición')}</p><h2>${t('Vestidor de la tripulación')}</h2></div>
      <div class="creditos-grandes">${I('estrella')} <b>${G.rec.creditos}</b><small>${t('créditos estelares')}</small></div>
      ${botonAyuda()}
    </header>
    ${probador ? `<div class="aviso-probador">${I('estrella')} ${t('En el Episodio 0 puedes probar todos los trajes, parches y accesorios gratis. Al terminar el entrenamiento, tu tripulación vuelve a lo que ya desbloqueaste.')}</div>` : ''}
    ${aviso ? `<div class="toast alerta" role="status">${aviso}</div>` : ''}
    <nav class="vestidor-secciones" role="tablist">
      ${[['astros', 'tripulacion', 'Astronautas'], ['base', 'base', 'Objetos de la base'], ['insignias', 'estrella', 'Insignias']].map(([k, ic, n]) => `<button role="tab" aria-selected="${V.seccion === k}" data-seccion="${k}">${I(ic)} ${t(n)}</button>`).join('')}
    </nav>
    ${V.seccion === 'astros' ? `
    <div class="vestidor-cuerpo">
      <div class="vestidor-escena" id="vestidorEscena">
        ${G.mundo ? '' : `<div class="astro-figura grande" aria-hidden="true" style="--traje:${hex(R.CATALOGO.find((x) => x.id === a.traje)?.color)};--acento:${hex(R.CATALOGO.find((x) => x.id === a.acento)?.color)};--visor:${hex(R.CATALOGO.find((x) => x.id === a.visor)?.color)}"><i class="casco"><i class="visor"></i></i><i class="cuerpo"><i class="cinto"></i></i></div>`}
        <div class="vestidor-astros">${crew.map((x, i) => `<button class="${i === V.astro ? 'activo' : ''}" data-astro="${i}">${esc(x.nombre)}</button>`).join('')}</div>
        <label class="astro-nombre">${t('Nombre')} <input id="nombreAstro" maxlength="16" value="${esc(a.nombre)}"></label>
        ${G.mundo ? `<small class="pista-girar">${I('mano')} ${t('Arrastra para girarlo')}</small>` : ''}
      </div>
      <div class="vestidor-panel">
        <div class="vestidor-cats" role="tablist">${CATEGORIAS.map(([k, n]) => `<button role="tab" aria-selected="${V.cat === k}" data-cat="${k}">${t(n)}</button>`).join('')}</div>
        <div class="piezas">${items.map(tarjeta).join('')}</div>
        <p class="suave chico">${probador ? '' : t('Desbloqueaste {a} de {b} piezas. Ganas créditos al cumplir misiones, acertar predicciones, no rebobinar y aprender de un error.', { a: desbloqueadas, b: totalPagas })}</p>
      </div>
    </div>` : V.seccion === 'base' ? `<div class="objetos-grid">${objetos}</div>` : `<p class="suave">${G.rec.insignias.length}/${R.INSIGNIAS.length}</p><div class="insignias-grid">${insignias}</div>`}`;

  if (reusar && V.seccion === 'astros') {
    // Solo redibuja el panel y la cabecera, sin recrear la escena 3D (no parpadea)
    const cont = document.querySelector('.vestidor');
    cont.innerHTML = html;
    vestidor3d.mover(document.getElementById('vestidorEscena'));
  } else {
    vestidor3d?.destruir(); vestidor3d = null;
    $app.innerHTML = `<section class="vestidor" aria-label="${t('Vestidor de la tripulación')}">${html}</section>`;
    if (V.seccion === 'astros' && G.mundo) {
      G.mundo.pausar?.();
      import('./vestidor3d.js').then(({ crearVestidor }) => {
        const cont = document.getElementById('vestidorEscena');
        if (!cont || vestidor3d) return;
        vestidor3d = crearVestidor(cont);
        vestidor3d.vestir(coloresDe(tripulacionActiva()[G.vestidor.astro]));
      }).catch((err) => console.warn('Vestidor 3D:', err));
      if (!miniaturasParche) import('./astronauta3d.js').then(({ texturaParche }) => {
        miniaturasParche = Object.fromEntries(R.CATALOGO.filter((x) => x.tipo === 'parche').map((x) => [x.id, texturaParche(x.id).image.toDataURL()]));
        if (G.vestidor?.cat === 'parche' && document.body.dataset.pantalla === 'vestidor') pantallaTripulacion();
      }).catch(() => {});
    }
  }
  vestidor3d?.vestir(coloresDe(a));
  const raiz = document.querySelector('.vestidor');
  raiz.querySelector('#vestidorVolver').addEventListener('click', cerrarVestidor);
  raiz.querySelectorAll('[data-seccion]').forEach((b) => b.addEventListener('click', () => { G.vestidor.seccion = b.dataset.seccion; pantallaTripulacion(); }));
  raiz.querySelectorAll('[data-astro]').forEach((b) => b.addEventListener('click', () => { G.vestidor.astro = +b.dataset.astro; vestidor3d?.mostrar(); pantallaTripulacion(); }));
  raiz.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { G.vestidor.cat = b.dataset.cat; pantallaTripulacion(); }));
  raiz.querySelector('#nombreAstro')?.addEventListener('change', (ev) => {
    G.tripulacion[V.astro].nombre = ev.target.value.trim() || R.TRIPULACION_INICIAL[V.astro].nombre;
    if (G.tripulacionPrueba) G.tripulacionPrueba[V.astro].nombre = G.tripulacion[V.astro].nombre;
    guardar('horizonte.tripulacion', G.tripulacion);
  });
  raiz.querySelectorAll('[data-pieza]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.pieza, it = R.CATALOGO.find((x) => x.id === id);
    if (!tiene(id)) {
      const r = R.comprar(G.rec, id);
      if (!r.ok) return pantallaTripulacion(t('Te faltan {n} créditos para «{x}».', { n: it.precio - G.rec.creditos, x: t(it.nombre) }));
      guardarRec(); sfx.exito?.();
    } else sfx.modulo();
    tripulacionActiva()[V.astro][V.cat] = id;
    if (!probador) guardar('horizonte.tripulacion', G.tripulacion);
    vestidor3d?.mostrar();
    aplicarPersonalizacion();
    pantallaTripulacion();
  }));
  raiz.querySelectorAll('[data-comprar]').forEach((b) => b.addEventListener('click', () => {
    const it = R.CATALOGO.find((x) => x.id === b.dataset.comprar);
    const r = R.comprar(G.rec, it.id);
    if (!r.ok) return pantallaTripulacion(t('Te faltan {n} créditos para «{x}».', { n: it.precio - G.rec.creditos, x: t(it.nombre) }));
    guardarRec(); aplicarPersonalizacion(); sfx.modulo(); pantallaTripulacion();
  }));
  raiz.querySelectorAll('[data-objeto]').forEach((cb) => cb.addEventListener('change', () => {
    const id = cb.dataset.objeto;
    G.rec.objetos = cb.checked ? [...new Set([...G.rec.objetos, id])] : G.rec.objetos.filter((x) => x !== id);
    guardarRec(); aplicarPersonalizacion();
  }));
}

function cerrarVestidor() {
  vestidor3d?.destruir(); vestidor3d = null;
  G.mundo?.reanudar?.();
  const volver = G.vestidor?.volver || inicio;
  G.vestidor = null;
  volver();
}

// ───────────────────────── Teclado ─────────────────────────
document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.target.closest?.('input, textarea, select') || document.getElementById('panel-acc') || document.getElementById('pausa-aula')) return;
  const tecla = ev.key.toLowerCase();
  if (tecla === '?') { ev.preventDefault(); A.abrirPanel({ mundo: G.mundo, I, alVista2D: pasarA2D }); return; }
  if (tecla === 'escape') { if (G.bitacoraAbierta) { G.bitacoraAbierta = false; mision(); } return; }
  if (document.body.dataset.pantalla !== 'mision' || $app.querySelector('.modal')) return;
  const accion = {
    a: () => avanzar(1), 5: () => !G.aula.tranquilo && avanzar(5), e: escucharEstado, b: () => { G.bitacoraAbierta = !G.bitacoraAbierta; mision(); },
    r: () => { G.hoy.refugio = !G.hoy.refugio; mision(); A.anunciar(G.hoy.refugio ? t('Refugio activado') : t('Refugio desactivado')); },
    c: () => { G.hoy.racion = !G.hoy.racion; mision(); A.anunciar(G.hoy.racion ? t('Ración reducida activada') : t('Ración normal')); },
    i: () => { if (!actual().config.invernadero) return; G.hoy.invernadero = !G.hoy.invernadero; mision(); A.anunciar(G.hoy.invernadero ? t('Invernadero encendido') : t('Invernadero apagado')); },
    z: () => { const d = actual().dia; if (d > 0) rebobinar(d - 1); },
  }[tecla];
  if (accion) { ev.preventDefault(); accion(); }
});

// ───────────────────────── Modo aula ─────────────────────────
// El enlace del docente (?aula=3B-2026&modo=aula[&ritmo=tranquilo]) llena el código de aula,
// empieza sin sonido ni voz (se pueden prender) y deja que el docente pause a toda el aula desde su panel.
function leerEnlaceDocente() {
  const q = new URLSearchParams(location.search);
  const aula = q.get('aula')?.trim().slice(0, 20);
  if (!aula) return;
  G.jugador.aula = aula.toUpperCase();
  guardar('horizonte.jugador', G.jugador);
  if (!G.jugador.nombre) G.pedirNombre = true; // entró con el QR del docente: le pedimos su nombre al empezar
  if (q.get('modo') === 'aula') {
    G.aula = { activo: true, tranquilo: q.get('ritmo') === 'tranquilo' };
    guardar('horizonte.modoAula', G.aula);
    fijarSonido(false);
    fijarVoz(false);
  }
  history.replaceState(null, '', location.pathname); // el enlace no queda en la barra (ni se vuelve a aplicar al recargar)
}

function vigilarPausa() {
  if (G.vigilando) return;
  G.vigilando = true;
  const revisar = async () => {
    const e = G.aula.activo ? await api.estadoAula(G.jugador.aula) : null;
    mostrarPausa(Boolean(e?.pausa), e?.mensaje);
  };
  revisar();
  setInterval(revisar, 8000);
}

function mostrarPausa(pausa, mensaje) {
  let capa = document.getElementById('pausa-aula');
  if (!pausa) { capa?.remove(); return; }
  if (!capa) {
    callar();
    capa = document.createElement('div');
    capa.id = 'pausa-aula';
    capa.setAttribute('role', 'alertdialog');
    capa.setAttribute('aria-modal', 'true');
    document.body.appendChild(capa);
  }
  capa.innerHTML = `<div class="pausa-caja">${personaje('astronauta-peruana', 'retrato')}<p class="lema">${t('Modo aula · {x}', { x: esc(G.jugador.aula) })}</p>
    <h2>${t('Pausa: mira a tu docente')}</h2>${mensaje ? `<p class="mensaje-docente">${esc(mensaje)}</p>` : ''}<p class="suave chico">${t('Tu partida está guardada. Seguirás cuando tu docente quite la pausa.')}</p></div>`;
}

function chipAula() {
  return G.aula.activo ? `<span class="chip-aula" title="${t('Modo aula')}">${I('aula')} ${t('Aula {x}', { x: esc(G.jugador.aula || '—') })}</span>` : '';
}

const leerJson = (f) => fetch(`data/${f}`).then((r) => r.json());
const sinNumero = (titulo) => titulo.replace(/^(Misión \d|Mission \d|Extra) · /, '');

/** Aplica el idioma: en inglés superpone las traducciones de data/en/ sobre los datos en español. */
async function cargarIdioma() {
  const base = structuredClone(G.orig);
  if (getIdioma() === 'en') {
    const [mEn, nEn, evEn] = await Promise.all([leerJson('en/misiones.json'), leerJson('en/nasa.json'), leerJson('en/evaluacion.json')]);
    for (const m of base.misiones) {
      const x = mEn[m.id];
      if (!x) continue;
      Object.assign(m, { titulo: x.titulo, lugar: x.lugar, resumen: x.resumen, nebula: x.nebula });
      m.eventos.forEach((ev, i) => { if (x.eventos[i]) ev.texto = x.eventos[i]; });
    }
    for (const [k, v] of Object.entries(nEn)) if (base.nasa.cifras[k]) base.nasa.cifras[k].texto = v;
    base.evaluacion = evEn;
  }
  G.nasa = base.nasa;
  G.misiones = base.misiones;
  G.evaluacion = base.evaluacion;
  G.mundo?.nombres?.({
    habitat: t('Hábitat'), panel: t('Paneles'), bateria: t('Baterías'), reactor: t('Reactor'), reciclador: t('Reciclador'),
    invernadero: t('Invernadero'), extractor: t('Extractor de hielo'), moxie: 'MOXIE',
  });
  G.mundo?.puntos?.({
    hielo: { nombre: t("Cráter en sombra"), texto: t("En el fondo de los cráteres polares que nunca reciben sol hay hielo de agua: lo confirmó la misión LCROSS en 2009."), textoMarte: t("En Marte también hay hielo de agua bajo el suelo: algunos cráteres recientes lo dejaron a la vista.") },
    rover: { nombre: t("Rover"), texto: t("Los rovers exploran lejos de la base y traen muestras sin que los astronautas se expongan."), textoMarte: t("Los rovers Curiosity y Perseverance llevan años explorando Marte.") },
    antena: { nombre: t("Antena"), texto: t("Una señal de radio tarda cerca de 1,3 segundos en ir de la Luna a la Tierra."), textoMarte: t("Desde Marte, una señal tarda entre unos 4 y 24 minutos en llegar a la Tierra: no se puede pedir ayuda al instante.") },
    tubo: { icono: 'refugio', nombre: t("Pozo de tubo de lava"), texto: t("La sonda LRO de la NASA fotografió más de 200 pozos en la Luna. Algunos podrían ser la entrada a tubos de lava: refugios naturales contra la radiación."), textoMarte: t("La cámara HiRISE de la NASA también ha fotografiado pozos en Marte que podrían llevar a cuevas.") },
    impacto: { icono: 'meteorito', nombre: t("Cráter fresco"), texto: t("La LRO de la NASA ha visto aparecer cráteres nuevos en la Luna: sin atmósfera, los meteoritos llegan hasta el suelo."), textoMarte: t("Los orbitadores de la NASA ven cráteres nuevos en Marte; algunos dejaron hielo a la vista.") },
    roca: { icono: 'capas', nombre: t("Roca rodante"), texto: t("Cuando una roca rueda cuesta abajo deja un surco largo que se ve desde la órbita."), textoMarte: t("Perseverance perfora rocas y guarda muestras en tubos para traerlas algún día a la Tierra.") },
    huellas: { icono: 'persona', nombre: t("Huellas"), texto: t("En la Luna no hay viento ni lluvia: las huellas de los astronautas del Apolo pueden durar muchísimo tiempo."), textoMarte: t("En Marte el viento sí mueve el polvo: los remolinos y las tormentas borran las huellas.") },
    cima: { nombre: t("Cima iluminada"), texto: t("Algunas cimas cerca del polo sur de la Luna reciben luz del Sol la mayor parte del año: buen lugar para paneles."), textoMarte: t("El cielo de Marte de día es color caramelo por el polvo fino que flota en el aire.") },
  }, {
    volver: t("Volver a la base"),
    raton: t("Explora: clic derecho y arrastra (o flechas) para moverte · doble clic para ir · toca un marcador"),
    tactil: t("Explora: arrastra con dos dedos para moverte · toca dos veces para ir · toca un marcador"),
  });
}

const botonSonido = () => `<button class="boton-icono" id="sonido" aria-label="${t('Sonido')}" aria-pressed="${sonidoActivo()}">${I(sonidoActivo() ? 'sonido' : 'mudo')}</button>`;
const botonAcc = () => `<button class="boton-icono" id="accesibilidad" aria-label="${t('Accesibilidad')}" aria-haspopup="dialog">${I('accesibilidad')}</button>`;
const botonEscuchar = () => `<button class="boton-icono" id="escuchar" aria-label="${t('Escuchar el estado de la base')} (E)">${I('escuchar')}</button>`;
const botonVoz = () => `<button class="boton-icono" id="voz" aria-label="${t('Voz de Nebula')}" aria-pressed="${vozActiva()}">${I(vozActiva() ? 'voz' : 'sinvoz')}</button>`;

/** Nebula lee en voz alta su globo de texto visible (si hay uno nuevo). */
function decirNebula() {
  const globo = $app.querySelector('.nebula .globo');
  if (!globo) return;
  const copia = globo.cloneNode(true);
  copia.querySelector('.quien')?.remove();
  decir(copia.innerHTML);
}

function enlazarSonido() {
  document.getElementById('accesibilidad')?.addEventListener('click', () => A.abrirPanel({ mundo: G.mundo, I, alVista2D: pasarA2D }));
  document.getElementById('escuchar')?.addEventListener('click', escucharEstado);
  document.getElementById('voz')?.addEventListener('click', (ev) => {
    const on = alternarVoz();
    ev.currentTarget.innerHTML = I(on ? 'voz' : 'sinvoz');
    ev.currentTarget.setAttribute('aria-pressed', on);
    if (on) { olvidarUltimo(); decirNebula(); }
  });
  document.getElementById('sonido')?.addEventListener('click', (ev) => {
    const on = alternarSonido();
    if (!on) callar();
    ev.currentTarget.innerHTML = I(on ? 'sonido' : 'mudo');
    ev.currentTarget.setAttribute('aria-pressed', on);
  });
}

// ───────────────────────── Piezas de interfaz ─────────────────────────
// Personajes del manual de marca ASU STELLAR: Nebula es el gato piloto; la astronauta peruana guía con preguntas;
// la llama presenta las fichas de ciencia y los logros.
const CARA_NEBULA = '<img src="assets/marca/nebula-cara.webp" alt="" width="96" height="96">';
const personaje = (archivo, clase = '') => `<img class="personaje ${clase}" src="assets/marca/${archivo}.webp" alt="" loading="lazy">`;

function nebula(texto, animo = 'normal', extra = '') {
  return `<div class="nebula ${extra}"><div class="cara ${animo}" aria-hidden="true">${CARA_NEBULA}</div><div class="globo"><span class="quien">Nebula · ${t('gato piloto')}</span>${texto}</div></div>`;
}

/** Procedencia de cada número (como hacen los mejores rivales): dato de NASA, caso histórico con fecha, por verificar o valor del juego. */
function procedencia(c) {
  if (!c) return `<span class="etq juego" title="${t('Número de equilibrio del juego, no es un dato de NASA')}">${I('ajustes')} ${t('Valor del juego')}</span>`;
  if (!c.verificado) return `<span class="etq pendiente">${I('alerta')} ${t('Por verificar')}</span>`;
  if (c.origen === 'ciencia') return `<span class="etq historico">${I('datos')} ${t('Dato científico')}</span>`;
  if (c.tipo === 'historico') return `<span class="etq historico">${I('historia')} ${t('Caso histórico · {f}', { f: esc(c.fecha) })}</span>`;
  return `<span class="etq">${I('check')} ${t('Dato de NASA')}</span>`;
}

function cifraNasa(clave) {
  const c = G.nasa.cifras[clave];
  if (!c) return '';
  return `<div class="cifra-nasa">${personaje('llama-astronauta', 'llama-ficha')}<div class="etiqueta">${t('FICHA DE CIENCIA · DATOS DE NASA')}</div>${procedencia(c)}<p>${esc(c.texto)}</p>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${t('Fuente: {x}', { x: esc(c.fuente) })}</a></div>`;
}

/** Ventana flotante sobre el mapa (resultados, pruebas, fuentes). Devuelve el contenedor interior. */
function modal({ ancho = false, cerrable = false } = {}) {
  $app.innerHTML = `<div class="velo"></div><section class="modal ${ancho ? 'ancho' : ''}" role="dialog" aria-modal="true">
    ${cerrable ? `<button class="cerrar" aria-label="${t('Cerrar')}">${I('cerrar')}</button>` : ''}<div class="contenido"></div></section>`;
  if (cerrable) $app.querySelector('.cerrar').addEventListener('click', () => { const volver = G.volverDeFuentes || inicio; G.volverDeFuentes = null; volver(); });
  const c = $app.querySelector('.contenido');
  c.scrollTop = 0;
  return c;
}

// ───────────────────────── Portada ─────────────────────────
function inicio() {
  document.getElementById('ficha-modulo')?.remove();
  if (G.tripulacionPrueba) { G.tripulacionPrueba = null; aplicarPersonalizacion(); }
  document.body.dataset.pantalla = 'portada';
  musicaTema('menu');
  ambienteEstado({});
  callar();
  olvidarUltimo();
  pintar({ config: { panel: 8, bateria: 6, reactor: true, reciclador: true, invernadero: true, blindaje: 1 }, luz: true, carga: 0.9, tripulacion: 4, tormenta: false, polvo: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true, planeta: 'luna' }, 'portada');
  let nCampana = 0, nExtra = 0;
  const boton = (m, i) => {
    const p = G.progreso[m.id] || 0;
    const num = m.tutorial ? '00' : m.avanzada ? `+${++nExtra}` : `0${++nCampana}`;
    const empezar = m.tutorial && !G.progreso[m.id];
    return `<button class="mision-btn ${m.avanzada ? 'avanzada' : ''} ${m.tutorial ? 'tutorial' : ''} ${empezar ? 'empieza' : ''} ${m.planeta === 'marte' ? 'marte' : ''}" data-mision="${i}">${empezar ? `<span class="cinta-empieza">${t('Empieza aquí')}</span>` : ''}
      <span class="num">${num}</span>
      <span class="info"><b>${esc(sinNumero(m.titulo))}</b><small>${esc(m.lugar)} · ${t('{n} astronautas · {d} días', { n: m.tripulacion, d: m.dias })}</small>${G.reservas[m.id] ? `<small class="con-reserva">${I('caja')} ${t('Con reserva de la misión anterior')}</small>` : ''}</span>
      <span class="estrellas-mini" aria-label="${t('{n} de 3 estrellas', { n: p })}">${'★'.repeat(p)}<span>${'★'.repeat(3 - p)}</span></span></button>`;
  };
  const campana = G.misiones.map((m, i) => (m.avanzada ? '' : boton(m, i))).join('');
  const avanzadas = G.misiones.map((m, i) => (m.avanzada ? boton(m, i) : '')).join('');
  $app.innerHTML = `
    <div class="barra-rapida">
      <button class="boton-icono" id="aLanding" aria-label="${t('Inicio')}">${I('base')}</button>
      <button class="boton-idioma" id="idioma" aria-label="${t('Idioma')}"><span class="${getIdioma() === 'es' ? 'activo' : ''}">ES</span><span class="${getIdioma() === 'en' ? 'activo' : ''}">EN</span></button>
      ${botonSonido()}
      ${botonVoz()}
      ${botonAcc()}
      ${chipCreditos()}
      ${chipAula()}
      ${botonAyuda()}
    </div>
    <header class="marca">
      <h1 class="logo"><img src="assets/marca/logo-color.webp" alt="ASU STELLAR" width="1200" height="800"><span class="sub-logo">Horizonte</span></h1>
      <p class="lema">${t('Entrena para dirigir una base en la Luna y Marte')}</p>
      <p class="sub">${t('Eres el astronauta peruano al mando de la expedición. Diseña tu base, adelanta el tiempo con el <strong>Cronoscopio</strong> y, si algo falla, mira la causa y <strong>rebobina</strong>.')}</p>
    </header>
    <aside class="menu-principal panel-vidrio">
      <h2 class="titulo-seccion">${t('Expedición · de la Luna a Marte')}</h2>
      <div class="lista-misiones">${campana}</div>
      ${avanzadas ? `<h2 class="titulo-seccion">${t('Misiones extra')} <span class="pastilla">${t('sin pistas')}</span></h2><div class="lista-misiones">${avanzadas}</div>` : ''}
      ${tarjetaAprendizaje()}
      <p class="chico suave pie">Stellar Experience · Moquegua, Perú · ${t('Proyecto para NASA Space Apps Challenge 2026')}</p>
    </aside>
    <nav class="dock-portada" aria-label="${t('Más opciones')}">
      ${[['miAula', 'aula', G.jugador.nombre ? esc(G.jugador.nombre) : t('Mi aula')], ['tripulacionBtn', 'tripulacion', t('Tripulación')], ['globoBtn', 'orbita', t('Globo')],
        ['guiaBtn', 'info', t('Guía')], ['personajesBtn', 'persona', t('Personajes')], ['historia', 'historia', t('Historia')], ['fuentes', 'datos', t('Datos NASA')], ['recorridoBtn', 'nebula', t('Recorrido')]]
        .map(([id, ic, txt]) => `<button id="${id}" class="dock-btn"><span class="dock-ico">${I(ic)}</span><span class="dock-txt">${txt}</span></button>`).join('')}
    </nav>
    <p class="pista-gesto">${I('mano')} ${t('Arrastra para girar la base · pellizca para acercar')}</p>`;
  $app.querySelectorAll('[data-mision]').forEach((b) => b.addEventListener('click', () => {
    abrirMision(G.misiones[+b.dataset.mision]);
  }));
  $app.querySelectorAll('[data-eval]').forEach((b) => b.addEventListener('click', () => ({ inicial: () => pruebaInicial(inicio), final: pruebaFinal, caso: casoArtemis, resumen: resumenAprendizaje, informe: informeComandante })[b.dataset.eval]()));
  document.getElementById('miAula').addEventListener('click', miAula);
  document.getElementById('recorridoBtn').addEventListener('click', () => recorridoPortada(true));
  document.getElementById('fuentes').addEventListener('click', fuentes);
  document.getElementById('historia').addEventListener('click', () => historia());
  document.getElementById('aLanding').addEventListener('click', landing);
  document.getElementById('tripulacionBtn').addEventListener('click', () => pantallaTripulacion());
  document.getElementById('globoBtn').addEventListener('click', () => globo());
  document.getElementById('guiaBtn').addEventListener('click', () => guia());
  document.getElementById('personajesBtn').addEventListener('click', () => personajes());
  document.getElementById('chipCreditos').addEventListener('click', () => pantallaTripulacion());
  document.getElementById('idioma').addEventListener('click', async () => {
    setIdioma(getIdioma() === 'es' ? 'en' : 'es');
    G.historia = null;
    await cargarIdioma();
    inicio();
  });
  enlazarSonido();
  if (G.pedirNombre && !G.jugador.nombre && !G.demo) { G.pedirNombre = false; miAula(true); }
  else if (!G.introVista && !Object.keys(G.progreso).length && !G.demo) { G.introVista = true; guardar('horizonte.intro', true); introRapida(); }
  else if (!G.demo && !leer('horizonte.recorrido', false)) setTimeout(() => recorridoPortada(), 900);
}

/** Ventana «Mi aula»: nombre, código que dio el docente y modo aula. */
function miAula(desdeQR = false) {
  const c = modal({ cerrable: true });
  c.innerHTML = `
    <p class="lema">${I('aula')} ${t('Mi aula')}</p><h2>${desdeQR ? t('¡Bienvenido a la clase {x}!', { x: esc(G.jugador.aula) }) : t('¿Tu docente te dio un código?')}</h2>
    ${desdeQR ? `<p class="aviso-demo">${t('Escribe tu nombre para que tu docente vea tu avance.')}</p>` : ''}
    <p class="suave chico">${t('Escribe tu nombre y el código de tu clase: tu docente verá tu avance y tus logros se guardan aunque cambies de celular. Es opcional.')}</p>
    <div class="form-aula">
      <label>${t('Tu nombre')} <input id="nombre" maxlength="40" value="${esc(G.jugador.nombre)}" autocomplete="off"></label>
      <label>${t('Código de la clase')} <input id="aula" maxlength="20" value="${esc(G.jugador.aula)}" autocomplete="off" placeholder="${t('p. ej. LUNA-4821')}"></label>
      <label class="casilla"><input type="checkbox" id="modoAula" ${G.aula.activo ? 'checked' : ''}> ${t('Modo aula (mi docente puede pausar el juego)')}</label>
      <label class="casilla"><input type="checkbox" id="ritmoTranquilo" ${G.aula.tranquilo ? 'checked' : ''}> ${t('Ritmo tranquilo: avanzar de un día en un día')}</label>
    </div>
    <div class="fila"><button class="primario" id="guardarAula">${I('check')} ${t('Listo')}</button></div>
    <p class="chico suave">${t('¿Eres docente?')} <a href="docente.html">${t('Crea tu clase aquí')}</a></p>`;
  if (desdeQR) setTimeout(() => c.querySelector('#nombre')?.focus(), 100);
  c.querySelector('#guardarAula').addEventListener('click', () => {
    G.jugador.nombre = c.querySelector('#nombre').value.trim();
    G.jugador.aula = c.querySelector('#aula').value.trim().toUpperCase();
    guardar('horizonte.jugador', G.jugador);
    G.aula.activo = c.querySelector('#modoAula').checked;
    G.aula.tranquilo = c.querySelector('#ritmoTranquilo').checked;
    guardar('horizonte.modoAula', G.aula);
    if (!G.aula.activo) mostrarPausa(false);
    restaurarProgreso();
    inicio();
  });
}

// ───────────────────────── Recorrido de la portada ─────────────────────────
// La llama astronauta presenta cada parte de la pantalla, una por una. Se ve sola la primera vez
// y se puede repetir con el botón «Recorrido».
function recorridoPortada(forzar = false) {
  if (document.body.dataset.pantalla !== 'portada' || (!forzar && leer('horizonte.recorrido', false))) return;
  guardar('horizonte.recorrido', true);
  ayudaPantalla();
}

// ───────────────────────── Botón «?»: la llama explica cada cosa de la pantalla ─────────────────────────
const botonAyuda = () => `<button class="boton-icono boton-ayuda" data-ayuda aria-label="${t('¿Qué es cada cosa? Ayuda de esta pantalla')}" title="${t('¿Qué es cada cosa?')}"><b aria-hidden="true">?</b></button>`;

const GUIAS = () => ({
  portada: [
    ['.lista-misiones .mision-btn', t('¡Hola! Soy la llama de la expedición. Aquí están las misiones. Empieza por el Episodio 0: es un entrenamiento corto donde aprendes a jugar.')],
    ['.lista-misiones', t('Luego vienen 4 misiones, de la Luna a Marte. Cada una que cumples te da estrellas ★ y abre la siguiente.')],
    ['.estrellas-mini', t('Las estrellas dicen qué tan bien te fue: 3 estrellas si llegas al final sin rebobinar.')],
    ['.fila-eval, .tarjeta-aprendizaje', t('Aquí están tus pruebas: una al inicio y otra al final, para ver cuánto aprendiste.')],
    ['#chipCreditos', t('Estos son tus créditos estelares. Los ganas al cumplir misiones, al predecir bien y al aprender de un error.')],
    ['#aLanding', t('La casita te lleva a la página de inicio del proyecto.')],
    ['#idioma', t('Aquí cambias el idioma: español o inglés.')],
    ['#sonido', t('Este botón prende o apaga la música y los sonidos.')],
    ['#voz', t('Este botón prende o apaga la voz que lee los textos.')],
    ['#accesibilidad', t('Accesibilidad: letra más grande, alto contraste, menos movimiento y la vista 2D para equipos lentos.')],
    ['#miAula', t('Si tu docente te dio un código de clase, escríbelo en Mi aula para que vea tu avance.')],
    ['#tripulacionBtn', t('En Tripulación gastas tus créditos: trajes, visores, parches y accesorios para tus astronautas, y objetos para la base.')],
    ['#globoBtn', t('En el Globo ves la Luna y Marte enteros y dónde queda cada misión, en su lugar real.')],
    ['#guiaBtn', t('En la Guía está cómo se juega y qué significa cada barra.')],
    ['#personajesBtn', t('Personajes te presenta a la tripulación, a Nebula y a mí.')],
    ['#historia', t('Historia: el cuento ilustrado de la expedición.')],
    ['#fuentes', t('Todos los números del juego son de la NASA. Aquí puedes ver de dónde sale cada uno.')],
    ['#mundo', t('Esta es tu base en 3D. Arrastra con el dedo para girarla y pellizca para acercarte.')],
    ['[data-ayuda]', t('Y si no sabes qué es algo, toca este signo de pregunta: te lo explico. ¡Buena expedición, comandante!')],
  ],
  diseno: [
    ['#volver', t('Esta flecha te regresa a la lista de misiones.')],
    ['.titulo-barra', t('Aquí ves la misión: el lugar, cuántos astronautas van y cuántos días dura.')],
    ['.masa', t('Esta barra es el peso que lleva el cohete. Si se pone roja, el cohete no puede despegar: quita algo.')],
    ['#deDonde', t('Toca aquí para ver de dónde salen los números: todos son datos de la NASA.')],
    ['#probador', t('En el Episodio 0 puedes probarle a tu tripulación todos los trajes, gratis.')],
    ['.widgets-diseno', t('Estas tarjetas te dicen si tu base alcanza. Verde = suficiente. Rojo = en riesgo.')],
    ['.briefing', t('Aquí Nebula te cuenta la misión. Léelo y toca «¡Entendido!».')],
    ['#mundo', t('Este es el mapa de tu base. Arrastra para girar, pellizca para acercar y toca un módulo para saber qué hace.')],
    ['[data-carta="panel"]', t('Los paneles solares dan energía, pero solo cuando hay Sol. Usa + y − para poner más o menos.')],
    ['[data-carta="bateria"]', t('Las baterías guardan la energía del día para usarla de noche.')],
    ['.interruptor', t('Los interruptores prenden o apagan un módulo: reactor, reciclador, invernadero…')],
    ['.segmentos', t('El blindaje protege de la radiación. Más blindaje = más protección, pero más peso.')],
    ['.cartas', t('Desliza esta fila hacia los lados para ver todos los módulos: oxígeno, agua y comida también.')],
    ['#lanzar', t('Cuando tu base esté lista, toca LANZAR. Antes te pediré que predigas qué pasará.')],
  ],
  mision: [
    ['#abortar', t('Este botón te devuelve al diseño de la base para cambiarla.')],
    ['.recursos .recurso:nth-child(1)', t('Energía: los kWh guardados en las baterías. Si llega a cero, la base se apaga.')],
    ['.recursos .recurso:nth-child(2)', t('Oxígeno: el aire que respiran los astronautas.')],
    ['.recursos .recurso:nth-child(3)', t('Agua: para tomar y para fabricar oxígeno.')],
    ['.recursos .recurso:nth-child(4)', t('Comida: cuántos kilos quedan.')],
    ['.recursos .recurso:nth-child(5)', t('Radiación: esta barra debe quedarse BAJA. Si llega al límite, la misión falla.')],
    ['.recursos .recurso:nth-child(6)', t('Salud de la tripulación: baja si comen poco o reciben mucha radiación.')],
    ['.recursos .recurso:nth-child(7)', t('Ciencia: los experimentos que hacen. Necesitas llegar a la meta para cumplir la misión.')],
    ['.reloj-dia', t('El reloj: qué día es, si hay Sol o es de noche, y cuántas veces rebobinaste.')],
    ['.zona-nebula', t('Aquí Nebula te avisa lo que pasa y te da pistas.')],
    ['[data-dec="refugio"]', t('Refugio: los astronautas se protegen de una tormenta solar. Ese día no hacen ciencia.')],
    ['[data-dec="racion"]', t('Ración: comen menos para que la comida dure más, pero baja la salud.')],
    ['[data-dec="invernadero"]', t('Invernadero: apágalo para ahorrar energía y agua cuando haga falta.')],
    ['#bitacora', t('Bitácora: el diario de la misión, día por día.')],
    ['.cronoscopio', t('El Cronoscopio guarda cada día. Toca un día pasado para volver el tiempo atrás.')],
    ['#dia1', t('AVANZAR pasa un día. Mira cómo cambian las barras.')],
    ['#dia5', t('Este botón avanza 5 días seguidos (se detiene si pasa algo importante).')],
    ['#mundo', t('Tu base en 3D: arrastra para girar, pellizca para acercar y toca los puntos con nombre para visitarlos.')],
  ],
  resultado: [
    ['.modal .cadena', t('La cadena de causas: lo que pasó, paso a paso. Así sabes qué falló.')],
    ['.modal .nebula', t('Nebula te dice qué cambiar para la próxima vez.')],
    ['.modal .prediccion', t('Aquí ves si acertaste tu predicción.')],
    ['.modal .mas-datos', t('Toca aquí para ver más datos de la misión.')],
    ['.modal .premio', t('Tu premio: créditos estelares e insignias. Úsalos en Tripulación.')],
    ['.modal #nota', t('Escribe una frase en tu bitácora: qué cambiaste o qué aprendiste.')],
    ['.hud-acciones', t('Aquí eliges qué hacer ahora: rediseñar, volver a un día, seguir a la siguiente misión o ir al menú.')],
  ],
  globo: [
    ['#globoVolver', t('Esta flecha te regresa.')],
    ['.vestidor-cats', t('Elige si quieres ver la Luna o Marte.')],
    ['#globoEscena', t('El globo: arrástralo para girarlo. Los puntos son los lugares reales de cada misión.')],
    ['.globo-lista', t('Toca una misión de la lista para ir a su lugar en el globo.')],
    ['#globoFicha', t('Aquí lees qué tiene de especial ese lugar.')],
    ['#globoJugar', t('Y desde aquí puedes empezar esa misión.')],
  ],
  vestidor: [
    ['#vestidorVolver', t('Esta flecha te regresa.')],
    ['.creditos-grandes', t('Tus créditos estelares: con ellos desbloqueas cosas nuevas.')],
    ['.vestidor-secciones', t('Elige qué quieres personalizar: astronautas, objetos de la base o ver tus insignias.')],
    ['#vestidorEscena', t('Tu astronauta en grande. Arrástralo para darle la vuelta.')],
    ['.vestidor-cuerpo', t('Toca un traje, un parche o un accesorio para ponérselo. Los que tienen candado se desbloquean con créditos.')],
  ],
});

function ayudaPantalla() {
  const pant = document.body.dataset.pantalla === 'modal' && document.querySelector('.hud-acciones') ? 'resultado' : document.body.dataset.pantalla;
  const pasos = GUIAS()[pant] || [['.modal', t('Lee con calma y toca el botón para seguir. Si no sabes algo, pregúntale a tu docente.')]];
  document.getElementById('coach')?.remove();
  guiaPantalla(pasos, {
    textos: { saltar: t('Cerrar'), siguiente: t('Siguiente'), anterior: t('Anterior'), listo: t('¡Listo!'), titulo: t('¿Qué es cada cosa?'), pregunta: t('¿Qué es esto?') },
    hablar: leerEnVoz,
    alCerrar: () => { if (G.mision?.id === 'cero' && ['diseno', 'mision', 'resultado'].includes(document.body.dataset.pantalla)) setTimeout(coach, 200); },
  });
}
document.addEventListener('click', (e) => { if (e.target.closest?.('[data-ayuda]')) ayudaPantalla(); });

// ───────────────────────── Construcción ─────────────────────────
function estimaciones() {
  const { mision: m, juego: j, nasa } = G;
  const r = G.reservas[m.id] || {};
  const c = { ...G.config, o2: G.config.o2 + (r.o2 || 0), agua: G.config.agua + (r.agua || 0), comida: G.config.comida + (r.comida || 0) };
  const n = m.tripulacion;
  const v = (k) => nasa.cifras[k].valor;
  const o2Dia = n * v('o2_persona_dia');
  const o2Moxie = c.moxie ? Math.min(o2Dia, j.modulos.moxie.o2_kg_dia) : 0;
  const demanda = j.habitat.kwh_dia_base + n * j.habitat.kwh_dia_persona + (o2Dia - o2Moxie) * j.habitat.kwh_por_kg_o2
    + (c.reciclador ? j.modulos.reciclador.kwh_dia : 0) + (c.invernadero ? j.modulos.invernadero.kwh_dia : 0)
    + (c.extractor ? j.modulos.extractor.kwh_dia : 0) + (c.moxie ? j.modulos.moxie.kwh_dia : 0);
  const reactor = c.reactor ? v('fsp_kw') * 24 : 0;
  const bateria = c.bateria * j.modulos.bateria.capacidad_kwh;
  const aguaDia = n * v('agua_persona_dia') * (c.reciclador ? 1 - v('recuperacion_agua') : 1)
    + (o2Dia - o2Moxie) * v('agua_por_kg_o2') + (c.invernadero ? j.modulos.invernadero.agua_kg_dia : 0)
    - (c.extractor ? j.modulos.extractor.agua_kg_dia : 0);
  const comidaDia = n * v('comida_persona_dia') * (c.invernadero ? 1 - j.modulos.invernadero.fraccion_comida : 1);
  return {
    demanda, dia: c.panel * j.modulos.panel.kwh_dia_luz * (m.factor_solar ?? 1) + reactor,
    nochesAguanta: demanda - reactor <= 0 ? Infinity : bateria / (demanda - reactor),
    diasAgua: aguaDia <= 0 ? Infinity : c.agua / aguaDia, diasComida: c.comida / comidaDia, diasO2: c.o2 / o2Dia,
    dosis: v(m.dosis_dato || 'dosis_luna_msv_dia') * (1 - j.modulos.blindaje.niveles[c.blindaje].reduccion) * m.dias,
  };
}

function construir() {
  document.body.dataset.pantalla = 'diseno';
  musicaTema(G.mision.planeta === 'marte' ? 'marte' : 'luna');
  if (!G.mision.tutorial && G.tripulacionPrueba) { G.tripulacionPrueba = null; aplicarPersonalizacion(); }
  const { mision: m, config: c, juego: j, nasa } = G;
  pintar({ config: c, luz: S.hayLuz(m, 0, nasa), tripulacion: m.tripulacion, carga: 1, tormenta: false, polvo: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true, planeta: m.planeta || 'luna' }, 'diseno');
  const masa = S.masa(c, j, nasa);
  const pct = Math.min(100, (masa / m.presupuesto_t) * 100);
  const excedido = masa > m.presupuesto_t;
  const e = estimaciones();
  const dias = (x) => (x === Infinity ? '∞' : fmt(x, 1));
  const estado = (ok) => (ok ? 'bien' : 'mal');
  const tiene = (k) => (m.modulos || ['panel', 'bateria', 'reactor', 'reciclador', 'invernadero', 'blindaje']).includes(k);

  const contador = (k, paso, icono, nombre, detalle, unidad = '') => `
    <div class="carta" data-carta="${k}"><div class="carta-ico">${icono}</div><b>${nombre}</b><small>${detalle}</small>
      <div class="stepper"><button aria-label="${t('Quitar {x}', { x: nombre })}" data-menos="${k}" data-paso="${paso}">−</button>
      <output>${c[k]}${unidad}</output><button aria-label="${t('Añadir {x}', { x: nombre })}" data-mas="${k}" data-paso="${paso}">+</button></div></div>`;
  const interruptor = (k, icono, nombre, detalle) => `
    <div class="carta ${c[k] ? 'activa' : ''}"><div class="carta-ico">${icono}</div><b>${nombre}</b><small>${detalle}</small>
      <button class="interruptor" role="switch" aria-checked="${c[k]}" aria-label="${nombre}" data-toggle="${k}"><span></span></button></div>`;

  $app.innerHTML = `
    <header class="barra-superior">
      <button id="volver" class="boton-icono" aria-label="${t('Volver a misiones')}">${I('volver')}</button>
      <div class="titulo-barra"><small>${esc(m.lugar)} · ${t('{n} astronautas · {d} días', { n: m.tripulacion, d: m.dias })}</small><b>${esc(m.titulo)}</b></div>
      <button class="boton-icono" id="deDonde" aria-label="${t('¿De dónde salen estos números?')}" title="${t('¿De dónde salen estos números?')}">${I('datos')}</button>
      ${botonAyuda()}
      ${m.tutorial ? `<button class="secundario chico" id="probador">${I('tripulacion')} ${t('Vestir tripulación')}</button>` : ''}
      <div class="masa ${excedido ? 'peligro' : pct > 85 ? 'alerta' : ''}" title="${t('Masa que lleva el cohete')}">
        <div class="entre"><span>${I('cohete')} ${t('Masa')}</span><b>${fmt(masa, 2)} / ${m.presupuesto_t} t</b></div>
        <div class="barra"><span style="width:${pct}%"></span></div>
      </div>
    </header>

    <aside class="widgets-diseno ${G.widgetsAbiertos ? 'abierto' : ''}" tabindex="0" aria-label="${t('Cómo va tu diseño')}">
      ${(() => {
        const w = [
          ['energia', estado(e.dia >= e.demanda), `+${fmt(e.dia)} / −${fmt(e.demanda)}`, t('kWh/día con luz')],
          m.luz_permanente ? null : ['noche', estado(e.nochesAguanta >= 15), `${dias(e.nochesAguanta)} ${t('días')}`, t('aguantas de noche (~15)')],
          ['agua', estado(e.diasAgua >= m.dias), `${dias(e.diasAgua)} ${t('días')}`, t('de agua')],
          ['comida', estado(e.diasComida >= m.dias), `${dias(e.diasComida)} ${t('días')}`, t('de comida')],
          ['radiacion', estado(e.dosis <= m.limite_dosis_msv), `${fmt(e.dosis, 1)} mSv`, t('límite {n}', { n: m.limite_dosis_msv })],
        ].filter(Boolean);
        // lo que está en riesgo va primero; en el celular se ven fijos los 3 primeros
        w.sort((a, b) => (a[1] === 'mal' ? 0 : 1) - (b[1] === 'mal' ? 0 : 1));
        const html = w.map(([ic, est, val, desc], i) => `<div class="widget ${est} ${i >= 3 ? 'extra' : ''}"><span>${I(ic)}</span><div><b>${val}</b><small>${desc}</small><em class="estado-txt">${est === 'mal' ? `⚠ ${t('En riesgo')}` : `✓ ${t('Suficiente')}`}</em></div></div>`).join('');
        return html + (w.length > 3 ? `<button class="ver-todos" id="verTodos" aria-expanded="${Boolean(G.widgetsAbiertos)}">${G.widgetsAbiertos ? t('Ver menos') : t('Ver todos ({n})', { n: w.length })}</button>` : '');
      })()}
      ${G.reservas[m.id] ? `<div class="widget reserva extra"><span>${I('caja')}</span><div><b>+${fmt(G.reservas[m.id].o2, 1)} O₂ · +${fmt(G.reservas[m.id].agua)} ${t('agua')} · +${fmt(G.reservas[m.id].comida)} ${t('comida')}</b><small>${t('kg de reserva de la misión anterior (no pesan)')}</small></div></div>` : ''}
    </aside>

    ${G.briefingVisto[m.id] ? '' : `<div class="briefing">${nebula(esc(m.nebula.briefing) + '<br><br>' + esc(m.nebula.construir), 'pensando')}<button class="primario" id="entendido">${t('¡Entendido!')}</button></div>`}
    ${excedido ? `<div class="toasts"><div class="toast peligro">${t('El cohete no puede despegar: quita masa.')}</div></div>` : `<p class="pista-tocar">${I('mano')} ${t('Toca un módulo en el mapa para ver qué hace')}</p>`}

    <footer class="dock">
      <div class="cartas">
        ${contador('panel', 1, I('panel'), t('Paneles'), t('{t} t · {k} kWh/día con luz', { t: j.modulos.panel.masa_t, k: j.modulos.panel.kwh_dia_luz }))}
        ${contador('bateria', 1, I('bateria'), t('Baterías'), `${j.modulos.bateria.masa_t} t · ${j.modulos.bateria.capacidad_kwh} kWh`)}
        ${tiene('reactor') ? interruptor('reactor', I('reactor'), t('Reactor'), t('{t} t · {k} kW día y noche', { t: nasa.cifras.fsp_masa_t.valor, k: nasa.cifras.fsp_kw.valor })) : ''}
        ${interruptor('reciclador', I('reciclador'), t('Reciclador'), t('{t} t · recupera {p} % del agua', { t: j.modulos.reciclador.masa_t, p: fmt(nasa.cifras.recuperacion_agua.valor * 100) }))}
        ${interruptor('invernadero', I('invernadero'), t('Invernadero'), t('{t} t · {p} % de la comida', { t: j.modulos.invernadero.masa_t, p: fmt(j.modulos.invernadero.fraccion_comida * 100) }))}
        ${tiene('extractor') ? interruptor('extractor', I('extractor'), t('Extractor de hielo'), t('{t} t · +{a} kg agua/día · {k} kWh', { t: j.modulos.extractor.masa_t, a: j.modulos.extractor.agua_kg_dia, k: j.modulos.extractor.kwh_dia })) : ''}
        ${tiene('moxie') ? interruptor('moxie', I('moxie'), 'MOXIE', t('{t} t · {o} kg O₂/día del aire · {k} kWh', { t: j.modulos.moxie.masa_t, o: j.modulos.moxie.o2_kg_dia, k: j.modulos.moxie.kwh_dia })) : ''}
        <div class="carta"><div class="carta-ico">${I('blindaje')}</div><b>${t('Blindaje')}</b><small>${j.modulos.blindaje.niveles.map((nv) => `${nv.masa_t} t → −${fmt(nv.reduccion * 100)}%`).join(' · ')}</small>
          <div class="segmentos" role="group" aria-label="${t('Nivel de blindaje')}">${['No', 'Medio', 'Alto'].map((x, i) => `<button aria-pressed="${c.blindaje === i}" data-blindaje="${i}">${t(x)}</button>`).join('')}</div></div>
        ${contador('o2', 5, I('o2'), t('Oxígeno'), t('kg de reserva'), ' kg')}
        ${contador('agua', 10, I('agua'), t('Agua'), t('kg · también hace O₂'), ' kg')}
        ${contador('comida', 10, I('comida'), t('Comida'), 'kg', ' kg')}
      </div>
      <button class="boton-lanzar" id="lanzar" ${excedido ? 'disabled' : ''}><span>${I('cohete')}</span>${t('LANZAR')}</button>
    </footer>`;

  // Conservar la posición del dock al redibujar
  const dock = $app.querySelector('.cartas');
  dock.scrollLeft = G.scrollDock || 0;
  dock.addEventListener('scroll', () => { G.scrollDock = dock.scrollLeft; }, { passive: true });

  document.getElementById('volver').addEventListener('click', () => { G.scrollDock = 0; inicio(); });
  document.getElementById('deDonde').addEventListener('click', () => { fuentes(); G.volverDeFuentes = construir; });
  document.getElementById('probador')?.addEventListener('click', () => { G.vestidor = null; pantallaTripulacion('', { probador: true, volver: construir }); });
  document.getElementById('entendido')?.addEventListener('click', () => { G.briefingVisto[m.id] = true; construir(); });
  const tipoDe = (k) => (['o2', 'agua', 'comida'].includes(k) ? 'habitat' : k);
  const lim = (k, val) => Math.max(0, Math.min(j.modulos[k]?.max ?? 9999, val));
  $app.querySelectorAll('[data-mas]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.mas; c[k] = lim(k, c[k] + +b.dataset.paso); construir(); resaltar(tipoDe(k)); sfx.modulo(); }));
  $app.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.menos; c[k] = lim(k, c[k] - +b.dataset.paso); construir(); }));
  $app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.toggle; c[k] = !c[k]; construir(); if (c[k]) { resaltar(k); sfx.modulo(); } }));
  $app.querySelectorAll('[data-blindaje]').forEach((b) => b.addEventListener('click', () => { c.blindaje = +b.dataset.blindaje; construir(); resaltar('habitat'); }));
  document.getElementById('lanzar').addEventListener('click', lanzar);
  document.getElementById('verTodos')?.addEventListener('click', () => { G.widgetsAbiertos = !G.widgetsAbiertos; construir(); });
  decirNebula();
  coach();
}

// ───────────────────────── Misión ─────────────────────────
// Paso «Predice» (ciclo de ASU STELLAR): antes de lanzar, el estudiante dice qué cree que fallará primero.
const PREDICCIONES = [['exito', 'Llegamos al final', 'ok'], ['energia', 'Se acaba la energía', 'energia'], ['o2', 'Se acaba el oxígeno', 'o2'],
  ['agua', 'Se acaba el agua', 'agua'], ['comida', 'Se acaba la comida', 'comida'], ['radiacion', 'Demasiada radiación', 'radiacion']];
const OTROS_MOTIVOS = { salud: 'La tripulación se debilitó', ciencia: 'No se completó la ciencia' };
const nombreMotivo = (k) => t(PREDICCIONES.find((p) => p[0] === k)?.[1] || OTROS_MOTIVOS[k] || k);

function lanzar() {
  const c = modal();
  c.innerHTML = `
    <div class="guia-pregunta">${personaje('astronauta-peruana', 'retrato')}
      <div><p class="lema">${I('predecir')} ${t('Predice')}</p><h2>${t('¿Qué crees que pasará con este plan?')}</h2>
      <p class="suave">${t('Elige antes de lanzar. Al final verás si acertaste.')}</p></div></div>
    <div class="opciones">${PREDICCIONES.map(([k, txt, ic]) => `<button class="opcion" data-pred="${k}"><span class="letra">${I(ic)}</span>${t(txt)}</button>`).join('')}</div>
    <div class="fila"><button class="fantasma" id="cambiarPlan">${I('volver')} ${t('Cambiar mi plan')}</button></div>`;
  c.querySelectorAll('[data-pred]').forEach((b) => b.addEventListener('click', () => { G.prediccion = b.dataset.pred; viaje(empezarMision); }));
  c.querySelector('#cambiarPlan').addEventListener('click', construir);
  coach();
}

function resultadoPrediccion(motivo) {
  if (!G.prediccion) return '';
  const real = motivo || 'exito';
  const acierto = G.prediccion === real;
  return `<div class="prediccion ${acierto ? 'bien' : 'mal'}">${I(acierto ? 'check' : 'predecir')}<span>${t('Tu predicción: {x}.', { x: `<b>${nombreMotivo(G.prediccion)}</b>` })} ${acierto ? t('¡Acertaste!') : t('Pasó: {x}.', { x: `<b>${nombreMotivo(real)}</b>` })}</span></div>`;
}

// ───────────────────────── El viaje: carga en la Tierra, despegue, viaje y aterrizaje ─────────────────────────
// Como una misión real: primero se sube al cohete todo lo que diseñaste, se despega de la Tierra, se viaja
// (4 días a la Luna como el Apolo 11, unos 7 meses a Marte como Perseverance) y se aterriza en el puesto de avanzada.
const COHETE_SVG = `<svg class="cohete-svg" viewBox="0 0 80 200" aria-hidden="true">
  <path d="M40 4 C58 26 62 52 62 78 L62 150 L18 150 L18 78 C18 52 22 26 40 4Z" fill="#f5f6ff" stroke="#29335e" stroke-width="3"/>
  <path d="M40 4 C50 16 55 28 58 40 L22 40 C25 28 30 16 40 4Z" fill="#ff7a7a" stroke="#29335e" stroke-width="3"/>
  <circle cx="40" cy="70" r="11" fill="#5cc8ee" stroke="#29335e" stroke-width="3"/><circle cx="36" cy="66" r="3" fill="#e6e9fb"/>
  <rect x="18" y="100" width="44" height="10" fill="#ffc94a"/>
  <path d="M18 120 L2 160 L18 150Z M62 120 L78 160 L62 150Z" fill="#9a8ef0" stroke="#29335e" stroke-width="3"/>
  <path d="M28 150 L52 150 L48 162 L32 162Z" fill="#8a91b8" stroke="#29335e" stroke-width="3"/>
  <g class="llama-motor"><path d="M32 162 Q40 200 48 162Z" fill="#ffc94a"/><path d="M35 162 Q40 186 45 162Z" fill="#ff9a52"/></g>
</svg>`;

function viaje(despues) {
  const m = G.mision, c = G.config, marte = m.planeta === 'marte';
  const reducido = document.documentElement.classList.contains('menos-movimiento') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  G.viajesVistos ||= {};
  const corto = Boolean(G.viajesVistos[m.id]); // la segunda vez solo despegue y aterrizaje
  G.viajesVistos[m.id] = true;
  document.body.dataset.pantalla = 'viaje';
  musicaTema('viaje');
  callar();
  const masa = S.masa(c, G.juego, G.nasa);
  const nivel = ['', t('medio'), t('alto')][c.blindaje] || '';
  const carga = [
    [I('tripulacion'), t('{n} astronautas', { n: m.tripulacion })],
    c.panel && [I('panel'), `${c.panel} × ${t('Paneles')}`],
    c.bateria && [I('bateria'), `${c.bateria} × ${t('Baterías')}`],
    c.reactor && [I('reactor'), t('Reactor')],
    c.reciclador && [I('reciclador'), t('Reciclador')],
    c.invernadero && [I('invernadero'), t('Invernadero')],
    c.extractor && [I('extractor'), t('Extractor de hielo')],
    c.moxie && [I('moxie'), 'MOXIE'],
    c.blindaje && [I('blindaje'), `${t('Blindaje')} ${nivel}`],
    [I('o2'), `${c.o2} kg ${t('Oxígeno').toLowerCase()}`],
    [I('agua'), `${c.agua} kg ${t('agua')}`],
    [I('comida'), `${c.comida} kg ${t('comida')}`],
  ].filter(Boolean);
  const dato = G.nasa.cifras[marte ? 'viaje_perseverance' : 'viaje_apolo11'];
  const destino = marte ? t('Marte') : t('la Luna');
  let saltar = false, terminado = false;
  const espera = (ms) => new Promise((r) => { const fin = Date.now() + (reducido ? Math.min(ms, 1400) : ms); const tick = () => (saltar || Date.now() >= fin ? r() : setTimeout(tick, 60)); tick(); });
  $app.innerHTML = `
    <section class="viaje ${marte ? 'a-marte' : 'a-luna'}" aria-labelledby="viajeTitulo">
      <div class="viaje-escena" id="viajeEscena"></div><div class="viaje-fondo3d" id="viajeFondo3d"></div>
      <div class="viaje-texto"><p class="lema" id="viajeFase"></p><h2 id="viajeTitulo"></h2><p class="suave" id="viajeDetalle"></p></div>
      <button class="fantasma viaje-saltar" id="viajeSaltar">${I('rapido')} ${t('Saltar viaje')}</button>
    </section>`;
  const $e = $app.querySelector('#viajeEscena');
  let v3d = null;
  const fase = (lema, titulo, detalle, escena, clase, encima3d = '') => {
    v3d?.fase(clase.replace('fase-', ''));
    if (v3d) escena = encima3d;
    $app.querySelector('#viajeFase').innerHTML = lema;
    $app.querySelector('#viajeTitulo').textContent = titulo;
    $app.querySelector('#viajeDetalle').innerHTML = detalle || '';
    $e.className = `viaje-escena ${clase}`;
    $e.innerHTML = escena;
    A.anunciar(titulo);
  };
  const terminar = () => { if (terminado) return; terminado = true; musicaTema(marte ? 'marte' : 'luna'); document.removeEventListener('keydown', tecla); v3d?.destruir(); G.mundo?.reanudar?.(); despues(); };
  const tecla = (ev) => { if (ev.key === 'Escape') saltar = true; };
  document.addEventListener('keydown', tecla);
  $app.querySelector('#viajeSaltar').addEventListener('click', () => { saltar = true; });

  (async () => {
    // Escena 3D sencilla si el equipo tiene 3D (si no, o con menos movimiento, la versión dibujada)
    if (G.mundo && !reducido) {
      try {
        const { crearViaje3D } = await import('./viaje3d.js');
        G.mundo.pausar?.();
        v3d = crearViaje3D($app.querySelector('#viajeFondo3d'), { marte });
        $app.querySelector('.viaje').classList.add('con-3d');
      } catch (err) { console.warn('Viaje 3D no disponible:', err); v3d = null; G.mundo?.reanudar?.(); }
    }
    if (!corto) {
      // 1. Carga en la Tierra
      fase(`${I('caja')} ${t('Paso 1 de 4 · En la Tierra')}`, t('Cargando el cohete'), t('Todo lo que diseñaste sube al cohete: {t} t de {max} t.', { t: fmt(masa, 2), max: m.presupuesto_t }),
        `<div class="plataforma-tierra"><div class="torre"></div>${COHETE_SVG}</div>
         <ul class="manifiesto">${carga.map(([ic, txt], i) => `<li style="--i:${i}"><span class="ico">${ic}</span>${esc(txt)}<span class="ok">${I('check')}</span></li>`).join('')}</ul>`, 'fase-carga',
        `<ul class="manifiesto">${carga.map(([ic, txt], i) => `<li style="--i:${i}"><span class="ico">${ic}</span>${esc(txt)}<span class="ok">${I('check')}</span></li>`).join('')}</ul>`);
      sfx.modulo();
      await espera(1200 + carga.length * 260);
    }
    if (saltar) return terminar();
    // 2. Cuenta regresiva y despegue
    fase(`${I('cohete')} ${t(corto ? 'Despegue' : 'Paso 2 de 4 · Despegue')}`, t('3… 2… 1… ¡Despegue!'), t('Rumbo a {x}.', { x: esc(destino) }),
      `<div class="plataforma-tierra"><div class="torre"></div><div class="cohete-sube">${COHETE_SVG}<div class="humo"></div></div></div><div class="cuenta" aria-hidden="true"><span>3</span><span>2</span><span>1</span></div>`, 'fase-despegue',
      '<div class="cuenta" aria-hidden="true"><span>3</span><span>2</span><span>1</span></div>');
    await espera(900);
    if (!saltar) sfx.despegue();
    await espera(corto ? 1600 : 2600);
    if (saltar) return terminar();
    if (!corto) {
      // 3. El viaje (tiempo real de una misión de la NASA)
      fase(`${I('lugar')} ${t('Paso 3 de 4 · El viaje')}`, marte ? t('Unos 7 meses hasta Marte') : t('Unos 4 días hasta la Luna'), `${esc(dato?.texto || '')} <span class="etq">${I('datos')} ${t('Dato NASA')}</span>`,
        `<div class="ruta"><div class="planeta tierra"></div><svg class="arco" viewBox="0 0 600 200" aria-hidden="true"><path d="M60 150 Q300 -40 540 150" fill="none" stroke="#c9cfee" stroke-width="3" stroke-dasharray="8 10"/></svg>
         <div class="nave-ruta">${COHETE_SVG}</div><div class="planeta ${marte ? 'marte' : 'luna'}"></div></div>
         <div class="contador-viaje">${Array.from({ length: marte ? 7 : 4 }, (_, i) => `<span style="--i:${i}">${marte ? t('Mes {n}', { n: i + 1 }) : t('Día {n}', { n: i + 1 })}</span>`).join('')}</div>`, 'fase-viaje',
        `<div class="contador-viaje">${Array.from({ length: marte ? 7 : 4 }, (_, i) => `<span style="--i:${i}">${marte ? t('Mes {n}', { n: i + 1 }) : t('Día {n}', { n: i + 1 })}</span>`).join('')}</div>`);
      await espera(3600);
      if (saltar) return terminar();
    }
    // 4. Aterrizaje en el puesto de avanzada
    fase(`${I('ok')} ${t(corto ? 'Aterrizaje' : 'Paso 4 de 4 · Aterrizaje')}`, t('¡Aterrizamos en {x}!', { x: m.lugar }), t('El puesto de avanzada te espera. Ahora mantén viva la base.'),
      `<div class="suelo-destino"><div class="puesto"><span class="cupula"></span><span class="modulo-a"></span><span class="modulo-b"></span></div><div class="cohete-baja">${COHETE_SVG}</div><div class="polvo-aterrizaje"></div></div>`, 'fase-aterrizaje');
    await espera(corto ? 2000 : 2800);
    terminar();
  })();
}

function empezarMision() {
  for (const k of Object.keys(valoresHUD)) delete valoresHUD[k];
  G.estados = [S.crearEstado(G.mision, G.config, G.juego, G.reservas[G.mision.id] || {})];
  G.registros = [];
  G.decisiones = [];
  G.hoy = S.decisionesPorDefecto();
  G.avisoRebobinado = null;
  G.bitacoraAbierta = false;
  mision();
}

const actual = () => G.estados[G.estados.length - 1];
const guiada = () => !G.mision.sin_pistas; // en las misiones de evaluación y avanzadas, Nebula no da pistas

/** El estado de la base en una frase (para escucharlo o para el lector de pantalla). */
function estadoEnPalabras() {
  const m = G.mision, e = actual();
  const luz = S.hayLuz(m, e.dia, G.nasa);
  return t('Día {n} de {t}, {luz}. Energía {e} kilovatios hora, oxígeno {o} kilos, agua {a} kilos, comida {c} kilos. Radiación {r} de {l} milisieverts. Salud {s} por ciento. Ciencia {k} de {kt}.', {
    n: Math.min(e.dia + 1, m.dias), t: m.dias, luz: luz ? t('de día') : t('de noche'), e: fmt(e.energia), o: fmt(e.o2, 1), a: fmt(e.agua), c: fmt(e.comida),
    r: fmt(e.dosis, 1), l: m.limite_dosis_msv, s: fmt(e.salud), k: e.ciencia, kt: m.objetivo_ciencia,
  });
}

// ───────────────────────── Nebula flotante ─────────────────────────
// La gata piloto está siempre a mano: un botón flotante que parpadea, se puede arrastrar a cualquier lugar
// (recuerda dónde lo dejaste) y al tocarlo da la pista de la pantalla en la que estás.
function nebulaFlotante() {
  let b = document.getElementById('nebula-flotante');
  const visible = ['diseno', 'mision'].includes(document.body.dataset.pantalla) && !G.demo; // en el resultado Nebula ya habla dentro del diagnóstico
  if (!visible) { b?.setAttribute('hidden', ''); document.getElementById('nebula-globo')?.remove(); return; }
  if (!b) {
    b = document.createElement('button');
    b.id = 'nebula-flotante';
    b.innerHTML = `${CARA_NEBULA}<span class="punto-aviso" aria-hidden="true"></span>`;
    document.body.appendChild(b);
    const pos = leer('horizonte.nebulaPos', null);
    const colocar = (x, y) => {
      const w = window.innerWidth, h = window.innerHeight;
      b.style.left = `${Math.min(w - 70, Math.max(6, x * w))}px`;
      b.style.top = `${Math.min(h - 70, Math.max(6, y * h))}px`;
    };
    colocar(pos?.x ?? 0.02, pos?.y ?? 0.56);
    window.addEventListener('resize', () => { const p = leer('horizonte.nebulaPos', { x: 0.02, y: 0.56 }); colocar(p.x, p.y); });
    b.addEventListener('keydown', (e) => { // alternativa al arrastre: flechas del teclado
      const d = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.04], ArrowDown: [0, 0.04] }[e.key];
      if (!d) return;
      e.preventDefault();
      const p = { x: b.offsetLeft / innerWidth + d[0], y: b.offsetTop / innerHeight + d[1] };
      colocar(p.x, p.y); guardar('horizonte.nebulaPos', { x: b.offsetLeft / innerWidth, y: b.offsetTop / innerHeight });
    });
    b.reubicar = () => { guardar('horizonte.nebulaPos', null); colocar(0.02, 0.56); };
    let arrastre = null;
    b.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY, l: b.offsetLeft, t: b.offsetTop, movio: false }; b.setPointerCapture(e.pointerId); });
    b.addEventListener('pointermove', (e) => {
      if (!arrastre) return;
      const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (!arrastre.movio && Math.hypot(dx, dy) < 6) return;
      arrastre.movio = true;
      b.classList.add('arrastrando');
      colocar((arrastre.l + dx) / window.innerWidth, (arrastre.t + dy) / window.innerHeight);
    });
    b.addEventListener('pointerup', () => {
      if (!arrastre) return;
      const movio = arrastre.movio;
      arrastre = null;
      b.classList.remove('arrastrando');
      if (movio) { guardar('horizonte.nebulaPos', { x: b.offsetLeft / window.innerWidth, y: b.offsetTop / window.innerHeight }); return; }
      pistaFlotante();
    });
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pistaFlotante(); } });
  }
  b.removeAttribute('hidden');
  b.setAttribute('aria-label', t('Nebula: pedir una pista (puedes arrastrarla o moverla con las flechas)'));
}

function pistaFlotante() {
  const m = G.mision, pant = document.body.dataset.pantalla;
  if (m?.id === 'cero' && G.coachSalteado) { G.coachSalteado = false; coach(); if (document.getElementById('coach')) return; }
  if (pant === 'diseno') { G.briefingVisto[m.id] = false; construir(); return; }
  const viejo = document.getElementById('nebula-globo');
  if (viejo) { viejo.remove(); return; }
  let texto = m?.nebula?.construir || '';
  if (pant === 'mision') {
    const e = actual(), ultimo = G.registros[G.registros.length - 1];
    const pista = pistaNebula(e, ultimo);
    texto = pista ? pista.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : t('Mira las barras de arriba: si alguna baja rápido, usa el refugio, la ración o apaga el invernadero. En el Cronoscopio puedes volver a un día pasado.');
  }
  if (pant === 'resultado') texto = t('Lee la cadena de causas: ahí está la pista de qué cambiar. Puedes rebobinar a un día pasado o rediseñar la base.');
  const b = document.getElementById('nebula-flotante');
  const g = document.createElement('div');
  g.id = 'nebula-globo';
  g.setAttribute('role', 'status');
  g.innerHTML = `<b>Nebula</b><p>${esc(texto)}</p><button class="fantasma chico" aria-label="${t('Cerrar')}">${I('cerrar')}</button><button class="fantasma chico volver-lugar">↺ ${t('Volver a su lugar')}</button>`;
  document.body.appendChild(g);
  const r = b.getBoundingClientRect();
  const derecha = r.left < window.innerWidth / 2;
  g.style.top = `${Math.min(window.innerHeight - 160, Math.max(10, r.top))}px`;
  g.style[derecha ? 'left' : 'right'] = `${derecha ? r.right + 10 : window.innerWidth - r.left + 10}px`;
  g.querySelector('button').addEventListener('click', () => g.remove());
  g.querySelector('.volver-lugar').addEventListener('click', () => { b.reubicar?.(); g.remove(); });
  leerEnVoz(texto);
  b.classList.add('vista');
}

new MutationObserver(() => nebulaFlotante()).observe(document.body, { attributes: true, attributeFilter: ['data-pantalla'] });

// Una sola capa pide atención a la vez: si habla la guía del Episodio 0 o el recorrido de la llama,
// el aviso de rendimiento espera, y Nebula (y su globo) se esconden hasta que terminen.
function ordenarCapas() {
  const guia = document.getElementById('coach') || document.getElementById('recorrido');
  document.getElementById('aviso-lento')?.classList.toggle('en-espera', Boolean(guia || document.querySelector('.modal')));
  document.getElementById('nebula-flotante')?.classList.toggle('en-espera', Boolean(guia));
  if (guia) document.getElementById('nebula-globo')?.remove();
}
new MutationObserver(ordenarCapas).observe(document.body, { childList: true });

function escucharEstado() {
  if (document.body.dataset.pantalla !== 'mision') return;
  const texto = estadoEnPalabras();
  A.anunciar(texto);
  leerEnVoz(texto);
}

function avanzar(maxDias) {
  for (let i = 0; i < maxDias; i++) {
    const e = actual();
    if (e.terminado) break;
    const { estado, registro } = S.paso(e, G.mision, G.hoy, G.nasa, G.juego);
    G.decisiones[e.dia] = { ...G.hoy };
    G.registros.push(registro);
    G.estados.push(estado);
    G.hoy = { ...G.hoy };
    if (registro.eventos.length || registro.apagados.length) break; // pausa para que el jugador reaccione
  }
  G.avisoRebobinado = null;
  const r = G.registros[G.registros.length - 1];
  if (actual().terminado) { A.vibrar([300, 120, 300, 120, 300]); final(); return; }
  if (r?.eventos.some((x) => x.tipo === 'tormenta_solar')) { sfx.tormenta(); A.vibrar([400, 150, 400]); }
  else if (r?.eventos.some((x) => x.tipo === 'tormenta_polvo')) { sfx.polvo(); A.vibrar([250, 100, 250]); }
  else if (r?.apagados.length || r?.eventos.length) { sfx.alarma(); A.vibrar([200, 100, 200]); }
  else sfx.paso();
  mision();
  // Lector de pantalla: qué pasó hoy (las alarmas interrumpen)
  const avisos = [...(r?.eventos || []).map((x) => x.texto), ...(r?.apagados?.length ? [t('Se apagó: {x}', { x: trLista(r.apagados).join(', ') })] : [])];
  A.anunciar(`${t('Día {n}', { n: actual().dia + 1 })}. ${avisos.join(' ')}`, avisos.length > 0);
  if (A.pref.leerEstado) leerEnVoz(`${avisos.join(' ')} ${estadoEnPalabras()}`);
}

function rebobinar(dia) {
  G.estados = G.estados.slice(0, dia + 1);
  G.registros = G.registros.slice(0, dia);
  G.hoy = { ...(G.decisiones[dia] || S.decisionesPorDefecto()) };
  G.decisiones = G.decisiones.slice(0, dia);
  G.rebobinados += 1;
  G.avisoRebobinado = dia;
  sfx.rebobinar();
  mision();
  efectoRebobinar(dia);
  A.anunciar(t('El Cronoscopio te llevó al día {n}. Cambia tus decisiones y avanza.', { n: dia + 1 }));
}

/** Ficha de un módulo al tocarlo en el mapa 3D: qué hace, cuánto cuesta y el dato de NASA que lo respalda. */
function fichaModulo(tipo) {
  const m = G.mision, j = G.juego.modulos, n = G.nasa.cifras;
  const marte = m?.planeta === 'marte';
  const e = document.body.dataset.pantalla === 'mision' ? actual() : null;
  const F = {
    habitat: [t('Hábitat'), t('Donde vive la tripulación. Fabrica oxígeno partiendo agua y gasta energía todo el día.'), `${G.juego.habitat.masa_t} t · ${G.juego.habitat.kwh_dia_base} kWh/${t('día')} + ${G.juego.habitat.kwh_dia_persona} ${t('por persona')}`, 'o2_persona_dia'],
    panel: [t('Paneles solares'), t('Producen energía solo cuando hay luz del Sol.'), t('{t} t · {k} kWh/día con luz', { t: j.panel.masa_t, k: j.panel.kwh_dia_luz }), marte ? 'luz_marte' : 'ciclo_lunar_dias'],
    bateria: [t('Baterías'), t('Guardan la energía que sobra de día para usarla de noche o en una tormenta.'), `${j.bateria.masa_t} t · ${j.bateria.capacidad_kwh} kWh`, 'ciclo_lunar_dias'],
    reactor: [t('Reactor'), t('Da energía de día y de noche, sin depender del Sol.'), `${n.fsp_masa_t.valor} t · ${n.fsp_kw.valor} kW`, 'fsp_kw'],
    reciclador: [t('Reciclador'), t('Limpia y recupera casi toda el agua que usa la tripulación.'), `${j.reciclador.masa_t} t · ${j.reciclador.kwh_dia} kWh/${t('día')}`, 'recuperacion_agua'],
    invernadero: [t('Invernadero'), t('Produce parte de la comida, pero gasta agua y energía.'), `${j.invernadero.masa_t} t · ${j.invernadero.kwh_dia} kWh/${t('día')}`, 'veggie'],
    extractor: [t('Extractor de hielo'), t('Saca agua del hielo escondido en el suelo.'), `${j.extractor.masa_t} t · +${j.extractor.agua_kg_dia} kg ${t('agua')}/${t('día')}`, 'lcross_hielo'],
    moxie: ['MOXIE', t('Fabrica oxígeno a partir del CO₂ del aire de Marte, sin gastar agua.'), `${j.moxie.masa_t} t · ${j.moxie.o2_kg_dia} kg O₂/${t('día')}`, 'moxie_o2'],
    lander: [t('Módulo de aterrizaje'), t('La nave que trajo a la tripulación y su carga.'), '', null],
    'obj-bandera': [t('Bandera del Perú'), t('La primera base de la expedición peruana. En la Luna no hay viento: la bandera va sostenida por una barra, como en las misiones Apolo.'), '', null],
    'obj-contenedores': [t('Contenedores de carga'), t('Cada kilo que llega en el cohete cuenta. Aquí se guardan repuestos, comida y agua de reserva.'), '', null],
    'obj-torre': [t('Torre meteorológica'), t('Mide el viento, la temperatura y el polvo. En Marte avisa cuando se acerca una tormenta de polvo.'), '', 'polvo_marte_2018'],
    'obj-telescopio': [t('Telescopio'), t('Sin aire que haga titilar las estrellas, desde la Luna se ve el cielo muy nítido. También vigila el Sol.'), '', null],
    'obj-huerto': [t('Huerto de papas andinas'), t('Papas nativas del Perú. El Centro Internacional de la Papa (Lima) y la NASA probaron si las papas pueden crecer en condiciones parecidas a las de Marte.'), '', 'veggie'],
    'obj-antena': [t('Antena de espacio profundo'), t('Habla con la Tierra. Desde Marte, cada mensaje tarda entre unos 4 y 24 minutos en llegar.'), '', 'retraso_tierra_marte'],
    'obj-dron': [t('Dron explorador'), t('Explora desde el aire. En Marte, el helicóptero Ingenuity de la NASA demostró que se puede volar aunque el aire sea muy delgado.'), '', null],
    'obj-llama': [t('Estatua de la llama'), t('Homenaje a la mascota de la expedición. Las llamas viven a más de 4000 metros de altura, donde el aire tiene menos oxígeno.'), '', null],
  }[tipo];
  if (!F) return;
  const [nombre, que, costo, dato] = F;
  const estado = e && tipo === 'bateria' ? `<p class="estado-modulo">${I('bateria')} ${t('Carga ahora: {x} kWh', { x: fmt(e.energia) })}</p>`
    : e && (e.apagados || G.registros[G.registros.length - 1]?.apagados || []).some((a) => a.startsWith(tipo)) ? `<p class="estado-modulo mal">${I('alerta')} ${t('Apagado por falta de energía')}</p>` : '';
  document.getElementById('ficha-modulo')?.remove();
  const f = document.createElement('aside');
  f.id = 'ficha-modulo';
  f.setAttribute('role', 'dialog');
  f.setAttribute('aria-label', nombre);
  const c = dato && n[dato];
  f.innerHTML = `<div class="entre"><b>${nombre}</b><button class="boton-icono" aria-label="${t('Cerrar')}">${I('cerrar')}</button></div>
    <p>${que}</p>${costo ? `<p class="costo-modulo">${I('masa')} ${esc(costo)} ${procedencia(null)}</p>` : ''}${estado}
    ${c ? `<div class="dato-modulo">${procedencia(c)}<p>${esc(c.texto)}</p><a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${t('Fuente: {x}', { x: esc(c.fuente) })}</a></div>` : ''}`;
  document.body.appendChild(f);
  const cerrar = () => { f.remove(); G.mundo?.soltarEnfoque(); };
  f.querySelector('button').addEventListener('click', cerrar);
  A.anunciar(`${nombre}. ${que}`);
  clearTimeout(G.cierraFicha);
  G.cierraFicha = setTimeout(() => { if (f.isConnected) cerrar(); }, 20000);
  if (!G.rec.fichas.includes(tipo)) { G.rec.fichas.push(tipo); guardarRec(); revisarInsignias(); }
}

/** Efecto visual del Cronoscopio: cinta que rebobina y el día grande en pantalla. */
function efectoRebobinar(dia) {
  if (A.pref.menosMovimiento) return;
  document.getElementById('efecto-rebobinar')?.remove();
  const capa = document.createElement('div');
  capa.id = 'efecto-rebobinar';
  capa.setAttribute('aria-hidden', 'true');
  capa.innerHTML = `<span>${I('cronoscopio')} ${t('Día {n}', { n: dia + 1 })}</span>`;
  document.body.appendChild(capa);
  document.body.classList.add('rebobinando');
  setTimeout(() => { capa.remove(); document.body.classList.remove('rebobinando'); }, 1100);
}

/** Confeti con los colores de ASU STELLAR (éxito) o destello rojo (falla). */
function efectoFinal(exito) {
  if (A.pref.menosMovimiento) return;
  if (!exito) {
    document.body.classList.add('destello-falla');
    setTimeout(() => document.body.classList.remove('destello-falla'), 900);
    return;
  }
  const capa = document.createElement('div');
  capa.className = 'confeti';
  capa.setAttribute('aria-hidden', 'true');
  const colores = ['#ffc94a', '#5cc8ee', '#e77fb3', '#ff9a52', '#6fd39a', '#ffffff'];
  capa.innerHTML = Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colores[i % colores.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${2.2 + Math.random() * 1.6}s;--giro:${Math.random() * 720 - 360}deg;--deriva:${Math.random() * 160 - 80}px"></i>`).join('');
  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), 4500);
}

function pistaNebula(e, ultimo) {
  if (!guiada()) return '';
  if (ultimo?.eventos.some((x) => x.tipo === 'alerta_polvo')) return nebula(t('Viene una tormenta de polvo: los paneles casi no producirán. Ahorra energía: apaga el invernadero.'), 'alerta');
  if (ultimo?.eventos.some((x) => x.tipo === 'alerta_solar')) return nebula(t('¡Una llamarada! Las partículas llegan mañana. Activa el <strong>refugio</strong> antes de avanzar.'), 'alerta');
  if (e.dia === 0) return nebula(t('Cada <strong>Avanzar</strong> pasa un día. Si una barra llega a cero, la base falla. En el <strong>Cronoscopio</strong> toca un día pasado para <strong>rebobinar</strong>.'));
  if (ultimo?.apagados.length) return nebula(t('Hoy se apagó <strong>{x}</strong>. ¿Qué puedes cambiar?', { x: esc(trLista(ultimo.apagados).join(', ')) }), 'alerta');
  if (ultimo && ultimo.luz && !S.hayLuz(G.mision, e.dia, G.nasa)) return nebula(t('Se puso el Sol: los paneles ya no producen. Solo cuentan las baterías y el reactor.'), 'pensando');
  return '';
}

const valoresHUD = {};
function recurso(icono, nombre, valor, max, texto, invertir = false) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  const previo = valoresHUD[nombre];
  valoresHUD[nombre] = valor;
  const cambio = previo === undefined || Math.abs(valor - previo) < 0.05 ? '' : (valor > previo) !== invertir ? 'sube' : 'baja';
  const clase = invertir ? (pct > 80 ? 'peligro' : pct > 55 ? 'alerta' : '') : (pct < 20 ? 'peligro' : pct < 40 ? 'alerta' : '');
  return `<div class="recurso ${clase} ${cambio}" style="--pct:${pct}%" title="${nombre}" role="img" aria-label="${texto} ${nombre}"><span class="ico" aria-hidden="true">${icono}</span>
    <span class="val"><b>${texto}</b><small>${nombre}</small></span><i style="width:${pct}%"></i></div>`;
}

function mision() {
  const foco = document.activeElement?.id || (document.activeElement?.dataset?.dec && `[data-dec="${document.activeElement.dataset.dec}"]`);
  queueMicrotask(() => { if (!foco) return; (foco.startsWith('[') ? $app.querySelector(foco) : document.getElementById(foco))?.focus(); });
  document.body.dataset.pantalla = 'mision';
  const m = G.mision, e = actual(), c = e.config, j = G.juego;
  const ultimo = G.registros[G.registros.length - 1];
  const luz = S.hayLuz(m, e.dia, G.nasa);
  const capacidad = c.bateria * j.modulos.bateria.capacidad_kwh;
  const ini = G.estados[0];
  const tormentaAhora = ultimo?.eventos.some((x) => x.tipo === 'tormenta_solar');
  pintar({
    config: c, luz, carga: capacidad ? e.energia / capacidad : 0, danados: e.panelesDanados, apagados: ultimo?.apagados || [],
    tormenta: Boolean(tormentaAhora), polvo: Boolean(e.polvo), refugio: G.hoy.refugio, tripulacion: m.tripulacion, invernaderoOn: G.hoy.invernadero,
    planeta: m.planeta || 'luna',
  }, 'mision');
  ambienteEstado({ noche: !luz, tormenta: Boolean(tormentaAhora || e.polvo) });

  const linea = Array.from({ length: m.dias }, (_, i) => {
    const r = G.registros[i];
    const ev = m.eventos.filter((x) => x.dia === i);
    const marca = ev.some((x) => x.tipo.includes('solar')) ? I('llamarada') : ev.some((x) => x.tipo.includes('polvo')) ? I('polvo') : ev.some((x) => x.tipo === 'micrometeorito') ? I('meteorito') : ev.length ? I('averia') : '';
    const cls = [S.hayLuz(m, i, G.nasa) ? 'luz' : 'noche', i > e.dia ? 'futuro' : '', i === e.dia ? 'hoy' : '', r?.apagados.length ? 'mal' : '', r?.decision.refugio ? 'refugio' : ''].join(' ');
    const puede = i < e.dia;
    return `<button class="${cls}" ${puede ? `data-dia="${i}"` : 'disabled'} aria-label="${puede ? t('Día {n}, rebobinar aquí', { n: i + 1 }) : t('Día {n}', { n: i + 1 })}"><span>${i + 1}</span><span class="marca">${i <= e.dia ? marca : ''}</span></button>`;
  }).join('');

  const avisos = [];
  if (G.avisoRebobinado !== null) avisos.push(`<div class="toast info">${I('cronoscopio')} ${t('El Cronoscopio te llevó al día {n}. Cambia tus decisiones y avanza.', { n: G.avisoRebobinado + 1 })}</div>`);
  if (ultimo) for (const ev of ultimo.eventos) avisos.push(`<div class="toast ${ev.tipo === 'tormenta_solar' ? 'peligro' : 'alerta'}"><b>${t('Día {n}', { n: ultimo.dia + 1 })}</b> · ${esc(ev.texto)}${ev.url ? ` <a href="${esc(ev.url)}" target="_blank" rel="noopener">DONKI ↗</a>` : ''}</div>`);
  if (ultimo?.apagados.length) avisos.push(`<div class="toast peligro"><b>${t('Día {n}', { n: ultimo.dia + 1 })}</b> · ${t('Se apagó: {x}', { x: esc(trLista(ultimo.apagados).join(', ')) })}</div>`);

  const habilidad = (k, icono, etiqueta, detalle, mostrar = true) => mostrar ? `
    <button class="habilidad" aria-pressed="${G.hoy[k]}" data-dec="${k}" title="${detalle}"><span class="ico">${icono}</span><span class="txt">${etiqueta}</span></button>` : '';

  const bitacora = G.registros.slice().reverse().map((r) => `<li><b>${t('Día {n}', { n: r.dia + 1 })}</b> ${r.luz ? I('sol') : I('noche')} +${fmt(r.produccion)} / −${fmt(r.demanda)} kWh${r.decision.refugio ? ' · ' + I('refugio') : ''}${r.eventos.length ? ' · ' + esc(r.eventos.map((x) => x.texto).join(' ')) : ''}</li>`).join('');

  $app.innerHTML = `
    <header class="hud-superior">
      <div class="grupo-botones"><button id="abortar" class="boton-icono" aria-label="${t('Volver al diseño de la base')}">${I('ajustes')}</button>${botonSonido()}${botonVoz()}${botonEscuchar()}${botonAcc()}${botonAyuda()}</div>
      <div class="recursos">
        ${recurso(I('energia'), 'kWh', e.energia, capacidad || 1, fmt(e.energia))}
        ${recurso(I('o2'), t('kg O₂'), e.o2, Math.max(ini.o2, 1), fmt(e.o2, 1))}
        ${recurso(I('agua'), t('kg agua'), e.agua, Math.max(ini.agua, 1), fmt(e.agua))}
        ${recurso(I('comida'), t('kg comida'), e.comida, Math.max(ini.comida, 1), fmt(e.comida))}
        ${recurso(I('radiacion'), `/${m.limite_dosis_msv} mSv`, e.dosis, m.limite_dosis_msv, fmt(e.dosis, 1), true)}
        ${recurso(I('salud'), t('salud'), e.salud, 100, `${fmt(e.salud)}%`)}
        ${recurso(I('ciencia'), t('/{n} ciencia', { n: m.objetivo_ciencia }), e.ciencia, m.objetivo_ciencia, fmt(e.ciencia))}
      </div>
      <div class="reloj-dia ${luz ? 'dia' : 'noche'}" aria-label="${t('Día {n} de {t}', { n: Math.min(e.dia + 1, m.dias), t: m.dias })}">
        <span class="astro">${luz ? I('sol') : I('noche')}</span><b>${Math.min(e.dia + 1, m.dias)}</b><small>/ ${m.dias}</small>
        <span class="rebobinados" title="${t('Rebobinados')}">${I('rebobinar')} ${G.rebobinados}</span>
      </div>
    </header>

    <div class="toasts">${avisos.join('')}</div>
    <div class="zona-nebula">${pistaNebula(e, ultimo)}</div>

    <nav class="habilidades" aria-label="${t('Decisiones para el día {n}', { n: e.dia + 1 })}">
      <small>${t('Día {n}', { n: e.dia + 1 })}</small>
      ${habilidad('refugio', I('refugio'), t('Refugio'), t('Protege 90 % de la radiación de tormenta; ese día no hay ciencia'))}
      ${habilidad('racion', I('racion'), t('Ración'), t('Comen 20 % menos; baja la salud'))}
      ${habilidad('invernadero', I('invernadero'), t('Invernadero'), t('Apágalo para ahorrar energía y agua'), c.invernadero)}
      <button class="habilidad" id="bitacora" aria-expanded="${Boolean(G.bitacoraAbierta)}"><span class="ico">${I('bitacora')}</span><span class="txt">${t('Bitácora')}</span></button>
    </nav>

    <aside class="cajon ${G.bitacoraAbierta ? 'abierto' : ''}" aria-label="${t('Bitácora')}"><div class="entre"><h3>${I('bitacora')} ${t('Bitácora')}</h3><button class="boton-icono chico-btn" id="cerrarBitacora" aria-label="${t('Cerrar bitácora')}">${I('cerrar')}</button></div>${bitacora ? `<ul class="bitacora">${bitacora}</ul>` : `<p class="suave chico">${t('Aún no pasa ningún día.')}</p>`}</aside>

    <footer class="hud-inferior">
      <div class="cronoscopio"><span class="cronoscopio-titulo">${I('cronoscopio')} ${t('Cronoscopio')}</span>
      <div class="linea-tiempo" tabindex="0" role="group" aria-label="${t('Cronoscopio: toca un día pasado para rebobinar')}">${linea}</div></div>
      <div class="acciones">
        <button class="boton-avanzar" id="dia1">${I('avanzar')} ${t('AVANZAR')} <small>${t('1 día')}</small></button>
        ${G.aula.tranquilo ? '' : `<button class="boton-rapido" id="dia5" aria-label="${t('Avanzar 5 días')}">${I('rapido')}<small>×5</small></button>`}
      </div>
    </footer>`;

  document.getElementById('abortar').addEventListener('click', () => { G.config = { ...ini.config }; G.rebobinados += 1; construir(); });
  document.getElementById('dia1').addEventListener('click', () => avanzar(1));
  document.getElementById('dia5')?.addEventListener('click', () => avanzar(5));
  document.getElementById('bitacora').addEventListener('click', () => { G.bitacoraAbierta = !G.bitacoraAbierta; mision(); });
  document.getElementById('cerrarBitacora').addEventListener('click', () => { G.bitacoraAbierta = false; mision(); });
  enlazarSonido();
  $app.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => { G.hoy[b.dataset.dec] = !G.hoy[b.dataset.dec]; mision(); }));
  $app.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => rebobinar(+b.dataset.dia)));
  const hoy = $app.querySelector('.linea-tiempo .hoy');
  if (hoy) hoy.parentElement.scrollLeft = hoy.offsetLeft - hoy.parentElement.clientWidth / 2;
  decirNebula();
  coach();
}

// ───────────────────────── Resultado ─────────────────────────
function final() {
  document.getElementById('ficha-modulo')?.remove();
  document.body.dataset.pantalla = 'resultado';
  const m = G.mision, e = actual();
  const res = S.resultado(e, m);
  const siguiente = G.misiones.slice(G.misiones.indexOf(m) + 1).find((x) => Boolean(x.avanzada) === Boolean(m.avanzada));
  const ultimo = G.registros[G.registros.length - 1];
  pintar({
    config: e.config, luz: ultimo?.luz ?? true, carga: Math.max(0, e.energia) / Math.max(1, e.config.bateria * G.juego.modulos.bateria.capacidad_kwh),
    danados: e.panelesDanados, apagados: res.exito ? [] : ultimo?.apagados?.length ? ultimo.apagados : ['soporte'], tormenta: res.motivo === 'radiacion',
    refugio: false, tripulacion: res.exito ? m.tripulacion : 0, polvo: Boolean(e.polvo), planeta: m.planeta || 'luna',
  }, 'resultado');
  const estrellas = res.exito ? (G.rebobinados === 0 ? 3 : G.rebobinados <= 2 ? 2 : 1) : 0;
  if (!G.demo) {
    G.historial.push({ mision: m.id, exito: res.exito, motivo: res.motivo || null, prediccion: G.prediccion, rebobinados: G.rebobinados, estrellas, fecha: new Date().toISOString() });
    guardar('horizonte.historial', G.historial.slice(-300));
  }
  if (!G.demo) api.enviarPartida({
    mision: m.id, exito: res.exito, motivo: res.motivo || null, dias: e.dia, ciencia: e.ciencia,
    rebobinados: G.rebobinados, estrellas, config: e.config, nombre: G.jugador.nombre, aula: G.jugador.aula, prediccion: G.prediccion,
  });

  const c = modal();
  if (res.exito) sfx.exito(); else sfx.falla();
  efectoFinal(res.exito);
  // El progreso se guarda antes de la recompensa: así las insignias de la misión (noche, cosecha, escudo, comandante) se ganan en esta misma pantalla
  if (res.exito && !G.demo) {
    G.progreso[m.id] = Math.max(G.progreso[m.id] || 0, estrellas);
    guardar('horizonte.progreso', G.progreso);
  }
  const premio = G.demo ? null : darRecompensa(m, res, estrellas);
  if (res.exito) {
    // Lo que sobró pasa como reserva a la siguiente misión de la campaña (la mitad, redondeada)
    const destino = m.reserva_a && G.misiones.find((x) => x.id === m.reserva_a);
    const reserva = destino && { o2: Math.round(Math.max(0, e.o2) * 5) / 10, agua: Math.round(Math.max(0, e.agua) / 2), comida: Math.round(Math.max(0, e.comida) / 2) };
    if (reserva && !G.demo) {
      G.reservas[destino.id] = reserva;
      guardar('horizonte.reservas', G.reservas);
    }
    c.innerHTML = `
      <div class="centrado celebracion">
        ${personaje('llama-astronauta', 'llama-logro')}
        <p class="lema">${t('Misión cumplida')}</p>
        <h2>${esc(m.titulo)}</h2>
        <div class="estrellas-res" aria-label="${t('{n} de 3 estrellas', { n: estrellas })}">${'★'.repeat(estrellas)}<span>${'★'.repeat(3 - estrellas)}</span></div>
      </div>
      ${resultadoPrediccion(null)}
      ${bloquePremio(premio)}
      <div class="resumen-diseno">
        <div class="dato bien"><small>${t('Sobrevivieron')}</small><b>${t('{a} de {b}', { a: m.tripulacion, b: m.tripulacion })}</b></div>
        <div class="dato"><small>${t('Días')}</small><b>${m.dias}</b></div>
        <div class="dato"><small>${t('Ciencia')}</small><b>${e.ciencia} / ${m.objetivo_ciencia}</b></div>
        <div class="dato"><small>${t('Rebobinados')}</small><b>${G.rebobinados}</b></div>
      </div>
      ${reserva ? `<div class="aviso-reserva">${I('caja')}<span>${t('Reserva para «{x}»:', { x: esc(sinNumero(destino.titulo)) })} <b>+${fmt(reserva.o2, 1)} kg O₂ · +${fmt(reserva.agua)} kg ${t('agua')} · +${fmt(reserva.comida)} kg ${t('comida')}</b></span></div>` : ''}
      ${nebula(esc(m.nebula.exito), 'feliz')}
      <label class="cuentalo">${I('lapiz')} ${t('Tu bitácora: ¿qué cambiaste o qué protegiste para lograrlo?')}
        <textarea id="nota" maxlength="200" rows="2" placeholder="${t('Una frase basta')}">${esc(G.notas[m.id] || '')}</textarea></label>
      <div class="fila" id="accionesFinal">
        ${siguiente ? `<button class="primario" id="sig">${t('Siguiente: {x}', { x: esc(sinNumero(siguiente.titulo)) })} ▶</button>` : ''}
        ${m.evaluacion && !G.eval.caso ? `<button class="primario" id="evalfinal">${I('prueba')} ${t('Prueba final y caso Artemis-7')}</button>` : ''}
        <button class="secundario" id="inicio">${t('Menú')}</button>
      </div>`;
    accionesAlHud();
    document.getElementById('evalfinal')?.addEventListener('click', G.eval.final ? casoArtemis : pruebaFinal);
    const guardarNota = () => {
      const nota = document.getElementById('nota')?.value.trim();
      if (!nota || nota === G.notas[m.id]) return;
      G.notas[m.id] = nota;
      guardar('horizonte.notas', G.notas);
      api.enviarNota({ mision: m.id, nota, nombre: G.jugador.nombre, aula: G.jugador.aula });
    };
    document.getElementById('nota').addEventListener('change', guardarNota);
    document.getElementById('sig')?.addEventListener('click', () => { guardarNota(); G.mision = siguiente; G.config = S.configInicial(siguiente); G.rebobinados = 0; construir(); });
    document.getElementById('inicio').addEventListener('click', () => { guardarNota(); inicio(); });
    document.getElementById('irTripulacion')?.addEventListener('click', () => { guardarNota(); pantallaTripulacion(); });
    coach();
    setTimeout(decirNebula, 1600); // después de la fanfarria
    return;
  }

  const a = trAnalisis(S.analizarFalla(res.motivo, G.registros, e, m, G.nasa));
  const diaRebobinar = Math.max(0, Math.min(a.dia, G.estados.length - 2));
  c.innerHTML = `
    <div class="sello">${t('FALLA · DÍA {n}', { n: e.dia })}</div>
    <h2>${I('alerta', 'rojo')} ${esc(a.titulo)}</h2>
    <p class="suave">${t('Así ocurrió:')}</p>
    <ol class="cadena">${a.cadena.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    ${nebula(`<b>${t('Qué cambiar:')}</b> ${esc(a.consejo)}`, 'pensando')}
    ${resultadoPrediccion(res.motivo)}
    <details class="mas-datos"><summary>${I('datos')} ${t('Ver el dato NASA ({n})', { n: a.datos.length })}</summary>${a.datos.map(cifraNasa).join('')}</details>
    ${bloquePremio(premio)}
    <div class="fila" id="accionesFinal">
      <button class="${a.redisenar ? 'primario' : 'secundario'}" id="redisenar">${I('averia')} ${a.arreglo ? `${t('Rediseñar')}: ${esc(a.arreglo.charAt(0).toLowerCase() + a.arreglo.slice(1))}` : t('Rediseñar la base')}</button>
      <button class="${a.redisenar ? 'secundario' : 'primario'}" id="rebobinar">${I('cronoscopio')} ${a.redisenar ? t('Revisar el día {n}', { n: diaRebobinar + 1 }) : t('Rebobinar al día {n}', { n: diaRebobinar + 1 })}</button>
    </div>`;
  accionesAlHud();
  document.getElementById('rebobinar').addEventListener('click', () => rebobinar(diaRebobinar));
  document.getElementById('redisenar').addEventListener('click', () => { G.config = { ...G.estados[0].config }; G.rebobinados += 1; olvidarUltimo(); construir(); });
  document.getElementById('irTripulacion')?.addEventListener('click', () => pantallaTripulacion());
  setTimeout(decirNebula, 1400);
  G.tutorialFallo = G.tutorialFallo || G.mision.id === 'cero';
  coach();
}

/** Los botones del final de la misión van en una barra fija en pantalla (HUD), siempre a la vista. */
function accionesAlHud() {
  const fila = document.getElementById('accionesFinal');
  if (!fila) return;
  const barra = document.createElement('nav');
  barra.className = 'hud-acciones';
  barra.setAttribute('aria-label', t('Qué hacer ahora'));
  barra.append(...fila.children);
  barra.insertAdjacentHTML('beforeend', botonAyuda());
  fila.remove();
  $app.appendChild(barra);
  document.querySelector('.modal')?.classList.add('resultado');
}

// ───────────────────────── Evaluación del aprendizaje ─────────────────────────
const ultimaMision = () => G.misiones.find((m) => m.evaluacion) || G.misiones[G.misiones.length - 1];
const finalDesbloqueada = () => Boolean(G.progreso[ultimaMision().id]);

function guardarEval(tipo, r) {
  G.eval[tipo] = { puntaje: r.puntaje, maximo: r.maximo, respuestas: r.respuestas, nivel: r.nivel?.codigo, fecha: new Date().toISOString() };
  guardar('horizonte.evaluacion', G.eval);
  api.enviarEvaluacion({ tipo, puntaje: r.puntaje, maximo: r.maximo, nivel: r.nivel?.codigo || null, respuestas: r.respuestas, nombre: G.jugador.nombre, aula: G.jugador.aula });
}

function tarjetaAprendizaje() {
  const ev = G.eval;
  const fila = (icono, nombre, hecho, texto, boton, bloqueado) => `
    <div class="fila-eval ${hecho ? 'hecho' : ''}"><span class="ico">${icono}</span>
      <span class="info"><b>${nombre}</b><small class="suave">${texto}</small></span>
      ${boton && !bloqueado ? `<button class="${hecho ? 'fantasma' : 'secundario'}" data-eval="${boton}">${hecho ? t('Repetir') : t('Hacer')}</button>` : `<span class="pastilla">${bloqueado ? I('candado') : I('check')}</span>`}</div>`;
  const bloqueadaFinal = !finalDesbloqueada();
  return `<div class="aprendizaje">
    <div class="entre"><h2 class="titulo-seccion">${t('Tu aprendizaje')}</h2>${ev.inicial && ev.final && ev.caso ? `<button class="fantasma" data-eval="resumen">${t('Resumen →')}</button>` : ''}</div>
    ${fila(I('prueba'), t('Prueba inicial'), ev.inicial, ev.inicial ? `${ev.inicial.puntaje}/${ev.inicial.maximo}` : t('Antes de jugar · 2 min'), ev.inicial ? null : 'inicial')}
    ${fila(I('final'), t('Prueba final'), ev.final, ev.final ? `${ev.final.puntaje}/${ev.final.maximo}` : bloqueadaFinal ? t('Completa “{x}”', { x: esc(sinNumero(ultimaMision().titulo)) }) : t('Lista para hacer'), 'final', bloqueadaFinal)}
    ${G.historial.length ? `<div class="fila-eval informe-fila"><span class="ico">${I('estrella')}</span><span class="info"><b>${t('Informe del comandante')}</b><small class="suave">${completaCampana() ? t('¡Campaña completa! Incluye tu certificado') : t('Tus misiones, predicciones y bitácora')}</small></span><button class="secundario" data-eval="informe">${t('Ver')}</button></div>` : ''}
    ${fila(I('caso'), t('Caso Artemis-7'), ev.caso, ev.caso ? `${ev.caso.puntaje}/8 · ${ev.caso.nivel}` : t('Rúbrica 0–8 · después de la final'), 'caso', !ev.final)}
  </div>`;
}

function pruebaInicial(despues) {
  document.body.dataset.pantalla = 'modal';
  E.mostrarPrueba(modal(), G.evaluacion.inicial, {
    conRespuestas: false,
    alTerminar: (r) => { guardarEval('inicial', r); despues(); },
    alSaltar: () => { G.eval.saltoInicial = true; guardar('horizonte.evaluacion', G.eval); despues(); },
  });
}

function pruebaFinal() {
  document.body.dataset.pantalla = 'modal';
  E.mostrarPrueba(modal({ ancho: true }), G.evaluacion.final, { conRespuestas: true, nasa: G.nasa, alTerminar: (r) => { guardarEval('final', r); casoArtemis(); } });
}

function casoArtemis() {
  document.body.dataset.pantalla = 'modal';
  E.mostrarCaso(modal({ ancho: true }), G.evaluacion.caso, { niveles: G.evaluacion.niveles, alTerminar: (r) => { guardarEval('caso', r); resumenAprendizaje(); } });
}

const completaCampana = () => G.misiones.filter((m) => !m.avanzada && !m.tutorial).every((m) => G.progreso[m.id]);

/** Informe del comandante: misiones, predicciones, bitácora y aprendizaje en una hoja imprimible (certificado si completó la campaña). */
function informeComandante() {
  document.body.dataset.pantalla = 'modal';
  const h = G.historial, ev = G.eval;
  const certificado = completaCampana();
  const filas = G.misiones.filter((m) => h.some((x) => x.mision === m.id) || (!m.avanzada && !m.tutorial)).map((m) => {
    const intentos = h.filter((x) => x.mision === m.id);
    const conPred = intentos.filter((x) => x.prediccion);
    const aciertos = conPred.filter((x) => x.prediccion === (x.exito ? 'exito' : x.motivo)).length;
    const est = G.progreso[m.id] || 0;
    return `<tr><td><b>${esc(sinNumero(m.titulo))}</b><br><small>${esc(m.lugar)}</small></td>
      <td>${est ? `<span class="estrellas-inf">${'★'.repeat(est)}<span>${'★'.repeat(3 - est)}</span></span>` : intentos.length ? t('En curso') : '—'}</td>
      <td>${intentos.length || '—'}</td><td>${conPred.length ? `${aciertos}/${conPred.length}` : '—'}</td></tr>`;
  }).join('');
  const total = h.filter((x) => x.prediccion), ok = total.filter((x) => x.prediccion === (x.exito ? 'exito' : x.motivo)).length;
  const g = E.ganancia(ev.inicial?.puntaje, ev.final?.puntaje, 5);
  const frases = G.misiones.filter((m) => G.notas[m.id]).map((m) => `<li><b>${esc(sinNumero(m.titulo))}:</b> «${esc(G.notas[m.id])}»</li>`).join('');
  const hoy = new Date().toLocaleDateString(getIdioma() === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <article class="informe ${certificado ? 'certificado' : ''}">
      <header class="informe-cabecera">
        <img src="assets/marca/logo-color.webp" alt="ASU STELLAR" width="1200" height="800">
        <div><p class="lema">${certificado ? t('Certificado') : t('Informe del comandante')}</p>
          <h2>${certificado ? t('Comandante de la Expedición · de la Luna a Marte') : t('Bitácora de la expedición')}</h2></div>
        ${personaje('llama-astronauta', 'informe-llama')}
      </header>
      <p class="informe-nombre"><label>${t('Comandante')}: <input id="nombreInforme" maxlength="40" value="${esc(G.jugador.nombre)}" placeholder="${t('Escribe tu nombre')}"></label>
        ${G.jugador.aula ? `<span>· ${t('Aula {x}', { x: esc(G.jugador.aula) })}</span>` : ''} <span>· ${hoy}</span></p>
      ${certificado ? `<p class="informe-texto">${t('Completó las cuatro misiones de la expedición: mantuvo el aire en la noche lunar, equilibró aire y agua, logró la primera cosecha en Marte y protegió a su tripulación de una tormenta solar real.')}</p>` : ''}
      <table class="tabla-informe"><thead><tr><th>${t('Misión')}</th><th>${t('Resultado')}</th><th>${t('Intentos')}</th><th>${t('Predicciones acertadas')}</th></tr></thead><tbody>${filas}</tbody></table>
      <div class="informe-datos">
        <div><small>${t('Predicciones acertadas')}</small><b>${total.length ? `${ok}/${total.length}` : '—'}</b></div>
        <div><small>${t('Prueba inicial → final')}</small><b>${ev.inicial ? ev.inicial.puntaje : '—'} → ${ev.final ? ev.final.puntaje : '—'} / 5</b></div>
        <div><small>${t('Ganancia de aprendizaje')}</small><b>${g != null ? Math.round(g * 100) + ' %' : '—'}</b></div>
        <div><small>${t('Caso Artemis-7')}</small><b>${ev.caso ? `${ev.caso.puntaje}/8 · ${ev.caso.nivel}` : '—'}</b></div>
      </div>
      ${frases ? `<h3>${I('lapiz')} ${t('Lo que escribió en su bitácora')}</h3><ul class="informe-frases">${frases}</ul>` : ''}
      <footer class="informe-firmas"><div><span></span>${t('Docente')}</div><div><span></span>${t('Comandante')}</div></footer>
      <p class="informe-pie">ASU STELLAR · Horizonte · Stellar Experience, Moquegua · ${t('Proyecto para NASA Space Apps Challenge 2026')}</p>
    </article>
    <div class="fila no-imprimir"><button class="primario" id="imprimir">${I('descargar')} ${t('Imprimir o guardar en PDF')}</button><button class="secundario" id="volverInf">${t('Menú')}</button></div>`;
  c.querySelector('#nombreInforme').addEventListener('change', (ev2) => { G.jugador.nombre = ev2.target.value.trim(); guardar('horizonte.jugador', G.jugador); });
  c.querySelector('#imprimir').addEventListener('click', () => window.print());
  c.querySelector('#volverInf').addEventListener('click', inicio);
}

function resumenAprendizaje() {
  document.body.dataset.pantalla = 'modal';
  const { inicial, final: fin, caso } = G.eval;
  const g = E.ganancia(inicial?.puntaje, fin?.puntaje, 5);
  const barra = (v, max) => `<div class="barra"><span style="width:${max ? (v / max) * 100 : 0}%"></span></div>`;
  const c = modal({ cerrable: true });
  c.innerHTML = `
    <p class="lema">${t('Tu aprendizaje')}</p>
    <h2>${esc(G.jugador.nombre || t('Comandante'))}</h2>
    <div class="comparacion">
      <div><small class="suave">${t('Prueba inicial')}</small><b>${inicial ? `${inicial.puntaje}/5` : '—'}</b>${barra(inicial?.puntaje || 0, 5)}</div>
      <div class="flecha">→</div>
      <div><small class="suave">${t('Prueba final')}</small><b>${fin ? `${fin.puntaje}/5` : '—'}</b>${barra(fin?.puntaje || 0, 5)}</div>
    </div>
    ${g != null ? `<p class="centrado">${t('Ganancia de aprendizaje:')} <b>${Math.round(g * 100)} %</b> <span class="chico suave">${t('de lo que te faltaba aprender')}</span></p>` : `<p class="chico suave centrado">${t('Haz la prueba inicial y la final para ver tu ganancia.')}</p>`}
    ${caso ? `<div class="centrado"><p class="lema">${t('Rúbrica · Caso Artemis-7')}</p>
      <div class="nivel-res nivel-${caso.nivel}"><b>${caso.puntaje}</b><span>/ 8</span></div>
      <p><span class="pastilla">${caso.nivel} · ${esc(G.evaluacion.niveles.find((n) => n.codigo === caso.nivel)?.nombre || '')}</span></p></div>` : ''}
    ${nebula(g != null && g > 0 ? t('¡Aprendiste cómo se conectan los sistemas de una base! Eso es lo que hacen los ingenieros de la NASA.') : t('Cada falla que entiendes te acerca a ser comandante. ¡Vuelve a jugar!'), 'feliz')}
    <div class="fila"><button class="primario" id="volver">${t('Volver al menú')}</button></div>`;
  document.getElementById('volver').addEventListener('click', inicio);
  decirNebula();
}

// ───────────────────────── Historia (storyboard v2 de ASU STELLAR) ─────────────────────────
async function historia(i = 0) {
  if (!G.historia) {
    const base = await leerJson('historia.json');
    if (getIdioma() === 'en') {
      const en = await fetch('data/en/historia.json').then((r) => r.json()).catch(() => null);
      if (en) { base.capitulos = en.capitulos; base.nota = en.nota; base.cuadros = base.cuadros.map((c, k) => ({ ...c, ...en.cuadros[k] })); }
    }
    G.historia = base;
  }
  const H = G.historia, n = H.cuadros.length;
  i = Math.max(0, Math.min(n - 1, i));
  const f = H.cuadros[i];
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <div class="historia cap-${f.capitulo}">
      <figure><img src="assets/historia/cuadro-${String(i + 1).padStart(2, '0')}.webp" alt="${esc(f.narracion)}" width="627" height="627"></figure>
      <div class="historia-texto">
        <p class="lema">${esc(H.capitulos[f.capitulo])} · ${t('{a} de {b}', { a: i + 1, b: n })}</p>
        <h2>${esc(f.titulo)}</h2>
        <p>${esc(f.narracion)}</p>
        <p class="dialogo">${esc(f.dialogo)}</p>
        <div class="puntos-historia" aria-hidden="true">${H.cuadros.map((_, k) => `<span class="${k === i ? 'actual' : ''}"></span>`).join('')}</div>
        <div class="fila">
          <button class="secundario" id="hAnt" ${i === 0 ? 'disabled' : ''}>← ${t('Anterior')}</button>
          <button class="primario" id="hSig">${i === n - 1 ? t('¡A jugar!') : t('Siguiente') + ' →'}</button>
        </div>
        <p class="chico suave">${esc(H.nota)}</p>
      </div>
    </div>`;
  c.querySelector('#hAnt').addEventListener('click', () => historia(i - 1));
  c.querySelector('#hSig').addEventListener('click', () => (i === n - 1 ? inicio() : historia(i + 1)));
  const fig = c.querySelector('figure');
  let x0 = null;
  fig.addEventListener('pointerdown', (ev) => { x0 = ev.clientX; });
  fig.addEventListener('pointerup', (ev) => { if (x0 !== null && Math.abs(ev.clientX - x0) > 40) historia(i + (ev.clientX < x0 ? 1 : -1)); x0 = null; });
  document.onkeydown = (ev) => {
    if (!c.isConnected) { document.onkeydown = null; return; }
    if (ev.key === 'ArrowRight' && i < n - 1) historia(i + 1);
    if (ev.key === 'ArrowLeft' && i > 0) historia(i - 1);
    if (ev.key === 'Escape') inicio();
  };
}

// ───────────────────────── Fuentes ─────────────────────────
function fuentes() {
  document.body.dataset.pantalla = 'modal';
  const filas = Object.values(G.nasa.cifras).map((c) => `<tr><td>${esc(c.texto)}<br>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.fuente)}</a></td>
    <td>${procedencia(c)}</td></tr>`).join('');
  const j = G.juego.modulos;
  const valoresJuego = [
    [t('Panel solar'), t('{t} t · {k} kWh/día con luz', { t: j.panel.masa_t, k: j.panel.kwh_dia_luz })],
    [t('Batería'), `${j.bateria.masa_t} t · ${j.bateria.capacidad_kwh} kWh`],
    [t('Reciclador'), `${j.reciclador.masa_t} t · ${j.reciclador.kwh_dia} kWh/día`],
    [t('Invernadero'), `${j.invernadero.masa_t} t · ${j.invernadero.kwh_dia} kWh/día`],
    [t('Hábitat'), `${G.juego.habitat.masa_t} t · ${G.juego.habitat.kwh_dia_base} kWh/día + ${G.juego.habitat.kwh_dia_persona} kWh/día ${t('por persona')}`],
  ].map(([n, v]) => `<tr><td><b>${n}</b> · ${esc(v)}</td><td>${procedencia(null)}</td></tr>`).join('');
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <p class="lema">${t('Fuentes')}</p>
    <h2>${I('datos')} ${t('Datos NASA usados')}</h2>
    <p class="suave">${t('Cada número de la simulación tiene una fuente. Los valores de equilibrio del juego (masa de los paneles, energía del invernadero…) están aparte en <code>data/juego.json</code> y no se presentan como datos NASA.')}</p>
    <div class="leyenda-procedencia">${procedencia({ verificado: true })}<span>${t('cifra de una fuente de NASA')}</span>
      ${procedencia({ verificado: true, tipo: 'historico', fecha: 'AAAA' })}<span>${t('un hecho real con su fecha (archivo, no “en vivo”)')}</span>
      ${procedencia(null)}<span>${t('número inventado para equilibrar el juego')}</span></div>
    <table class="tabla-fuentes"><tbody>${filas}</tbody></table>
    <h3 style="margin-top:18px">${I('ajustes')} ${t('Valores del juego')}</h3>
    <p class="suave chico">${t('Estos números hacen que el juego sea jugable en pocos minutos. No son datos de NASA y no se presentan como tales.')}</p>
    <table class="tabla-fuentes"><tbody>${valoresJuego}</tbody></table>
    <h3 style="margin-top:18px">${t('Créditos')}</h3>
    <ul class="creditos chico">
      <li>${t('Efectos de sonido')}: “Oculus Audio Pack 01” — Oculus VR, LLC (Meta), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</li>
      <li>${t('Voz de Nebula')}: <a href="https://github.com/rhasspy/piper" target="_blank" rel="noopener">Piper TTS</a> (MIT). ${t('Voz en español')}: es_MX claude (Apache 2.0). ${t('Voz en inglés')}: <a href="https://github.com/hexgrad/kokoro" target="_blank" rel="noopener">Kokoro</a> af_heart (Apache 2.0).</li>
      <li>${t('Personajes, logo e ilustraciones')}: ${t('manual de marca ASU STELLAR 2026-01 y storyboard v2 del equipo Stellar Experience (ilustraciones generadas con IA).')}</li>
      <li>${t('Íconos')}: <a href="https://lucide.dev" target="_blank" rel="noopener">Lucide</a> (ISC). ${t('Tipografías')}: Unbounded, Baloo 2, Noto Sans, Space Mono (SIL OFL). ${t('Motor 3D')}: Three.js (MIT).</li>
    </ul>`;
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
cargar().catch((err) => {
  $app.innerHTML = `<p class="cargando">No se pudo cargar el juego (${esc(err.message)}). Ábrelo con un servidor local: <code>npm start</code></p>`;
});
