// Interfaz de ASU STELLAR · Horizonte: HUD de juego sobre el mapa 3D a pantalla completa.
// La lógica del juego vive en sim.js; aquí solo se dibujan pantallas y se pasan decisiones.
import * as S from './sim.js';
import { escena as escenaSVG } from './escena.js';
import * as api from './api.js';
import * as E from './evaluacion.js';
import { t, trLista, trAnalisis, getIdioma, setIdioma } from './i18n.js';
import { sfx, alternarSonido, sonidoActivo, ambienteEstado, fijarSonido } from './sonido.js';
import { decir, callar, olvidarUltimo, alternarVoz, vozActiva, fijarVoz } from './voz.js';
import { mostrarLanding } from './landing.js';

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
  notas: leer('horizonte.notas', {}),       // bitácora del estudiante («Cuéntalo»)
  prediccion: null,
  aula: leer('horizonte.modoAula', { activo: false, tranquilo: false }), // modo aula (enlace del docente)
  mundo: null,
};

function leer(clave, porDefecto) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: el juego sigue */ }
}

// ───────────────────────── Mundo (3D o, si no hay WebGL, SVG) ─────────────────────────
let ultimoSVG = {};
function pintar(o, vista) {
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
    const { Mundo, soportaWebGL } = await import('./mundo3d.js');
    if (!soportaWebGL()) throw new Error('sin WebGL');
    G.mundo = new Mundo(document.getElementById('mundo'), document.getElementById('etiquetas'));
  } catch (err) {
    console.warn('Modo 2D:', err.message);
    document.getElementById('mundo').hidden = true;
    document.body.classList.add('modo-2d');
  }
}

async function cargar() {
  const [nasa, juego, misiones, evaluacion] = await Promise.all([
    leerJson('nasa.json'), leerJson('juego.json'), leerJson('misiones.json'), leerJson('evaluacion.json'), iniciarMundo(),
  ]);
  G.juego = juego;
  G.orig = { nasa, misiones, evaluacion };
  await cargarIdioma();
  leerEnlaceDocente();
  api.detectar().then(vigilarPausa); // en el VPS hay API; en GitHub Pages no, y el juego funciona igual
  landing();
}

// ───────────────────────── Landing (primera pantalla) ─────────────────────────
function landing() {
  callar();
  pintar({ config: { panel: 8, bateria: 6, reactor: true, reciclador: true, invernadero: true, blindaje: 1 }, luz: true, carga: 0.9, tripulacion: 3, tormenta: false, polvo: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true, planeta: 'luna' }, 'portada');
  mostrarLanding({
    app: $app, mundo: G.mundo, misiones: G.misiones, nasa: G.nasa,
    alJugar: inicio, alHistoria: () => historia(),
    alCambiarIdioma: async () => { setIdioma(getIdioma() === 'es' ? 'en' : 'es'); G.historia = null; await cargarIdioma(); landing(); },
  });
}

// ───────────────────────── Modo aula ─────────────────────────
// El enlace del docente (?aula=3B-2026&modo=aula[&ritmo=tranquilo]) llena el código de aula,
// empieza sin sonido ni voz (se pueden prender) y deja que el docente pause a toda el aula desde su panel.
function leerEnlaceDocente() {
  const q = new URLSearchParams(location.search);
  const aula = q.get('aula')?.trim().slice(0, 20);
  if (!aula) return;
  G.jugador.aula = aula.toUpperCase();
  guardar('horizonte.jugador', G.jugador);
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
    antena: { nombre: t("Antena"), texto: t("Una señal de radio tarda cerca de 1,3 segundos en ir de la Luna a la Tierra."), textoMarte: t("Desde Marte, una señal tarda entre 3 y 22 minutos en llegar a la Tierra: no se puede pedir ayuda al instante.") },
    cima: { nombre: t("Cima iluminada"), texto: t("Algunas cimas cerca del polo sur de la Luna reciben luz del Sol la mayor parte del año: buen lugar para paneles."), textoMarte: t("El cielo de Marte de día es color caramelo por el polvo fino que flota en el aire.") },
  }, {
    volver: t("Volver a la base"),
    raton: t("Explora: clic derecho y arrastra (o flechas) para moverte · doble clic para ir · toca un marcador"),
    tactil: t("Explora: arrastra con dos dedos para moverte · toca dos veces para ir · toca un marcador"),
  });
}

const botonSonido = () => `<button class="boton-icono" id="sonido" aria-label="${t('Sonido')}" aria-pressed="${sonidoActivo()}">${I(sonidoActivo() ? 'sonido' : 'mudo')}</button>`;
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

function cifraNasa(clave) {
  const c = G.nasa.cifras[clave];
  if (!c) return '';
  return `<div class="cifra-nasa">${personaje('llama-astronauta', 'llama-ficha')}<div class="etiqueta">${t('FICHA DE CIENCIA · DATOS DE NASA')}</div><p>${esc(c.texto)}</p>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${t('Fuente: {x}', { x: esc(c.fuente) })}</a></div>`;
}

/** Ventana flotante sobre el mapa (resultados, pruebas, fuentes). Devuelve el contenedor interior. */
function modal({ ancho = false, cerrable = false } = {}) {
  $app.innerHTML = `<div class="velo"></div><section class="modal ${ancho ? 'ancho' : ''}" role="dialog" aria-modal="true">
    ${cerrable ? `<button class="cerrar" aria-label="${t('Cerrar')}">${I('cerrar')}</button>` : ''}<div class="contenido"></div></section>`;
  if (cerrable) $app.querySelector('.cerrar').addEventListener('click', inicio);
  const c = $app.querySelector('.contenido');
  c.scrollTop = 0;
  return c;
}

// ───────────────────────── Portada ─────────────────────────
function inicio() {
  document.body.dataset.pantalla = 'portada';
  ambienteEstado({});
  callar();
  olvidarUltimo();
  pintar({ config: { panel: 8, bateria: 6, reactor: true, reciclador: true, invernadero: true, blindaje: 1 }, luz: true, carga: 0.9, tripulacion: 3, tormenta: false, polvo: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true, planeta: 'luna' }, 'portada');
  let nCampana = 0, nExtra = 0;
  const boton = (m, i) => {
    const p = G.progreso[m.id] || 0;
    const num = m.avanzada ? `+${++nExtra}` : `0${++nCampana}`;
    return `<button class="mision-btn ${m.avanzada ? 'avanzada' : ''} ${m.planeta === 'marte' ? 'marte' : ''}" data-mision="${i}">
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
      ${chipAula()}
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
      <details class="jugador"><summary>${I('persona')} ${G.jugador.nombre ? esc(G.jugador.nombre) : t('Tu nombre y aula (opcional)')}</summary>
        <label>${t('Nombre')} <input id="nombre" maxlength="40" value="${esc(G.jugador.nombre)}" autocomplete="off"></label>
        <label>${t('Código de aula')} <input id="aula" maxlength="20" value="${esc(G.jugador.aula)}" autocomplete="off" placeholder="${t('p. ej. 3B-2026')}"></label>
        <p class="chico suave">${t('Si tu docente te dio un código, escríbelo para que vea tu avance.')}</p>
        <label class="casilla"><input type="checkbox" id="modoAula" ${G.aula.activo ? 'checked' : ''}> ${t('Modo aula (mi docente puede pausar el juego)')}</label>
        <label class="casilla"><input type="checkbox" id="ritmoTranquilo" ${G.aula.tranquilo ? 'checked' : ''}> ${t('Ritmo tranquilo: avanzar de un día en un día')}</label>
      </details>
      <div class="fila"><button id="historia" class="secundario">${I('historia')} ${t('Ver la historia')}</button><button id="fuentes" class="secundario">${I('datos')} ${t('Datos de NASA')}</button></div>
      <p class="chico suave pie">Stellar Experience · Moquegua, Perú · ${t('Proyecto para NASA Space Apps Challenge 2026')}</p>
    </aside>
    <p class="pista-gesto">${I('mano')} ${t('Arrastra para girar la base · pellizca para acercar')}</p>`;
  $app.querySelectorAll('[data-mision]').forEach((b) => b.addEventListener('click', () => {
    const empezar = () => { G.mision = G.misiones[+b.dataset.mision]; G.config = S.configInicial(G.mision); G.rebobinados = 0; construir(); };
    if (!G.eval.inicial && !G.eval.saltoInicial) pruebaInicial(empezar); else empezar();
  }));
  $app.querySelectorAll('[data-eval]').forEach((b) => b.addEventListener('click', () => ({ inicial: () => pruebaInicial(inicio), final: pruebaFinal, caso: casoArtemis, resumen: resumenAprendizaje })[b.dataset.eval]()));
  for (const id of ['nombre', 'aula']) {
    document.getElementById(id).addEventListener('change', (ev) => { G.jugador[id] = ev.target.value.trim(); guardar('horizonte.jugador', G.jugador); });
  }
  document.getElementById('modoAula').addEventListener('change', (ev) => { G.aula.activo = ev.target.checked; guardar('horizonte.modoAula', G.aula); if (!G.aula.activo) mostrarPausa(false); inicio(); });
  document.getElementById('ritmoTranquilo').addEventListener('change', (ev) => { G.aula.tranquilo = ev.target.checked; guardar('horizonte.modoAula', G.aula); });
  document.getElementById('fuentes').addEventListener('click', fuentes);
  document.getElementById('historia').addEventListener('click', () => historia());
  document.getElementById('aLanding').addEventListener('click', landing);
  document.getElementById('idioma').addEventListener('click', async () => {
    setIdioma(getIdioma() === 'es' ? 'en' : 'es');
    G.historia = null;
    await cargarIdioma();
    inicio();
  });
  enlazarSonido();
}

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
      <div class="masa ${excedido ? 'peligro' : pct > 85 ? 'alerta' : ''}" title="${t('Masa que lleva el cohete')}">
        <div class="entre"><span>${I('cohete')} ${t('Masa')}</span><b>${fmt(masa, 2)} / ${m.presupuesto_t} t</b></div>
        <div class="barra"><span style="width:${pct}%"></span></div>
      </div>
    </header>

    <aside class="widgets-diseno">
      <div class="widget ${estado(e.dia >= e.demanda)}"><span>${I('energia')}</span><div><b>+${fmt(e.dia)} / −${fmt(e.demanda)}</b><small>${t('kWh/día con luz')}</small></div></div>
      ${m.luz_permanente ? '' : `<div class="widget ${estado(e.nochesAguanta >= 15)}"><span>${I('noche')}</span><div><b>${dias(e.nochesAguanta)} ${t('días')}</b><small>${t('aguantas de noche (~15)')}</small></div></div>`}
      <div class="widget ${estado(e.diasAgua >= m.dias)}"><span>${I('agua')}</span><div><b>${dias(e.diasAgua)} ${t('días')}</b><small>${t('de agua')}</small></div></div>
      <div class="widget ${estado(e.diasComida >= m.dias)}"><span>${I('comida')}</span><div><b>${dias(e.diasComida)} ${t('días')}</b><small>${t('de comida')}</small></div></div>
      <div class="widget ${estado(e.dosis <= m.limite_dosis_msv)}"><span>${I('radiacion')}</span><div><b>${fmt(e.dosis, 1)} mSv</b><small>${t('límite {n}', { n: m.limite_dosis_msv })}</small></div></div>
      ${G.reservas[m.id] ? `<div class="widget reserva"><span>${I('caja')}</span><div><b>+${fmt(G.reservas[m.id].o2, 1)} O₂ · +${fmt(G.reservas[m.id].agua)} ${t('agua')} · +${fmt(G.reservas[m.id].comida)} ${t('comida')}</b><small>${t('kg de reserva de la misión anterior (no pesan)')}</small></div></div>` : ''}
    </aside>

    <button class="nebula-mini" id="ayuda" aria-label="${t('Ver la pista de Nebula')}">${CARA_NEBULA}</button>
    ${G.briefingVisto[m.id] ? '' : `<div class="briefing">${nebula(esc(m.nebula.briefing) + '<br><br>' + esc(m.nebula.construir), 'pensando')}<button class="primario" id="entendido">${t('¡Entendido!')}</button></div>`}
    ${excedido ? `<div class="toasts"><div class="toast peligro">${t('El cohete no puede despegar: quita masa.')}</div></div>` : ''}

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
  document.getElementById('entendido')?.addEventListener('click', () => { G.briefingVisto[m.id] = true; construir(); });
  document.getElementById('ayuda').addEventListener('click', () => { G.briefingVisto[m.id] = false; construir(); });
  const tipoDe = (k) => (['o2', 'agua', 'comida'].includes(k) ? 'habitat' : k);
  const lim = (k, val) => Math.max(0, Math.min(j.modulos[k]?.max ?? 9999, val));
  $app.querySelectorAll('[data-mas]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.mas; c[k] = lim(k, c[k] + +b.dataset.paso); construir(); resaltar(tipoDe(k)); sfx.modulo(); }));
  $app.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.menos; c[k] = lim(k, c[k] - +b.dataset.paso); construir(); }));
  $app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.toggle; c[k] = !c[k]; construir(); if (c[k]) { resaltar(k); sfx.modulo(); } }));
  $app.querySelectorAll('[data-blindaje]').forEach((b) => b.addEventListener('click', () => { c.blindaje = +b.dataset.blindaje; construir(); resaltar('habitat'); }));
  document.getElementById('lanzar').addEventListener('click', lanzar);
  decirNebula();
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
  c.querySelectorAll('[data-pred]').forEach((b) => b.addEventListener('click', () => { G.prediccion = b.dataset.pred; empezarMision(); }));
  c.querySelector('#cambiarPlan').addEventListener('click', construir);
}

function resultadoPrediccion(motivo) {
  if (!G.prediccion) return '';
  const real = motivo || 'exito';
  const acierto = G.prediccion === real;
  return `<div class="prediccion ${acierto ? 'bien' : 'mal'}">${I(acierto ? 'check' : 'predecir')}<span>${t('Tu predicción: {x}.', { x: `<b>${nombreMotivo(G.prediccion)}</b>` })} ${acierto ? t('¡Acertaste!') : t('Pasó: {x}.', { x: `<b>${nombreMotivo(real)}</b>` })}</span></div>`;
}

function empezarMision() {
  G.estados = [S.crearEstado(G.mision, G.config, G.juego, G.reservas[G.mision.id] || {})];
  G.registros = [];
  G.decisiones = [];
  G.hoy = S.decisionesPorDefecto();
  G.avisoRebobinado = null;
  G.bitacoraAbierta = false;
  sfx.despegue();
  mision();
}

const actual = () => G.estados[G.estados.length - 1];
const guiada = () => !G.mision.sin_pistas; // en las misiones de evaluación y avanzadas, Nebula no da pistas

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
  if (actual().terminado) { final(); return; }
  if (r?.eventos.some((x) => x.tipo === 'tormenta_solar')) sfx.tormenta();
  else if (r?.eventos.some((x) => x.tipo === 'tormenta_polvo')) sfx.polvo();
  else if (r?.apagados.length || r?.eventos.length) sfx.alarma();
  else sfx.paso();
  mision();
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

function recurso(icono, nombre, valor, max, texto, invertir = false) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  const clase = invertir ? (pct > 80 ? 'peligro' : pct > 55 ? 'alerta' : '') : (pct < 20 ? 'peligro' : pct < 40 ? 'alerta' : '');
  return `<div class="recurso ${clase}" title="${nombre}"><span class="ico" aria-hidden="true">${icono}</span>
    <span class="val"><b>${texto}</b><small>${nombre}</small></span><i style="width:${pct}%"></i></div>`;
}

function mision() {
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
      <div class="grupo-botones"><button id="abortar" class="boton-icono" aria-label="${t('Volver al diseño de la base')}">${I('ajustes')}</button>${botonSonido()}${botonVoz()}</div>
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
      <div class="linea-tiempo" aria-label="${t('Cronoscopio: toca un día pasado para rebobinar')}">${linea}</div></div>
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
}

// ───────────────────────── Resultado ─────────────────────────
function final() {
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
  api.enviarPartida({
    mision: m.id, exito: res.exito, motivo: res.motivo || null, dias: e.dia, ciencia: e.ciencia,
    rebobinados: G.rebobinados, estrellas, config: e.config, nombre: G.jugador.nombre, aula: G.jugador.aula, prediccion: G.prediccion,
  });

  const c = modal();
  if (res.exito) sfx.exito(); else sfx.falla();
  if (res.exito) {
    G.progreso[m.id] = Math.max(G.progreso[m.id] || 0, estrellas);
    guardar('horizonte.progreso', G.progreso);
    // Lo que sobró pasa como reserva a la siguiente misión de la campaña (la mitad, redondeada)
    const destino = m.reserva_a && G.misiones.find((x) => x.id === m.reserva_a);
    if (destino) {
      G.reservas[destino.id] = { o2: Math.round(Math.max(0, e.o2) * 5) / 10, agua: Math.round(Math.max(0, e.agua) / 2), comida: Math.round(Math.max(0, e.comida) / 2) };
      guardar('horizonte.reservas', G.reservas);
    }
    const reserva = destino && G.reservas[destino.id];
    c.innerHTML = `
      <div class="centrado celebracion">
        ${personaje('llama-astronauta', 'llama-logro')}
        <p class="lema">${t('Misión cumplida')}</p>
        <h2>${esc(m.titulo)}</h2>
        <div class="estrellas-res" aria-label="${t('{n} de 3 estrellas', { n: estrellas })}">${'★'.repeat(estrellas)}<span>${'★'.repeat(3 - estrellas)}</span></div>
      </div>
      ${resultadoPrediccion(null)}
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
      <div class="fila">
        ${siguiente ? `<button class="primario" id="sig">${t('Siguiente: {x}', { x: esc(sinNumero(siguiente.titulo)) })} ▶</button>` : ''}
        ${m.evaluacion && !G.eval.caso ? `<button class="primario" id="evalfinal">${I('prueba')} ${t('Prueba final y caso Artemis-7')}</button>` : ''}
        <button class="secundario" id="inicio">${t('Menú')}</button>
      </div>`;
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
    setTimeout(decirNebula, 1600); // después de la fanfarria
    return;
  }

  const a = trAnalisis(S.analizarFalla(res.motivo, G.registros, e, m, G.nasa));
  const diaRebobinar = Math.max(0, Math.min(a.dia, G.estados.length - 2));
  c.innerHTML = `
    <div class="sello">${t('FALLA · DÍA {n}', { n: e.dia })}</div>
    <h2>${I('alerta', 'rojo')} ${esc(a.titulo)}</h2>
    ${resultadoPrediccion(res.motivo)}
    <p class="suave">${t('Así ocurrió:')}</p>
    <ol class="cadena">${a.cadena.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    ${a.datos.map(cifraNasa).join('')}
    ${nebula(esc(a.consejo), 'pensando')}
    <div class="fila">
      <button class="${a.redisenar ? 'secundario' : 'primario'}" id="rebobinar">${I('cronoscopio')} ${t('Rebobinar al día {n}', { n: diaRebobinar + 1 })}</button>
      <button class="${a.redisenar ? 'primario' : 'secundario'}" id="redisenar">${I('averia')} ${t('Rediseñar la base')}</button>
    </div>`;
  document.getElementById('rebobinar').addEventListener('click', () => rebobinar(diaRebobinar));
  document.getElementById('redisenar').addEventListener('click', () => { G.config = { ...G.estados[0].config }; G.rebobinados += 1; olvidarUltimo(); construir(); });
  setTimeout(decirNebula, 1400);
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
    <td><span class="etq ${c.verificado ? '' : 'pendiente'}">${c.verificado ? t('verificado') : t('por verificar')}</span></td></tr>`).join('');
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <p class="lema">${t('Fuentes')}</p>
    <h2>${I('datos')} ${t('Datos NASA usados')}</h2>
    <p class="suave">${t('Cada número de la simulación tiene una fuente. Los valores de equilibrio del juego (masa de los paneles, energía del invernadero…) están aparte en <code>data/juego.json</code> y no se presentan como datos NASA.')}</p>
    <table class="tabla-fuentes"><tbody>${filas}</tbody></table>
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
