// Interfaz de HORIZONTE: pantallas, decisiones del jugador, escena isométrica y rebobinado.
import * as S from './sim.js';
import { escena } from './escena.js';
import * as api from './api.js';
import * as E from './evaluacion.js';

const $app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

const G = {
  nasa: null, juego: null, misiones: [],
  mision: null, config: null,
  estados: [], registros: [], decisiones: [], hoy: null,
  rebobinados: 0, avisoRebobinado: null,
  progreso: leer('horizonte.progreso', {}),
  jugador: leer('horizonte.jugador', { nombre: '', aula: '' }),
  evaluacion: null,
  eval: leer('horizonte.evaluacion', {}), // { inicial, final, caso, saltoInicial }
};

function leer(clave, porDefecto) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? porDefecto; } catch { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: el juego sigue */ }
}

async function cargar() {
  const leerJson = (f) => fetch(`data/${f}`).then((r) => r.json());
  [G.nasa, G.juego, G.misiones, G.evaluacion] = await Promise.all([leerJson('nasa.json'), leerJson('juego.json'), leerJson('misiones.json'), leerJson('evaluacion.json')]);
  api.detectar(); // en el VPS hay API; en GitHub Pages no, y el juego funciona igual
  inicio();
}

const arriba = () => window.scrollTo(0, 0);

function nebula(texto, animo = 'normal') {
  const cara = { normal: '🐱', alerta: '🙀', feliz: '😸', pensando: '🤔' }[animo];
  return `<div class="nebula"><div class="cara" aria-hidden="true">${cara}<span>🚀</span></div><div class="globo"><strong>Nebula</strong>${texto}</div></div>`;
}

function cifraNasa(clave) {
  const c = G.nasa.cifras[clave];
  if (!c) return '';
  return `<div class="cifra-nasa"><div class="etiqueta">DATO NASA</div><p>${esc(c.texto)}</p>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">Fuente: ${esc(c.fuente)}</a></div>`;
}

// ───────────────────────── Portada ─────────────────────────
function inicio() {
  arriba();
  const vitrina = { panel: 6, bateria: 4, reactor: true, reciclador: true, invernadero: true, blindaje: 1 };
  const misiones = G.misiones.map((m, i) => {
    const p = G.progreso[m.id] || 0;
    return `<button class="mision-btn" data-mision="${i}">
      <span class="num">0${i + 1}</span>
      <span class="info"><b>${esc(m.titulo.replace(/^Misión \d · /, ''))}</b><span class="suave chico">${esc(m.lugar)} · ${m.tripulacion} astronautas · ${m.dias} días</span></span>
      <span class="estrellas-mini" aria-label="${p} de 3 estrellas">${'★'.repeat(p)}<span>${'★'.repeat(3 - p)}</span></span></button>`;
  }).join('');
  $app.innerHTML = `
    <section class="portada">
      <div class="marco-escena hero">${escena({ config: vitrina, luz: true, carga: 0.9, tripulacion: 3 })}</div>
      <p class="lema">Ensaya el futuro de tu base</p>
      <h1>HORIZONTE</h1>
      <p class="suave">Diseña una base en la Luna, adelanta el tiempo y descubre si tu tripulación llega al día final.
      Si falla, encuentra la causa, <strong>rebobina</strong> y corrige.</p>
    </section>
    ${nebula('¡Hola, comandante! Todos los números de este juego vienen de la NASA, y te diré de dónde. ¿Empezamos?', 'feliz')}
    <h2 class="titulo-seccion">Misiones</h2>
    <div class="lista-misiones">${misiones}</div>
    ${tarjetaAprendizaje()}
    <details class="tarjeta jugador"><summary>👩‍🚀 ${G.jugador.nombre ? esc(G.jugador.nombre) : 'Tu nombre y aula (opcional)'}</summary>
      <label>Nombre <input id="nombre" maxlength="40" value="${esc(G.jugador.nombre)}" autocomplete="off"></label>
      <label>Código de aula <input id="aula" maxlength="20" value="${esc(G.jugador.aula)}" autocomplete="off" placeholder="p. ej. 3B-2026"></label>
      <p class="chico suave">Si tu docente te dio un código, escríbelo para que vea tu avance. Solo se guarda tu nombre y tus resultados.</p>
    </details>
    <div class="fila"><button id="fuentes">📚 Datos NASA usados</button></div>
    <p class="chico suave pie">Stellar Experience · Moquegua, Perú · NASA Space Apps Challenge 2026</p>`;
  $app.querySelectorAll('[data-mision]').forEach((b) => b.addEventListener('click', () => {
    const empezar = () => {
      G.mision = G.misiones[+b.dataset.mision];
      G.config = S.configInicial(G.mision);
      G.rebobinados = 0;
      arriba();
      construir();
    };
    // Antes de la primera misión, la prueba inicial (se puede posponer)
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
  const dia = c.panel * j.modulos.panel.kwh_dia_luz + reactor;
  const bateria = c.bateria * j.modulos.bateria.capacidad_kwh;
  const deficitNoche = demanda - reactor;
  const aguaDia = n * v('agua_persona_dia') * (c.reciclador ? 1 - v('recuperacion_agua') : 1)
    + o2Dia * v('agua_por_kg_o2') + (c.invernadero ? j.modulos.invernadero.agua_kg_dia : 0);
  const comidaDia = n * v('comida_persona_dia') * (c.invernadero ? 1 - j.modulos.invernadero.fraccion_comida : 1);
  return {
    demanda, dia,
    nochesAguanta: deficitNoche <= 0 ? Infinity : bateria / deficitNoche,
    diasAgua: c.agua / aguaDia, diasComida: c.comida / comidaDia,
    dosis: v('dosis_luna_msv_dia') * (1 - j.modulos.blindaje.niveles[c.blindaje].reduccion) * m.dias,
  };
}

function construir() {
  const { mision: m, config: c, juego: j, nasa } = G;
  const masa = S.masa(c, j, nasa);
  const pct = Math.min(100, (masa / m.presupuesto_t) * 100);
  const excedido = masa > m.presupuesto_t;
  const e = estimaciones();
  const dias = (x) => (x === Infinity ? '∞' : fmt(x, 1));
  const ok = (x) => (x >= m.dias ? 'bien' : 'mal');

  const stepper = (k, paso, icono, etiqueta, detalle, unidad = '') => `
    <div class="control"><span class="nombre">${icono} ${etiqueta}</span>
      <div class="stepper"><button aria-label="Quitar ${etiqueta}" data-menos="${k}" data-paso="${paso}">−</button>
      <output>${c[k]}${unidad}</output>
      <button aria-label="Añadir ${etiqueta}" data-mas="${k}" data-paso="${paso}">+</button></div>
      <span class="detalle">${detalle}</span></div>`;
  const interruptor = (k, icono, etiqueta, detalle) => `
    <div class="control"><span class="nombre">${icono} ${etiqueta}</span>
      <button class="interruptor" role="switch" aria-checked="${c[k]}" aria-label="${etiqueta}" data-toggle="${k}"><span></span></button>
      <span class="detalle">${detalle}</span></div>`;

  $app.innerHTML = `
    <div class="entre"><button id="volver" class="fantasma">← Misiones</button><span class="pastilla">📍 ${esc(m.lugar)}</span></div>
    <h2 class="titulo-mision">${esc(m.titulo)}</h2>
    <p class="suave">${esc(m.resumen)}</p>
    <div class="marco-escena">${escena({ config: c, luz: S.hayLuz(m, 0, nasa), tripulacion: m.tripulacion, etiquetas: true })}
      <div class="masa ${excedido ? 'peligro' : pct > 85 ? 'alerta' : ''}">
        <div class="entre"><span>🚀 Masa del cohete</span><b>${fmt(masa, 2)} / ${m.presupuesto_t} t</b></div>
        <div class="barra"><span style="width:${pct}%"></span></div>
        ${excedido ? '<small>Demasiado pesado: el cohete no puede despegar.</small>' : ''}
      </div>
    </div>
    ${nebula(esc(m.nebula.briefing) + '<br>' + esc(m.nebula.construir), 'pensando')}

    <section class="tarjeta"><h3>⚡ Energía</h3>
      ${stepper('panel', 1, '🔷', 'Paneles solares', `${j.modulos.panel.masa_t} t c/u · ${j.modulos.panel.kwh_dia_luz} kWh/día, solo con luz`)}
      ${stepper('bateria', 1, '🔋', 'Baterías', `${j.modulos.bateria.masa_t} t c/u · guardan ${j.modulos.bateria.capacidad_kwh} kWh`)}
      ${interruptor('reactor', '☢️', 'Reactor de fisión', `${nasa.cifras.fsp_masa_t.valor} t · ${nasa.cifras.fsp_kw.valor} kW de día y de noche (NASA Fission Surface Power)`)}
    </section>
    <section class="tarjeta"><h3>🔧 Sistemas</h3>
      ${interruptor('reciclador', '💧', 'Reciclador de agua', `${j.modulos.reciclador.masa_t} t · recupera el ${fmt(nasa.cifras.recuperacion_agua.valor * 100)} % del agua, como la ISS`)}
      ${interruptor('invernadero', '🌱', 'Invernadero', `${j.modulos.invernadero.masa_t} t · ${fmt(j.modulos.invernadero.fraccion_comida * 100)} % de la comida y más ciencia; gasta agua y energía`)}
      <div class="control"><span class="nombre">🛡️ Blindaje</span>
        <div class="segmentos" role="group" aria-label="Nivel de blindaje">
          ${j.modulos.blindaje.niveles.map((nv, i) => `<button aria-pressed="${c.blindaje === i}" data-blindaje="${i}">${['No', 'Medio', 'Alto'][i]}</button>`).join('')}
        </div>
        <span class="detalle">Regolito sobre el hábitat: ${j.modulos.blindaje.niveles.map((nv) => `${nv.masa_t} t → −${fmt(nv.reduccion * 100)} %`).join(' · ')}</span></div>
    </section>
    <section class="tarjeta"><h3>📦 Suministros</h3>
      ${stepper('o2', 5, '🫁', 'Oxígeno', 'kg de reserva', ' kg')}
      ${stepper('agua', 10, '💧', 'Agua', 'kg (también se usa para fabricar oxígeno)', ' kg')}
      ${stepper('comida', 10, '🥫', 'Comida', 'kg', ' kg')}
    </section>
    <section class="tarjeta"><h3>📊 ¿Alcanza? <span class="suave chico">${m.tripulacion} astronautas · ${m.dias} días</span></h3>
      <div class="resumen-diseno">
        <div class="dato ${e.dia >= e.demanda ? 'bien' : 'mal'}"><small>Energía con luz</small><b>+${fmt(e.dia)} / −${fmt(e.demanda)}</b><small>kWh por día</small></div>
        ${m.luz_permanente ? '' : `<div class="dato ${e.nochesAguanta >= 15 ? 'bien' : 'mal'}"><small>De noche aguantas</small><b>${dias(e.nochesAguanta)} días</b><small>la noche dura ~15</small></div>`}
        <div class="dato ${ok(e.diasAgua)}"><small>Agua para</small><b>${dias(e.diasAgua)} días</b></div>
        <div class="dato ${ok(e.diasComida)}"><small>Comida para</small><b>${dias(e.diasComida)} días</b></div>
        <div class="dato ${e.dosis <= m.limite_dosis_msv ? 'bien' : 'mal'}"><small>Radiación prevista</small><b>${fmt(e.dosis, 1)} mSv</b><small>límite ${m.limite_dosis_msv} (sin tormentas)</small></div>
        <div class="dato"><small>Objetivo de ciencia</small><b>${m.objetivo_ciencia} pts</b><small>1 por día fuera del refugio</small></div>
      </div>
    </section>
    <div class="barra-accion"><div class="fila">
      <button class="primario" id="lanzar" ${excedido ? 'disabled' : ''}>🚀 Lanzar misión</button>
    </div></div>`;

  document.getElementById('volver').addEventListener('click', inicio);
  const lim = (k, val) => Math.max(0, Math.min(j.modulos[k]?.max ?? 9999, val));
  $app.querySelectorAll('[data-mas]').forEach((b) => b.addEventListener('click', () => { c[b.dataset.mas] = lim(b.dataset.mas, c[b.dataset.mas] + +b.dataset.paso); construir(); }));
  $app.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => { c[b.dataset.menos] = lim(b.dataset.menos, c[b.dataset.menos] - +b.dataset.paso); construir(); }));
  $app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { c[b.dataset.toggle] = !c[b.dataset.toggle]; construir(); }));
  $app.querySelectorAll('[data-blindaje]').forEach((b) => b.addEventListener('click', () => { c.blindaje = +b.dataset.blindaje; construir(); }));
  document.getElementById('lanzar').addEventListener('click', lanzar);
}

// ───────────────────────── Misión ─────────────────────────
function lanzar() {
  G.estados = [S.crearEstado(G.mision, G.config, G.juego)];
  G.registros = [];
  G.decisiones = [];
  G.hoy = S.decisionesPorDefecto();
  G.avisoRebobinado = null;
  arriba();
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
  arriba();
  mision();
}

function pistaNebula(e, ultimo) {
  if (!guiada()) return '';
  if (ultimo?.eventos.some((x) => x.tipo === 'alerta_solar')) return nebula('¡Una llamarada! Las partículas llegan mañana. Activa el <strong>refugio</strong> antes de avanzar.', 'alerta');
  if (e.dia === 0) return nebula('Cada “Avanzar” pasa un día. Si una barra llega a cero, la base falla. Toca un día pasado en la línea de tiempo para <strong>rebobinar</strong>.');
  if (ultimo?.apagados.length) return nebula(`Ojo: hoy se apagó <strong>${esc(ultimo.apagados.join(', '))}</strong>. ¿Qué puedes cambiar?`, 'alerta');
  if (ultimo && ultimo.luz && !S.hayLuz(G.mision, e.dia, G.nasa)) return nebula('Se puso el Sol. Desde hoy los paneles no producen nada: solo cuentan las baterías y el reactor.', 'pensando');
  return '';
}

function chip(icono, nombre, valor, max, texto, invertir = false) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  const clase = invertir ? (pct > 80 ? 'peligro' : pct > 55 ? 'alerta' : '') : (pct < 20 ? 'peligro' : pct < 40 ? 'alerta' : '');
  return `<div class="chip ${clase}"><span class="ico" aria-hidden="true">${icono}</span>
    <span class="val"><b>${texto}</b><small>${nombre}</small></span><i style="width:${pct}%"></i></div>`;
}

function hudRecursos(e, ini, m, capacidad) {
  return `<div class="hud-recursos">
    ${chip('⚡', 'kWh', e.energia, capacidad || 1, fmt(e.energia))}
    ${chip('🫁', 'kg O₂', e.o2, Math.max(ini.o2, 1), fmt(e.o2, 1))}
    ${chip('💧', 'kg', e.agua, Math.max(ini.agua, 1), fmt(e.agua, 0))}
    ${chip('🥫', 'kg', e.comida, Math.max(ini.comida, 1), fmt(e.comida, 0))}
    ${chip('☢️', `/${m.limite_dosis_msv} mSv`, e.dosis, m.limite_dosis_msv, fmt(e.dosis, 1), true)}
    ${chip('❤️', 'salud', e.salud, 100, `${fmt(e.salud)}%`)}
    ${chip('🔬', `ciencia /${m.objetivo_ciencia}`, e.ciencia, m.objetivo_ciencia, fmt(e.ciencia))}
  </div>`;
}

function mision() {
  const m = G.mision, e = actual(), c = e.config, j = G.juego;
  const ultimo = G.registros[G.registros.length - 1];
  const luz = S.hayLuz(m, e.dia, G.nasa);
  const capacidad = c.bateria * j.modulos.bateria.capacidad_kwh;
  const ini = G.estados[0];
  const tormentaAhora = ultimo?.eventos.some((x) => x.tipo === 'tormenta_solar');

  const linea = Array.from({ length: m.dias }, (_, i) => {
    const r = G.registros[i];
    const ev = m.eventos.filter((x) => x.dia === i);
    const marca = ev.some((x) => x.tipo.includes('solar')) ? '💥' : ev.length ? '⚠️' : '';
    const cls = [S.hayLuz(m, i, G.nasa) ? 'luz' : 'noche', i > e.dia ? 'futuro' : '', i === e.dia ? 'hoy' : '', r?.apagados.length ? 'mal' : '', r?.decision.refugio ? 'refugio' : ''].join(' ');
    const puede = i < e.dia;
    return `<button class="${cls}" ${puede ? `data-dia="${i}"` : 'disabled'} aria-label="Día ${i + 1}${puede ? ', rebobinar aquí' : ''}">
      <span>${i + 1}</span><span class="marca">${i <= e.dia ? marca : ''}</span></button>`;
  }).join('');

  const avisos = [];
  if (G.avisoRebobinado !== null) avisos.push(`<div class="aviso info">⏪ Rebobinaste al inicio del día ${G.avisoRebobinado + 1}. Cambia tus decisiones y vuelve a avanzar.</div>`);
  if (ultimo) for (const ev of ultimo.eventos) avisos.push(`<div class="aviso ${ev.tipo === 'tormenta_solar' ? 'peligro' : ''}"><b>Día ${ultimo.dia + 1}</b> · ${esc(ev.texto)}${ev.url ? ` <a href="${esc(ev.url)}" target="_blank" rel="noopener">Ver en NASA DONKI</a>` : ''}</div>`);
  if (ultimo?.apagados.length) avisos.push(`<div class="aviso peligro"><b>Día ${ultimo.dia + 1}</b> · Se apagó: ${esc(ultimo.apagados.join(', '))}.</div>`);

  const bitacora = G.registros.slice().reverse().map((r) => `<li><b>Día ${r.dia + 1}</b> ${r.luz ? '☀️' : '🌑'} energía +${fmt(r.produccion)} / −${fmt(r.demanda)} kWh${r.decision.refugio ? ' · 🛡️ refugio' : ''}${r.eventos.length ? ' · ' + esc(r.eventos.map((x) => x.texto).join(' ')) : ''}</li>`).join('');

  const decision = (k, icono, etiqueta, detalle, mostrar = true) => mostrar ? `
    <button class="decision" aria-pressed="${G.hoy[k]}" data-dec="${k}">
      <span class="ico">${icono}</span><b>${etiqueta}</b><small>${detalle}</small></button>` : '';

  $app.innerHTML = `
    <header class="hud">
      <div class="entre">
        <button id="abortar" class="fantasma" aria-label="Volver al diseño">← Diseño</button>
        <div class="dia-hud"><span class="cielo">${luz ? '☀️' : '🌑'}</span><b>Día ${Math.min(e.dia + 1, m.dias)}</b><span class="suave">/ ${m.dias}</span></div>
        <span class="pastilla" title="Rebobinados">⏪ ${G.rebobinados}</span>
      </div>
      ${hudRecursos(e, ini, m, capacidad)}
    </header>
    <div class="marco-escena ${tormentaAhora ? 'en-tormenta' : ''}">${escena({
      config: c, luz, carga: capacidad ? e.energia / capacidad : 0, danados: e.panelesDanados,
      apagados: ultimo?.apagados, tormenta: tormentaAhora, refugio: G.hoy.refugio,
      tripulacion: m.tripulacion, invernaderoOn: G.hoy.invernadero,
    })}</div>
    <div class="linea-tiempo" aria-label="Línea de tiempo: toca un día pasado para rebobinar">${linea}</div>
    ${avisos.join('')}
    ${pistaNebula(e, ultimo)}
    <h3 class="titulo-seccion">Decisiones para el día ${e.dia + 1}</h3>
    <div class="decisiones">
      ${decision('refugio', '🛡️', 'Refugio', '−90 % de radiación de tormenta, sin ciencia')}
      ${decision('racion', '🥣', 'Ración reducida', '−20 % de comida, baja la salud')}
      ${decision('invernadero', '🌱', 'Invernadero', 'apágalo para ahorrar energía y agua', c.invernadero)}
    </div>
    <details class="tarjeta"><summary>📜 Bitácora (${G.registros.length} días)</summary>${bitacora ? `<ul class="bitacora">${bitacora}</ul>` : '<p class="suave chico">Aún no pasa ningún día.</p>'}</details>
    <div class="barra-accion"><div class="fila">
      <button class="primario" id="dia1">Avanzar 1 día ▶</button>
      <button id="dia5" class="secundario">⏩ ×5</button>
    </div></div>`;

  document.getElementById('abortar').addEventListener('click', () => { G.config = { ...ini.config }; G.rebobinados += 1; arriba(); construir(); });
  document.getElementById('dia1').addEventListener('click', () => avanzar(1));
  document.getElementById('dia5').addEventListener('click', () => avanzar(5));
  $app.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => { G.hoy[b.dataset.dec] = !G.hoy[b.dataset.dec]; mision(); }));
  $app.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => rebobinar(+b.dataset.dia)));
  const hoy = $app.querySelector('.linea-tiempo .hoy');
  if (hoy) hoy.parentElement.scrollLeft = hoy.offsetLeft - hoy.parentElement.clientWidth / 2;
}

// ───────────────────────── Resultado ─────────────────────────
function final() {
  arriba();
  const m = G.mision, e = actual();
  const res = S.resultado(e, m);
  const idx = G.misiones.indexOf(m);
  const siguiente = G.misiones[idx + 1];
  const ultimo = G.registros[G.registros.length - 1];
  const vista = escena({
    config: e.config, luz: ultimo?.luz ?? true, carga: Math.max(0, e.energia) / Math.max(1, e.config.bateria * G.juego.modulos.bateria.capacidad_kwh),
    danados: e.panelesDanados, apagados: ultimo?.apagados, tormenta: res.motivo === 'radiacion',
    refugio: false, tripulacion: res.exito ? m.tripulacion : 0,
  });
  const estrellas = res.exito ? (G.rebobinados === 0 ? 3 : G.rebobinados <= 2 ? 2 : 1) : 0;
  api.enviarPartida({
    mision: m.id, exito: res.exito, motivo: res.motivo || null, dias: e.dia, ciencia: e.ciencia,
    rebobinados: G.rebobinados, estrellas, config: e.config, nombre: G.jugador.nombre, aula: G.jugador.aula,
  });

  if (res.exito) {
    G.progreso[m.id] = Math.max(G.progreso[m.id] || 0, estrellas);
    guardar('horizonte.progreso', G.progreso);
    $app.innerHTML = `
      <div class="marco-escena exito">${vista}</div>
      <section class="tarjeta centrado">
        <p class="lema">Misión cumplida</p>
        <div class="estrellas-res" aria-label="${estrellas} de 3 estrellas">${'★'.repeat(estrellas)}<span>${'★'.repeat(3 - estrellas)}</span></div>
        <div class="resumen-diseno">
          <div class="dato bien"><small>Sobrevivieron</small><b>${m.tripulacion} de ${m.tripulacion}</b></div>
          <div class="dato"><small>Días</small><b>${m.dias}</b></div>
          <div class="dato"><small>Ciencia</small><b>${e.ciencia} / ${m.objetivo_ciencia}</b></div>
          <div class="dato"><small>Rebobinados</small><b>${G.rebobinados}</b></div>
        </div>
      </section>
      ${nebula(esc(m.nebula.exito), 'feliz')}
      <div class="fila">
        ${siguiente ? `<button class="primario" id="sig">Siguiente: ${esc(siguiente.titulo)}</button>` : ''}
        ${!siguiente && !G.eval.caso ? '<button class="primario" id="evalfinal">📝 Prueba final y caso Artemis-7</button>' : ''}
        <button id="inicio" class="secundario">Volver a misiones</button>
      </div>`;
    document.getElementById('evalfinal')?.addEventListener('click', G.eval.final ? casoArtemis : pruebaFinal);
    if (siguiente) document.getElementById('sig').addEventListener('click', () => { G.mision = siguiente; G.config = S.configInicial(siguiente); G.rebobinados = 0; arriba(); construir(); });
    document.getElementById('inicio').addEventListener('click', inicio);
    return;
  }

  const a = S.analizarFalla(res.motivo, G.registros, e, m, G.nasa);
  const diaRebobinar = Math.max(0, Math.min(a.dia, G.estados.length - 2));
  $app.innerHTML = `
    <div class="marco-escena falla">${vista}<div class="sello">FALLA · DÍA ${e.dia}</div></div>
    <section class="tarjeta"><h2>💥 ${esc(a.titulo)}</h2>
      <p class="suave">Así ocurrió:</p>
      <ol class="cadena">${a.cadena.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    </section>
    ${a.datos.map(cifraNasa).join('')}
    ${nebula(esc(a.consejo), 'pensando')}
    <div class="fila">
      <button class="${a.redisenar ? 'secundario' : 'primario'}" id="rebobinar">⏪ Rebobinar al día ${diaRebobinar + 1}</button>
      <button class="${a.redisenar ? 'primario' : 'secundario'}" id="redisenar">🔧 Rediseñar la base</button>
    </div>`;
  document.getElementById('rebobinar').addEventListener('click', () => rebobinar(diaRebobinar));
  document.getElementById('redisenar').addEventListener('click', () => { G.config = { ...G.estados[0].config }; G.rebobinados += 1; arriba(); construir(); });
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
  return `<section class="tarjeta aprendizaje">
    <div class="entre"><h3>📈 Tu aprendizaje</h3>${ev.inicial && ev.final && ev.caso ? '<button class="fantasma" data-eval="resumen">Ver resumen →</button>' : ''}</div>
    ${fila('📝', 'Prueba inicial', ev.inicial, ev.inicial ? `${ev.inicial.puntaje}/${ev.inicial.maximo}` : 'Antes de jugar · 2 min', ev.inicial ? null : 'inicial')}
    ${fila('🎯', 'Prueba final', ev.final, ev.final ? `${ev.final.puntaje}/${ev.final.maximo}` : bloqueadaFinal ? `Completa “${esc(ultimaMision().titulo.replace(/^Misión \d · /, ''))}”` : 'Lista para hacer', 'final', bloqueadaFinal)}
    ${fila('🧑‍🚀', 'Caso Artemis-7', ev.caso, ev.caso ? `${ev.caso.puntaje}/8 · ${ev.caso.nivel}` : 'Rúbrica 0–8 · después de la prueba final', 'caso', !ev.final)}
  </section>`;
}

function pruebaInicial(despues) {
  E.mostrarPrueba($app, G.evaluacion.inicial, {
    conRespuestas: false,
    alTerminar: (r) => { guardarEval('inicial', r); despues(); },
    alSaltar: () => { G.eval.saltoInicial = true; guardar('horizonte.evaluacion', G.eval); despues(); },
  });
}

function pruebaFinal() {
  E.mostrarPrueba($app, G.evaluacion.final, {
    conRespuestas: true, nasa: G.nasa,
    alTerminar: (r) => { guardarEval('final', r); casoArtemis(); },
  });
}

function casoArtemis() {
  E.mostrarCaso($app, G.evaluacion.caso, {
    niveles: G.evaluacion.niveles,
    alTerminar: (r) => { guardarEval('caso', r); resumenAprendizaje(); },
  });
}

function resumenAprendizaje() {
  arriba();
  const { inicial, final, caso } = G.eval;
  const g = E.ganancia(inicial?.puntaje, final?.puntaje, 5);
  const barra = (v, max) => `<div class="barra"><span style="width:${max ? (v / max) * 100 : 0}%"></span></div>`;
  $app.innerHTML = `
    <section class="tarjeta">
      <p class="lema">Tu aprendizaje</p>
      <h2>${esc(G.jugador.nombre || 'Comandante')}</h2>
      <div class="comparacion">
        <div><small class="suave">Prueba inicial</small><b>${inicial ? `${inicial.puntaje}/5` : '—'}</b>${barra(inicial?.puntaje || 0, 5)}</div>
        <div class="flecha">→</div>
        <div><small class="suave">Prueba final</small><b>${final ? `${final.puntaje}/5` : '—'}</b>${barra(final?.puntaje || 0, 5)}</div>
      </div>
      ${g != null ? `<p class="centrado">Ganancia de aprendizaje: <b>${Math.round(g * 100)} %</b> <span class="chico suave">de lo que te faltaba aprender</span></p>` : '<p class="chico suave centrado">Haz la prueba inicial y la final para ver tu ganancia.</p>'}
    </section>
    ${caso ? `<section class="tarjeta centrado"><p class="lema">Rúbrica · Caso Artemis-7</p>
      <div class="nivel-res nivel-${caso.nivel}"><b>${caso.puntaje}</b><span>/ 8</span></div>
      <p><span class="pastilla">${caso.nivel} · ${esc(G.evaluacion.niveles.find((n) => n.codigo === caso.nivel)?.nombre || '')}</span></p></section>` : ''}
    ${nebula(g != null && g > 0 ? '¡Aprendiste cómo se conectan los sistemas de una base! Eso es exactamente lo que hacen los ingenieros de la NASA.' : 'Cada falla que entiendes te acerca a ser comandante. ¡Vuelve a jugar las misiones!', 'feliz')}
    <div class="fila"><button class="primario" id="volver">Volver a misiones</button></div>`;
  document.getElementById('volver').addEventListener('click', inicio);
}

// ───────────────────────── Fuentes ─────────────────────────
function fuentes() {
  arriba();
  const filas = Object.values(G.nasa.cifras).map((c) => `<tr><td>${esc(c.texto)}<br>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.fuente)}</a></td>
    <td><span class="etq ${c.verificado ? '' : 'pendiente'}">${c.verificado ? 'verificado' : 'por verificar'}</span></td></tr>`).join('');
  $app.innerHTML = `
    <button id="volver" class="fantasma">← Misiones</button>
    <h2 class="titulo-mision">📚 Datos NASA usados</h2>
    <p class="suave">Cada número de la simulación tiene una fuente. Los valores de equilibrio del juego (masa de los paneles, energía del invernadero…) están separados en <code>data/juego.json</code> y no se presentan como datos NASA.</p>
    <section class="tarjeta"><table class="tabla-fuentes"><tbody>${filas}</tbody></table></section>`;
  document.getElementById('volver').addEventListener('click', inicio);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
cargar().catch((err) => {
  $app.innerHTML = `<p class="cargando">No se pudo cargar el juego (${esc(err.message)}). Ábrelo con un servidor local: <code>npm start</code></p>`;
});
