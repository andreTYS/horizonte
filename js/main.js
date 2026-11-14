// Interfaz de HORIZONTE: HUD de juego sobre el mapa 3D a pantalla completa.
// La lógica del juego vive en sim.js; aquí solo se dibujan pantallas y se pasan decisiones.
import * as S from './sim.js';
import { escena as escenaSVG } from './escena.js';
import * as api from './api.js';
import * as E from './evaluacion.js';

const $app = document.getElementById('app');
const $svg = document.getElementById('fondo-svg');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

const G = {
  nasa: null, juego: null, misiones: [], evaluacion: null,
  mision: null, config: null,
  estados: [], registros: [], decisiones: [], hoy: null,
  rebobinados: 0, avisoRebobinado: null, briefingVisto: {},
  progreso: leer('horizonte.progreso', {}),
  jugador: leer('horizonte.jugador', { nombre: '', aula: '' }),
  eval: leer('horizonte.evaluacion', {}),
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
  const leerJson = (f) => fetch(`data/${f}`).then((r) => r.json());
  [G.nasa, G.juego, G.misiones, G.evaluacion] = await Promise.all([
    leerJson('nasa.json'), leerJson('juego.json'), leerJson('misiones.json'), leerJson('evaluacion.json'), iniciarMundo(),
  ]);
  api.detectar(); // en el VPS hay API; en GitHub Pages no, y el juego funciona igual
  inicio();
}

// ───────────────────────── Piezas de interfaz ─────────────────────────
function nebula(texto, animo = 'normal', extra = '') {
  const cara = { normal: '🐱', alerta: '🙀', feliz: '😸', pensando: '🤔' }[animo];
  return `<div class="nebula ${extra}"><div class="cara" aria-hidden="true">${cara}</div><div class="globo"><span class="quien">Nebula</span>${texto}</div></div>`;
}

function cifraNasa(clave) {
  const c = G.nasa.cifras[clave];
  if (!c) return '';
  return `<div class="cifra-nasa"><div class="etiqueta">DATO NASA</div><p>${esc(c.texto)}</p>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">Fuente: ${esc(c.fuente)}</a></div>`;
}

/** Ventana flotante sobre el mapa (resultados, pruebas, fuentes). Devuelve el contenedor interior. */
function modal({ ancho = false, cerrable = false } = {}) {
  $app.innerHTML = `<div class="velo"></div><section class="modal ${ancho ? 'ancho' : ''}" role="dialog" aria-modal="true">
    ${cerrable ? '<button class="cerrar" aria-label="Cerrar">✕</button>' : ''}<div class="contenido"></div></section>`;
  if (cerrable) $app.querySelector('.cerrar').addEventListener('click', inicio);
  const c = $app.querySelector('.contenido');
  c.scrollTop = 0;
  return c;
}

// ───────────────────────── Portada ─────────────────────────
function inicio() {
  document.body.dataset.pantalla = 'portada';
  pintar({ config: { panel: 8, bateria: 6, reactor: true, reciclador: true, invernadero: true, blindaje: 1 }, luz: true, carga: 0.9, tripulacion: 3, tormenta: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true }, 'portada');
  const misiones = G.misiones.map((m, i) => {
    const p = G.progreso[m.id] || 0;
    return `<button class="mision-btn" data-mision="${i}">
      <span class="num">0${i + 1}</span>
      <span class="info"><b>${esc(m.titulo.replace(/^Misión \d · /, ''))}</b><small>${esc(m.lugar)} · ${m.tripulacion} astronautas · ${m.dias} días</small></span>
      <span class="estrellas-mini" aria-label="${p} de 3 estrellas">${'★'.repeat(p)}<span>${'★'.repeat(3 - p)}</span></span></button>`;
  }).join('');
  $app.innerHTML = `
    <header class="marca">
      <p class="lema">Ensaya el futuro de tu base</p>
      <h1>HORIZONTE</h1>
      <p class="sub">Diseña una base en la Luna, adelanta el tiempo y descubre si tu tripulación llega al día final. Si falla, <strong>rebobina</strong> y corrige.</p>
    </header>
    <aside class="menu-principal panel-vidrio">
      <h2 class="titulo-seccion">Misiones</h2>
      <div class="lista-misiones">${misiones}</div>
      ${tarjetaAprendizaje()}
      <details class="jugador"><summary>👩‍🚀 ${G.jugador.nombre ? esc(G.jugador.nombre) : 'Tu nombre y aula (opcional)'}</summary>
        <label>Nombre <input id="nombre" maxlength="40" value="${esc(G.jugador.nombre)}" autocomplete="off"></label>
        <label>Código de aula <input id="aula" maxlength="20" value="${esc(G.jugador.aula)}" autocomplete="off" placeholder="p. ej. 3B-2026"></label>
        <p class="chico suave">Si tu docente te dio un código, escríbelo para que vea tu avance.</p>
      </details>
      <div class="fila"><button id="fuentes" class="secundario">📚 Datos NASA</button></div>
      <p class="chico suave pie">Stellar Experience · Moquegua, Perú · NASA Space Apps 2026</p>
    </aside>
    <p class="pista-gesto">🖐️ Arrastra para girar la base · pellizca para acercar</p>`;
  $app.querySelectorAll('[data-mision]').forEach((b) => b.addEventListener('click', () => {
    const empezar = () => { G.mision = G.misiones[+b.dataset.mision]; G.config = S.configInicial(G.mision); G.rebobinados = 0; construir(); };
    if (!G.eval.inicial && !G.eval.saltoInicial) pruebaInicial(empezar); else empezar();
  }));
  $app.querySelectorAll('[data-eval]').forEach((b) => b.addEventListener('click', () => ({ inicial: () => pruebaInicial(inicio), final: pruebaFinal, caso: casoArtemis, resumen: resumenAprendizaje })[b.dataset.eval]()));
  for (const id of ['nombre', 'aula']) {
    document.getElementById(id).addEventListener('change', (ev) => { G.jugador[id] = ev.target.value.trim(); guardar('horizonte.jugador', G.jugador); });
  }
  document.getElementById('fuentes').addEventListener('click', fuentes);
}

// ───────────────────────── Construcción ─────────────────────────
function estimaciones() {
  const { config: c, mision: m, juego: j, nasa } = G;
  const n = m.tripulacion;
  const v = (k) => nasa.cifras[k].valor;
  const o2Dia = n * v('o2_persona_dia');
  const demanda = j.habitat.kwh_dia_base + n * j.habitat.kwh_dia_persona + o2Dia * j.habitat.kwh_por_kg_o2
    + (c.reciclador ? j.modulos.reciclador.kwh_dia : 0) + (c.invernadero ? j.modulos.invernadero.kwh_dia : 0);
  const reactor = c.reactor ? v('fsp_kw') * 24 : 0;
  const bateria = c.bateria * j.modulos.bateria.capacidad_kwh;
  const aguaDia = n * v('agua_persona_dia') * (c.reciclador ? 1 - v('recuperacion_agua') : 1)
    + o2Dia * v('agua_por_kg_o2') + (c.invernadero ? j.modulos.invernadero.agua_kg_dia : 0);
  const comidaDia = n * v('comida_persona_dia') * (c.invernadero ? 1 - j.modulos.invernadero.fraccion_comida : 1);
  return {
    demanda, dia: c.panel * j.modulos.panel.kwh_dia_luz + reactor,
    nochesAguanta: demanda - reactor <= 0 ? Infinity : bateria / (demanda - reactor),
    diasAgua: c.agua / aguaDia, diasComida: c.comida / comidaDia, diasO2: c.o2 / o2Dia,
    dosis: v('dosis_luna_msv_dia') * (1 - j.modulos.blindaje.niveles[c.blindaje].reduccion) * m.dias,
  };
}

function construir() {
  document.body.dataset.pantalla = 'diseno';
  const { mision: m, config: c, juego: j, nasa } = G;
  pintar({ config: c, luz: S.hayLuz(m, 0, nasa), tripulacion: m.tripulacion, carga: 1, tormenta: false, refugio: false, apagados: [], danados: 0, invernaderoOn: true }, 'diseno');
  const masa = S.masa(c, j, nasa);
  const pct = Math.min(100, (masa / m.presupuesto_t) * 100);
  const excedido = masa > m.presupuesto_t;
  const e = estimaciones();
  const dias = (x) => (x === Infinity ? '∞' : fmt(x, 1));
  const estado = (ok) => (ok ? 'bien' : 'mal');

  const contador = (k, paso, icono, nombre, detalle, unidad = '') => `
    <div class="carta" data-carta="${k}"><div class="carta-ico">${icono}</div><b>${nombre}</b><small>${detalle}</small>
      <div class="stepper"><button aria-label="Quitar ${nombre}" data-menos="${k}" data-paso="${paso}">−</button>
      <output>${c[k]}${unidad}</output><button aria-label="Añadir ${nombre}" data-mas="${k}" data-paso="${paso}">+</button></div></div>`;
  const interruptor = (k, icono, nombre, detalle) => `
    <div class="carta ${c[k] ? 'activa' : ''}"><div class="carta-ico">${icono}</div><b>${nombre}</b><small>${detalle}</small>
      <button class="interruptor" role="switch" aria-checked="${c[k]}" aria-label="${nombre}" data-toggle="${k}"><span></span></button></div>`;

  $app.innerHTML = `
    <header class="barra-superior">
      <button id="volver" class="boton-icono" aria-label="Volver a misiones">←</button>
      <div class="titulo-barra"><small>${esc(m.lugar)} · ${m.tripulacion} astronautas · ${m.dias} días</small><b>${esc(m.titulo)}</b></div>
      <div class="masa ${excedido ? 'peligro' : pct > 85 ? 'alerta' : ''}" title="Masa que lleva el cohete">
        <div class="entre"><span>🚀 Masa</span><b>${fmt(masa, 2)} / ${m.presupuesto_t} t</b></div>
        <div class="barra"><span style="width:${pct}%"></span></div>
      </div>
    </header>

    <aside class="widgets-diseno">
      <div class="widget ${estado(e.dia >= e.demanda)}"><span>⚡</span><div><b>+${fmt(e.dia)} / −${fmt(e.demanda)}</b><small>kWh/día con luz</small></div></div>
      ${m.luz_permanente ? '' : `<div class="widget ${estado(e.nochesAguanta >= 15)}"><span>🌑</span><div><b>${dias(e.nochesAguanta)} días</b><small>aguantas de noche (~15)</small></div></div>`}
      <div class="widget ${estado(e.diasAgua >= m.dias)}"><span>💧</span><div><b>${dias(e.diasAgua)} días</b><small>de agua</small></div></div>
      <div class="widget ${estado(e.diasComida >= m.dias)}"><span>🥫</span><div><b>${dias(e.diasComida)} días</b><small>de comida</small></div></div>
      <div class="widget ${estado(e.dosis <= m.limite_dosis_msv)}"><span>☢️</span><div><b>${fmt(e.dosis, 1)} mSv</b><small>límite ${m.limite_dosis_msv}</small></div></div>
    </aside>

    <button class="nebula-mini" id="ayuda" aria-label="Ver la pista de Nebula">🐱</button>
    ${G.briefingVisto[m.id] ? '' : `<div class="briefing">${nebula(esc(m.nebula.briefing) + '<br><br>' + esc(m.nebula.construir), 'pensando')}<button class="primario" id="entendido">¡Entendido!</button></div>`}
    ${excedido ? '<div class="toasts"><div class="toast peligro">El cohete no puede despegar: quita masa.</div></div>' : ''}

    <footer class="dock">
      <div class="cartas">
        ${contador('panel', 1, '🔷', 'Paneles', `${j.modulos.panel.masa_t} t · ${j.modulos.panel.kwh_dia_luz} kWh/día con luz`)}
        ${contador('bateria', 1, '🔋', 'Baterías', `${j.modulos.bateria.masa_t} t · ${j.modulos.bateria.capacidad_kwh} kWh`)}
        ${interruptor('reactor', '☢️', 'Reactor', `${nasa.cifras.fsp_masa_t.valor} t · ${nasa.cifras.fsp_kw.valor} kW día y noche`)}
        ${interruptor('reciclador', '♻️', 'Reciclador', `${j.modulos.reciclador.masa_t} t · recupera ${fmt(nasa.cifras.recuperacion_agua.valor * 100)} % del agua`)}
        ${interruptor('invernadero', '🌱', 'Invernadero', `${j.modulos.invernadero.masa_t} t · ${fmt(j.modulos.invernadero.fraccion_comida * 100)} % de la comida`)}
        <div class="carta"><div class="carta-ico">🛡️</div><b>Blindaje</b><small>${j.modulos.blindaje.niveles.map((nv) => `${nv.masa_t} t → −${fmt(nv.reduccion * 100)}%`).join(' · ')}</small>
          <div class="segmentos" role="group" aria-label="Nivel de blindaje">${['No', 'Medio', 'Alto'].map((t, i) => `<button aria-pressed="${c.blindaje === i}" data-blindaje="${i}">${t}</button>`).join('')}</div></div>
        ${contador('o2', 5, '🫁', 'Oxígeno', 'kg de reserva', ' kg')}
        ${contador('agua', 10, '💧', 'Agua', 'kg · también hace O₂', ' kg')}
        ${contador('comida', 10, '🥫', 'Comida', 'kg', ' kg')}
      </div>
      <button class="boton-lanzar" id="lanzar" ${excedido ? 'disabled' : ''}><span>🚀</span>LANZAR</button>
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
  $app.querySelectorAll('[data-mas]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.mas; c[k] = lim(k, c[k] + +b.dataset.paso); construir(); resaltar(tipoDe(k)); }));
  $app.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.menos; c[k] = lim(k, c[k] - +b.dataset.paso); construir(); }));
  $app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.toggle; c[k] = !c[k]; construir(); if (c[k]) resaltar(k); }));
  $app.querySelectorAll('[data-blindaje]').forEach((b) => b.addEventListener('click', () => { c.blindaje = +b.dataset.blindaje; construir(); resaltar('habitat'); }));
  document.getElementById('lanzar').addEventListener('click', lanzar);
}

// ───────────────────────── Misión ─────────────────────────
function lanzar() {
  G.estados = [S.crearEstado(G.mision, G.config, G.juego)];
  G.registros = [];
  G.decisiones = [];
  G.hoy = S.decisionesPorDefecto();
  G.avisoRebobinado = null;
  G.bitacoraAbierta = false;
  mision();
}

const actual = () => G.estados[G.estados.length - 1];
const guiada = () => G.mision.id !== G.misiones[G.misiones.length - 1].id; // en la misión final, Nebula no da pistas

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
  if (actual().terminado) final(); else mision();
}

function rebobinar(dia) {
  G.estados = G.estados.slice(0, dia + 1);
  G.registros = G.registros.slice(0, dia);
  G.hoy = { ...(G.decisiones[dia] || S.decisionesPorDefecto()) };
  G.decisiones = G.decisiones.slice(0, dia);
  G.rebobinados += 1;
  G.avisoRebobinado = dia;
  mision();
}

function pistaNebula(e, ultimo) {
  if (!guiada()) return '';
  if (ultimo?.eventos.some((x) => x.tipo === 'alerta_solar')) return nebula('¡Una llamarada! Las partículas llegan mañana. Activa el <strong>refugio</strong> 🛡️ antes de avanzar.', 'alerta');
  if (e.dia === 0) return nebula('Cada <strong>Avanzar</strong> pasa un día. Si una barra llega a cero, la base falla. Toca un día pasado en la línea de tiempo para <strong>rebobinar</strong>.');
  if (ultimo?.apagados.length) return nebula(`Hoy se apagó <strong>${esc(ultimo.apagados.join(', '))}</strong>. ¿Qué puedes cambiar?`, 'alerta');
  if (ultimo && ultimo.luz && !S.hayLuz(G.mision, e.dia, G.nasa)) return nebula('Se puso el Sol: los paneles ya no producen. Solo cuentan las baterías y el reactor.', 'pensando');
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
    tormenta: Boolean(tormentaAhora), refugio: G.hoy.refugio, tripulacion: m.tripulacion, invernaderoOn: G.hoy.invernadero,
  }, 'mision');

  const linea = Array.from({ length: m.dias }, (_, i) => {
    const r = G.registros[i];
    const ev = m.eventos.filter((x) => x.dia === i);
    const marca = ev.some((x) => x.tipo.includes('solar')) ? '💥' : ev.length ? '⚠️' : '';
    const cls = [S.hayLuz(m, i, G.nasa) ? 'luz' : 'noche', i > e.dia ? 'futuro' : '', i === e.dia ? 'hoy' : '', r?.apagados.length ? 'mal' : '', r?.decision.refugio ? 'refugio' : ''].join(' ');
    const puede = i < e.dia;
    return `<button class="${cls}" ${puede ? `data-dia="${i}"` : 'disabled'} aria-label="Día ${i + 1}${puede ? ', rebobinar aquí' : ''}"><span>${i + 1}</span><span class="marca">${i <= e.dia ? marca : ''}</span></button>`;
  }).join('');

  const avisos = [];
  if (G.avisoRebobinado !== null) avisos.push(`<div class="toast info">⏪ Volviste al día ${G.avisoRebobinado + 1}. Cambia tus decisiones y avanza.</div>`);
  if (ultimo) for (const ev of ultimo.eventos) avisos.push(`<div class="toast ${ev.tipo === 'tormenta_solar' ? 'peligro' : 'alerta'}"><b>Día ${ultimo.dia + 1}</b> · ${esc(ev.texto)}${ev.url ? ` <a href="${esc(ev.url)}" target="_blank" rel="noopener">DONKI ↗</a>` : ''}</div>`);
  if (ultimo?.apagados.length) avisos.push(`<div class="toast peligro"><b>Día ${ultimo.dia + 1}</b> · Se apagó: ${esc(ultimo.apagados.join(', '))}</div>`);

  const habilidad = (k, icono, etiqueta, detalle, mostrar = true) => mostrar ? `
    <button class="habilidad" aria-pressed="${G.hoy[k]}" data-dec="${k}" title="${detalle}"><span class="ico">${icono}</span><span class="txt">${etiqueta}</span></button>` : '';

  const bitacora = G.registros.slice().reverse().map((r) => `<li><b>Día ${r.dia + 1}</b> ${r.luz ? '☀️' : '🌑'} +${fmt(r.produccion)} / −${fmt(r.demanda)} kWh${r.decision.refugio ? ' · 🛡️' : ''}${r.eventos.length ? ' · ' + esc(r.eventos.map((x) => x.texto).join(' ')) : ''}</li>`).join('');

  $app.innerHTML = `
    <header class="hud-superior">
      <button id="abortar" class="boton-icono" aria-label="Volver al diseño de la base">⚙︎</button>
      <div class="recursos">
        ${recurso('⚡', 'kWh', e.energia, capacidad || 1, fmt(e.energia))}
        ${recurso('🫁', 'kg O₂', e.o2, Math.max(ini.o2, 1), fmt(e.o2, 1))}
        ${recurso('💧', 'kg agua', e.agua, Math.max(ini.agua, 1), fmt(e.agua))}
        ${recurso('🥫', 'kg comida', e.comida, Math.max(ini.comida, 1), fmt(e.comida))}
        ${recurso('☢️', `/${m.limite_dosis_msv} mSv`, e.dosis, m.limite_dosis_msv, fmt(e.dosis, 1), true)}
        ${recurso('❤️', 'salud', e.salud, 100, `${fmt(e.salud)}%`)}
        ${recurso('🔬', `/${m.objetivo_ciencia} ciencia`, e.ciencia, m.objetivo_ciencia, fmt(e.ciencia))}
      </div>
      <div class="reloj-dia ${luz ? 'dia' : 'noche'}" aria-label="Día ${Math.min(e.dia + 1, m.dias)} de ${m.dias}">
        <span class="astro">${luz ? '☀️' : '🌑'}</span><b>${Math.min(e.dia + 1, m.dias)}</b><small>/ ${m.dias}</small>
        <span class="rebobinados" title="Rebobinados">⏪ ${G.rebobinados}</span>
      </div>
    </header>

    <div class="toasts">${avisos.join('')}</div>
    <div class="zona-nebula">${pistaNebula(e, ultimo)}</div>

    <nav class="habilidades" aria-label="Decisiones para el día ${e.dia + 1}">
      <small>Día ${e.dia + 1}</small>
      ${habilidad('refugio', '🛡️', 'Refugio', 'Protege 90 % de la radiación de tormenta; ese día no hay ciencia')}
      ${habilidad('racion', '🥣', 'Ración', 'Comen 20 % menos; baja la salud')}
      ${habilidad('invernadero', '🌱', 'Invernadero', 'Apágalo para ahorrar energía y agua', c.invernadero)}
      <button class="habilidad" id="bitacora" aria-expanded="${Boolean(G.bitacoraAbierta)}"><span class="ico">📜</span><span class="txt">Bitácora</span></button>
    </nav>

    <aside class="cajon ${G.bitacoraAbierta ? 'abierto' : ''}" aria-label="Bitácora"><h3>📜 Bitácora</h3>${bitacora ? `<ul class="bitacora">${bitacora}</ul>` : '<p class="suave chico">Aún no pasa ningún día.</p>'}</aside>

    <footer class="hud-inferior">
      <div class="linea-tiempo" aria-label="Línea de tiempo: toca un día pasado para rebobinar">${linea}</div>
      <div class="acciones">
        <button class="boton-avanzar" id="dia1">AVANZAR <small>1 día</small> ▶</button>
        <button class="boton-rapido" id="dia5" aria-label="Avanzar 5 días">⏩<small>×5</small></button>
      </div>
    </footer>`;

  document.getElementById('abortar').addEventListener('click', () => { G.config = { ...ini.config }; G.rebobinados += 1; construir(); });
  document.getElementById('dia1').addEventListener('click', () => avanzar(1));
  document.getElementById('dia5').addEventListener('click', () => avanzar(5));
  document.getElementById('bitacora').addEventListener('click', () => { G.bitacoraAbierta = !G.bitacoraAbierta; mision(); });
  $app.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => { G.hoy[b.dataset.dec] = !G.hoy[b.dataset.dec]; mision(); }));
  $app.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => rebobinar(+b.dataset.dia)));
  const hoy = $app.querySelector('.linea-tiempo .hoy');
  if (hoy) hoy.parentElement.scrollLeft = hoy.offsetLeft - hoy.parentElement.clientWidth / 2;
}

// ───────────────────────── Resultado ─────────────────────────
function final() {
  document.body.dataset.pantalla = 'resultado';
  const m = G.mision, e = actual();
  const res = S.resultado(e, m);
  const siguiente = G.misiones[G.misiones.indexOf(m) + 1];
  const ultimo = G.registros[G.registros.length - 1];
  pintar({
    config: e.config, luz: ultimo?.luz ?? true, carga: Math.max(0, e.energia) / Math.max(1, e.config.bateria * G.juego.modulos.bateria.capacidad_kwh),
    danados: e.panelesDanados, apagados: res.exito ? [] : ultimo?.apagados?.length ? ultimo.apagados : ['soporte'], tormenta: res.motivo === 'radiacion',
    refugio: false, tripulacion: res.exito ? m.tripulacion : 0,
  }, 'resultado');
  const estrellas = res.exito ? (G.rebobinados === 0 ? 3 : G.rebobinados <= 2 ? 2 : 1) : 0;
  api.enviarPartida({
    mision: m.id, exito: res.exito, motivo: res.motivo || null, dias: e.dia, ciencia: e.ciencia,
    rebobinados: G.rebobinados, estrellas, config: e.config, nombre: G.jugador.nombre, aula: G.jugador.aula,
  });

  const c = modal();
  if (res.exito) {
    G.progreso[m.id] = Math.max(G.progreso[m.id] || 0, estrellas);
    guardar('horizonte.progreso', G.progreso);
    c.innerHTML = `
      <div class="centrado">
        <p class="lema">Misión cumplida</p>
        <h2>${esc(m.titulo)}</h2>
        <div class="estrellas-res" aria-label="${estrellas} de 3 estrellas">${'★'.repeat(estrellas)}<span>${'★'.repeat(3 - estrellas)}</span></div>
      </div>
      <div class="resumen-diseno">
        <div class="dato bien"><small>Sobrevivieron</small><b>${m.tripulacion} de ${m.tripulacion}</b></div>
        <div class="dato"><small>Días</small><b>${m.dias}</b></div>
        <div class="dato"><small>Ciencia</small><b>${e.ciencia} / ${m.objetivo_ciencia}</b></div>
        <div class="dato"><small>Rebobinados</small><b>${G.rebobinados}</b></div>
      </div>
      ${nebula(esc(m.nebula.exito), 'feliz')}
      <div class="fila">
        ${siguiente ? `<button class="primario" id="sig">Siguiente: ${esc(siguiente.titulo.replace(/^Misión \d · /, ''))} ▶</button>` : ''}
        ${!siguiente && !G.eval.caso ? '<button class="primario" id="evalfinal">📝 Prueba final y caso Artemis-7</button>' : ''}
        <button class="secundario" id="inicio">Menú</button>
      </div>`;
    document.getElementById('evalfinal')?.addEventListener('click', G.eval.final ? casoArtemis : pruebaFinal);
    document.getElementById('sig')?.addEventListener('click', () => { G.mision = siguiente; G.config = S.configInicial(siguiente); G.rebobinados = 0; construir(); });
    document.getElementById('inicio').addEventListener('click', inicio);
    return;
  }

  const a = S.analizarFalla(res.motivo, G.registros, e, m, G.nasa);
  const diaRebobinar = Math.max(0, Math.min(a.dia, G.estados.length - 2));
  c.innerHTML = `
    <div class="sello">FALLA · DÍA ${e.dia}</div>
    <h2>💥 ${esc(a.titulo)}</h2>
    <p class="suave">Así ocurrió:</p>
    <ol class="cadena">${a.cadena.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    ${a.datos.map(cifraNasa).join('')}
    ${nebula(esc(a.consejo), 'pensando')}
    <div class="fila">
      <button class="${a.redisenar ? 'secundario' : 'primario'}" id="rebobinar">⏪ Rebobinar al día ${diaRebobinar + 1}</button>
      <button class="${a.redisenar ? 'primario' : 'secundario'}" id="redisenar">🔧 Rediseñar la base</button>
    </div>`;
  document.getElementById('rebobinar').addEventListener('click', () => rebobinar(diaRebobinar));
  document.getElementById('redisenar').addEventListener('click', () => { G.config = { ...G.estados[0].config }; G.rebobinados += 1; construir(); });
}

// ───────────────────────── Evaluación del aprendizaje ─────────────────────────
const ultimaMision = () => G.misiones[G.misiones.length - 1];
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
      ${boton && !bloqueado ? `<button class="${hecho ? 'fantasma' : 'secundario'}" data-eval="${boton}">${hecho ? 'Repetir' : 'Hacer'}</button>` : `<span class="pastilla">${bloqueado ? '🔒' : '✓'}</span>`}</div>`;
  const bloqueadaFinal = !finalDesbloqueada();
  return `<div class="aprendizaje">
    <div class="entre"><h2 class="titulo-seccion">Tu aprendizaje</h2>${ev.inicial && ev.final && ev.caso ? '<button class="fantasma" data-eval="resumen">Resumen →</button>' : ''}</div>
    ${fila('📝', 'Prueba inicial', ev.inicial, ev.inicial ? `${ev.inicial.puntaje}/${ev.inicial.maximo}` : 'Antes de jugar · 2 min', ev.inicial ? null : 'inicial')}
    ${fila('🎯', 'Prueba final', ev.final, ev.final ? `${ev.final.puntaje}/${ev.final.maximo}` : bloqueadaFinal ? `Completa “${esc(ultimaMision().titulo.replace(/^Misión \d · /, ''))}”` : 'Lista para hacer', 'final', bloqueadaFinal)}
    ${fila('🧑‍🚀', 'Caso Artemis-7', ev.caso, ev.caso ? `${ev.caso.puntaje}/8 · ${ev.caso.nivel}` : 'Rúbrica 0–8 · después de la final', 'caso', !ev.final)}
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
    <p class="lema">Tu aprendizaje</p>
    <h2>${esc(G.jugador.nombre || 'Comandante')}</h2>
    <div class="comparacion">
      <div><small class="suave">Prueba inicial</small><b>${inicial ? `${inicial.puntaje}/5` : '—'}</b>${barra(inicial?.puntaje || 0, 5)}</div>
      <div class="flecha">→</div>
      <div><small class="suave">Prueba final</small><b>${fin ? `${fin.puntaje}/5` : '—'}</b>${barra(fin?.puntaje || 0, 5)}</div>
    </div>
    ${g != null ? `<p class="centrado">Ganancia de aprendizaje: <b>${Math.round(g * 100)} %</b> <span class="chico suave">de lo que te faltaba aprender</span></p>` : '<p class="chico suave centrado">Haz la prueba inicial y la final para ver tu ganancia.</p>'}
    ${caso ? `<div class="centrado"><p class="lema">Rúbrica · Caso Artemis-7</p>
      <div class="nivel-res nivel-${caso.nivel}"><b>${caso.puntaje}</b><span>/ 8</span></div>
      <p><span class="pastilla">${caso.nivel} · ${esc(G.evaluacion.niveles.find((n) => n.codigo === caso.nivel)?.nombre || '')}</span></p></div>` : ''}
    ${nebula(g != null && g > 0 ? '¡Aprendiste cómo se conectan los sistemas de una base! Eso es lo que hacen los ingenieros de la NASA.' : 'Cada falla que entiendes te acerca a ser comandante. ¡Vuelve a jugar!', 'feliz')}
    <div class="fila"><button class="primario" id="volver">Volver al menú</button></div>`;
  document.getElementById('volver').addEventListener('click', inicio);
}

// ───────────────────────── Fuentes ─────────────────────────
function fuentes() {
  document.body.dataset.pantalla = 'modal';
  const filas = Object.values(G.nasa.cifras).map((c) => `<tr><td>${esc(c.texto)}<br>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.fuente)}</a></td>
    <td><span class="etq ${c.verificado ? '' : 'pendiente'}">${c.verificado ? 'verificado' : 'por verificar'}</span></td></tr>`).join('');
  const c = modal({ ancho: true, cerrable: true });
  c.innerHTML = `
    <p class="lema">Fuentes</p>
    <h2>📚 Datos NASA usados</h2>
    <p class="suave">Cada número de la simulación tiene una fuente. Los valores de equilibrio del juego (masa de los paneles, energía del invernadero…) están aparte en <code>data/juego.json</code> y no se presentan como datos NASA.</p>
    <table class="tabla-fuentes"><tbody>${filas}</tbody></table>`;
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
cargar().catch((err) => {
  $app.innerHTML = `<p class="cargando">No se pudo cargar el juego (${esc(err.message)}). Ábrelo con un servidor local: <code>npm start</code></p>`;
});
