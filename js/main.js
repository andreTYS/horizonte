// Interfaz de HORIZONTE: pantallas, decisiones del jugador y rebobinado.
import * as S from './sim.js';

const $app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 0) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

const G = {
  nasa: null, juego: null, misiones: [],
  mision: null, config: null,
  estados: [], registros: [], decisiones: [], hoy: null,
  rebobinados: 0, avisoRebobinado: null,
  progreso: leerProgreso(),
};

function leerProgreso() {
  try { return JSON.parse(localStorage.getItem('horizonte.progreso') || '{}'); } catch { return {}; }
}
function guardarProgreso() {
  try { localStorage.setItem('horizonte.progreso', JSON.stringify(G.progreso)); } catch { /* sin almacenamiento: el juego sigue */ }
}

async function cargar() {
  const leer = (f) => fetch(`data/${f}`).then((r) => r.json());
  [G.nasa, G.juego, G.misiones] = await Promise.all([leer('nasa.json'), leer('juego.json'), leer('misiones.json')]);
  inicio();
}

function nebula(texto) {
  return `<div class="nebula tarjeta"><div class="cara" aria-hidden="true">🐱‍🚀</div><div class="globo"><strong>Nebula:</strong> ${texto}</div></div>`;
}

function cifraNasa(clave) {
  const c = G.nasa.cifras[clave];
  if (!c) return '';
  return `<div class="cifra-nasa"><div class="etiqueta">DATO NASA</div><p>${esc(c.texto)}</p>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">Fuente: ${esc(c.fuente)}</a></div>`;
}

function arriba() { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }

// ───────────────────────── Portada ─────────────────────────
function inicio() {
  arriba();
  const misiones = G.misiones.map((m, i) => {
    const p = G.progreso[m.id];
    const estado = p ? `★`.repeat(p) + `☆`.repeat(3 - p) + ' completada' : '';
    return `<button class="mision-btn tarjeta" data-mision="${i}">
      <h3>${esc(m.titulo)}</h3><span class="suave">${esc(m.resumen)}</span>
      ${estado ? `<span class="estado">${estado}</span>` : ''}</button>`;
  }).join('');
  $app.innerHTML = `
    <section class="portada">
      <p class="lema">ENSAYA EL FUTURO DE TU BASE</p>
      <h1>HORIZONTE</h1>
      <p class="suave">Diseña una base en la Luna, adelanta el tiempo y descubre si tu tripulación llega al día final.
      Si falla, encuentra la causa, <strong>rebobina</strong> y corrige.</p>
    </section>
    ${nebula('¡Hola, comandante! Soy Nebula. Todos los números de este juego vienen de la NASA, y te diré de dónde. ¿Empezamos?')}
    <div class="lista-misiones">${misiones}</div>
    <div class="fila"><button id="fuentes">📚 Datos NASA usados</button></div>
    <p class="chico suave" style="margin-top:16px">Stellar Experience · Moquegua, Perú · NASA Space Apps Challenge 2026</p>`;
  $app.querySelectorAll('[data-mision]').forEach((b) => b.addEventListener('click', () => {
    G.mision = G.misiones[+b.dataset.mision];
    G.config = S.configInicial(G.mision);
    G.rebobinados = 0;
    construir();
  }));
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
  const noche = reactor;
  const bateria = c.bateria * j.modulos.bateria.capacidad_kwh;
  const deficitNoche = demanda - noche;
  const nochesAguanta = deficitNoche <= 0 ? Infinity : bateria / deficitNoche;
  const aguaDia = n * v('agua_persona_dia') * (c.reciclador ? 1 - v('recuperacion_agua') : 1)
    + o2Dia * v('agua_por_kg_o2') + (c.invernadero ? j.modulos.invernadero.agua_kg_dia : 0);
  const comidaDia = n * v('comida_persona_dia') * (c.invernadero ? 1 - j.modulos.invernadero.fraccion_comida : 1);
  const dosis = v('dosis_luna_msv_dia') * (1 - j.modulos.blindaje.niveles[c.blindaje].reduccion) * m.dias;
  return {
    demanda, dia, noche, nochesAguanta,
    diasAgua: c.agua / aguaDia, diasComida: c.comida / comidaDia, diasO2: c.o2 / o2Dia, dosis,
  };
}

function construir() {
  arriba();
  const { mision: m, config: c, juego: j, nasa } = G;
  const masa = S.masa(c, j, nasa);
  const pct = Math.min(100, (masa / m.presupuesto_t) * 100);
  const excedido = masa > m.presupuesto_t;
  const e = estimaciones();
  const dias = (x) => (x === Infinity ? '∞' : fmt(x, 1));
  const ok = (x) => (x >= m.dias ? 'bien' : 'mal');
  const tieneNoche = !m.luz_permanente;

  const stepper = (k, paso, etiqueta, detalle, unidad = '') => `
    <div class="control"><span class="nombre">${etiqueta}</span>
      <div class="stepper"><button aria-label="Quitar ${etiqueta}" data-menos="${k}" data-paso="${paso}">−</button>
      <output>${c[k]}${unidad}</output>
      <button aria-label="Añadir ${etiqueta}" data-mas="${k}" data-paso="${paso}">+</button></div>
      <span class="detalle">${detalle}</span></div>`;
  const interruptor = (k, etiqueta, detalle) => `
    <div class="control"><span class="nombre">${etiqueta}</span>
      <button class="interruptor" aria-pressed="${c[k]}" data-toggle="${k}">${c[k] ? 'Sí' : 'No'}</button>
      <span class="detalle">${detalle}</span></div>`;

  $app.innerHTML = `
    <div class="entre"><button id="volver">← Misiones</button><span class="suave chico">${esc(m.lugar)}</span></div>
    <h2 style="margin-top:12px">${esc(m.titulo)}</h2>
    <p class="suave">${esc(m.resumen)}</p>
    ${nebula(esc(m.nebula.briefing) + '<br><br>' + esc(m.nebula.construir))}

    <section class="tarjeta">
      <div class="entre"><h3>Masa del cohete</h3><b>${fmt(masa, 2)} / ${m.presupuesto_t} t</b></div>
      <div class="barra ${excedido ? 'peligro' : pct > 85 ? 'alerta' : ''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      ${excedido ? '<p class="chico" style="color:var(--peligro);margin-top:6px">Demasiado pesado: el cohete no puede despegar.</p>' : ''}
    </section>

    <section class="tarjeta">
      <h3>⚡ Energía</h3>
      ${stepper('panel', 1, 'Paneles solares', `${j.modulos.panel.masa_t} t c/u · ${j.modulos.panel.kwh_dia_luz} kWh/día, solo con luz`)}
      ${stepper('bateria', 1, 'Baterías', `${j.modulos.bateria.masa_t} t c/u · guardan ${j.modulos.bateria.capacidad_kwh} kWh`)}
      ${interruptor('reactor', 'Reactor de fisión', `${nasa.cifras.fsp_masa_t.valor} t · ${nasa.cifras.fsp_kw.valor} kW día y noche (NASA Fission Surface Power)`)}
    </section>

    <section class="tarjeta">
      <h3>🔧 Sistemas</h3>
      ${interruptor('reciclador', 'Reciclador de agua', `${j.modulos.reciclador.masa_t} t · recupera el ${fmt(nasa.cifras.recuperacion_agua.valor * 100)} % del agua, como la ISS`)}
      ${interruptor('invernadero', 'Invernadero', `${j.modulos.invernadero.masa_t} t · produce ${fmt(j.modulos.invernadero.fraccion_comida * 100)} % de la comida y suma ciencia, pero gasta agua y energía`)}
      <div class="control"><span class="nombre">Blindaje</span>
        <div class="segmentos" role="group" aria-label="Nivel de blindaje">
          ${j.modulos.blindaje.niveles.map((nv, i) => `<button aria-pressed="${c.blindaje === i}" data-blindaje="${i}">${i === 0 ? 'No' : '▮'.repeat(i)}</button>`).join('')}
        </div>
        <span class="detalle">Regolito sobre el hábitat: ${j.modulos.blindaje.niveles.map((nv) => `${nv.masa_t} t → −${fmt(nv.reduccion * 100)} %`).join(' · ')}</span></div>
    </section>

    <section class="tarjeta">
      <h3>📦 Suministros</h3>
      ${stepper('o2', 5, 'Oxígeno', 'kg de reserva', ' kg')}
      ${stepper('agua', 10, 'Agua', 'kg (también se usa para fabricar oxígeno)', ' kg')}
      ${stepper('comida', 10, 'Comida', 'kg', ' kg')}
    </section>

    <section class="tarjeta">
      <h3>📊 ¿Alcanza? (${m.tripulacion} astronautas · ${m.dias} días)</h3>
      <div class="resumen-diseno">
        <div class="dato ${e.dia >= e.demanda ? 'bien' : 'mal'}"><small>Energía con luz</small><b>+${fmt(e.dia)} / −${fmt(e.demanda)}</b><small>kWh por día</small></div>
        ${tieneNoche ? `<div class="dato ${e.nochesAguanta >= 15 ? 'bien' : 'mal'}"><small>De noche aguantas</small><b>${dias(e.nochesAguanta)} días</b><small>la noche dura ~15</small></div>` : ''}
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
  if (e.dia === 0) return nebula('Cada botón “Avanzar” pasa un día. Vigila las barras: si una llega a cero, la base falla. Puedes tocar un día pasado en la línea de tiempo para <strong>rebobinar</strong>.');
  if (ultimo?.eventos.some((x) => x.tipo === 'alerta_solar')) return nebula('¡Una llamarada! Las partículas llegan mañana. Activa el <strong>refugio</strong> antes de avanzar.');
  if (ultimo?.apagados.length) return nebula(`Ojo: hoy se apagó <strong>${esc(ultimo.apagados.join(', '))}</strong> por falta de recursos. ¿Qué puedes cambiar?`);
  if (ultimo && ultimo.luz && !S.hayLuz(G.mision, e.dia, G.nasa)) return nebula('Se puso el Sol. Desde hoy los paneles no producen nada: solo cuentan las baterías y el reactor.');
  return '';
}

function barraRecurso(icono, nombre, valor, max, unidad, invertir = false, dec = 0) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  // invertir: un valor alto es malo (radiación)
  const clase = invertir ? (pct > 80 ? 'peligro' : pct > 55 ? 'alerta' : '') : (pct < 20 ? 'peligro' : pct < 40 ? 'alerta' : '');
  return `<div class="recurso"><div class="entre"><span>${icono} ${nombre}</span><b>${fmt(valor, dec)} ${unidad}</b></div>
    <div class="barra ${clase}"><span style="width:${pct}%"></span></div></div>`;
}

function mision() {
  arriba();
  const m = G.mision, e = actual(), c = e.config, j = G.juego;
  const ultimo = G.registros[G.registros.length - 1];
  const luz = S.hayLuz(m, e.dia, G.nasa);
  const capacidad = c.bateria * j.modulos.bateria.capacidad_kwh;
  const ini = G.estados[0];

  const linea = Array.from({ length: m.dias }, (_, i) => {
    const r = G.registros[i];
    const ev = m.eventos.filter((x) => x.dia === i);
    const marca = ev.some((x) => x.tipo.includes('solar')) ? '💥' : ev.length ? '⚠️' : '';
    const cls = [S.hayLuz(m, i, G.nasa) ? 'luz' : 'noche', i > e.dia ? 'futuro' : '', i === e.dia ? 'hoy' : '', r?.apagados.length ? 'mal' : ''].join(' ');
    const puede = i < e.dia;
    return `<button class="${cls}" ${puede ? `data-dia="${i}"` : 'disabled'} aria-label="Día ${i + 1}${puede ? ', rebobinar aquí' : ''}">
      <span>${i + 1}</span><span class="marca">${i <= e.dia ? marca : ''}</span></button>`;
  }).join('');

  const avisos = [];
  if (G.avisoRebobinado !== null) avisos.push(`<div class="aviso info">⏪ Rebobinaste al inicio del día ${G.avisoRebobinado + 1}. Cambia tus decisiones y vuelve a avanzar.</div>`);
  if (ultimo) for (const ev of ultimo.eventos) avisos.push(`<div class="aviso ${ev.tipo === 'tormenta_solar' ? 'peligro' : ''}">Día ${ultimo.dia + 1}: ${esc(ev.texto)}</div>`);
  if (ultimo?.apagados.length) avisos.push(`<div class="aviso peligro">Día ${ultimo.dia + 1}: se apagó ${esc(ultimo.apagados.join(', '))}.</div>`);

  const bitacora = G.registros.slice(-8).reverse().map((r) => `<li>Día ${r.dia + 1} ${r.luz ? '☀️' : '🌑'} · energía +${fmt(r.produccion)} / −${fmt(r.demanda)} kWh${r.decision.refugio ? ' · en refugio' : ''}${r.eventos.length ? ' · ' + esc(r.eventos.map((x) => x.texto).join(' ')) : ''}</li>`).join('');

  const dec = (k, etiqueta, detalle, mostrar = true) => mostrar ? `
    <div class="control"><span class="nombre">${etiqueta}</span>
      <button class="interruptor" aria-pressed="${G.hoy[k]}" data-dec="${k}">${G.hoy[k] ? 'Sí' : 'No'}</button>
      <span class="detalle">${detalle}</span></div>` : '';

  $app.innerHTML = `
    <header class="cabecera-mision">
      <div class="entre"><button id="abortar" aria-label="Volver al diseño">← Diseño</button>
        <div style="text-align:right"><b>Día ${Math.min(e.dia + 1, m.dias)} de ${m.dias}</b><br><span class="cielo" aria-label="${luz ? 'Hay luz' : 'Noche lunar'}">${luz ? '☀️' : '🌑'}</span></div></div>
    </header>
    <section class="tarjeta"><div class="linea-tiempo" aria-label="Línea de tiempo: toca un día pasado para rebobinar">${linea}</div>
      <p class="chico suave" style="margin:0">⏪ ${G.rebobinados} rebobinados · toca un día pasado para volver a él</p></section>
    ${avisos.join('')}
    ${pistaNebula(e, ultimo)}
    <section class="tarjeta recursos">
      ${barraRecurso('⚡', 'Baterías', e.energia, capacidad || 1, 'kWh')}
      ${barraRecurso('🫁', 'Oxígeno', e.o2, Math.max(ini.o2, 1), 'kg', false, 1)}
      ${barraRecurso('💧', 'Agua', e.agua, Math.max(ini.agua, 1), 'kg', false, 1)}
      ${barraRecurso('🥫', 'Comida', e.comida, Math.max(ini.comida, 1), 'kg', false, 1)}
      ${barraRecurso('☢️', 'Radiación', e.dosis, m.limite_dosis_msv, `/ ${m.limite_dosis_msv} mSv`, true, 1)}
      ${barraRecurso('❤️', 'Salud', e.salud, 100, '%')}
      ${barraRecurso('🔬', 'Ciencia', e.ciencia, m.objetivo_ciencia, `/ ${m.objetivo_ciencia}`)}
    </section>
    <section class="tarjeta"><h3>Decisiones para el día ${e.dia + 1}</h3>
      ${dec('refugio', 'Refugio', 'Protege de las tormentas solares (−90 %), pero ese día no se hace ciencia.')}
      ${dec('racion', 'Ración reducida', 'Comen 20 % menos; la salud baja cada día.')}
      ${dec('invernadero', 'Invernadero encendido', 'Apágalo para ahorrar energía y agua.', c.invernadero)}
    </section>
    <section class="tarjeta"><h3>Bitácora</h3>${bitacora ? `<ul class="bitacora">${bitacora}</ul>` : '<p class="suave chico">Aún no pasa ningún día.</p>'}</section>
    <div class="barra-accion"><div class="fila">
      <button class="primario" id="dia1">Avanzar 1 día ▶</button>
      <button id="dia5">Avanzar 5 ⏩</button>
    </div></div>`;

  document.getElementById('abortar').addEventListener('click', () => { G.config = { ...ini.config }; G.rebobinados += 1; construir(); });
  document.getElementById('dia1').addEventListener('click', () => avanzar(1));
  document.getElementById('dia5').addEventListener('click', () => avanzar(5));
  $app.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => { G.hoy[b.dataset.dec] = !G.hoy[b.dataset.dec]; mision(); }));
  $app.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => rebobinar(+b.dataset.dia)));
  const hoy = $app.querySelector('.linea-tiempo .hoy');
  if (hoy) hoy.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ───────────────────────── Resultado ─────────────────────────
function final() {
  arriba();
  const m = G.mision, e = actual();
  const res = S.resultado(e, m);
  const idx = G.misiones.indexOf(m);
  const siguiente = G.misiones[idx + 1];

  if (res.exito) {
    const estrellas = G.rebobinados === 0 ? 3 : G.rebobinados <= 2 ? 2 : 1;
    G.progreso[m.id] = Math.max(G.progreso[m.id] || 0, estrellas);
    guardarProgreso();
    $app.innerHTML = `
      <section class="tarjeta" style="text-align:center">
        <h2>🎉 ¡Misión cumplida!</h2>
        <div class="estrellas-res" aria-label="${estrellas} de 3 estrellas">${'★'.repeat(estrellas)}${'☆'.repeat(3 - estrellas)}</div>
        <p class="suave">${m.tripulacion} astronautas sobrevivieron ${m.dias} días · ciencia ${e.ciencia}/${m.objetivo_ciencia} · ${G.rebobinados} rebobinados</p>
      </section>
      ${nebula(esc(m.nebula.exito))}
      <div class="fila">
        ${siguiente ? `<button class="primario" id="sig">Siguiente: ${esc(siguiente.titulo)}</button>` : ''}
        <button id="inicio">Volver a misiones</button>
      </div>`;
    if (siguiente) document.getElementById('sig').addEventListener('click', () => { G.mision = siguiente; G.config = S.configInicial(siguiente); G.rebobinados = 0; construir(); });
    document.getElementById('inicio').addEventListener('click', inicio);
    return;
  }

  const a = S.analizarFalla(res.motivo, G.registros, e, m, G.nasa);
  const diaRebobinar = Math.max(0, Math.min(a.dia, G.estados.length - 2));
  $app.innerHTML = `
    <section class="tarjeta"><h2>💥 ${esc(a.titulo)}</h2>
      <p class="suave">La base falló el día ${e.dia} de ${m.dias}. Así ocurrió:</p>
      <ol class="cadena">${a.cadena.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    </section>
    ${a.datos.map(cifraNasa).join('')}
    ${nebula(esc(a.consejo))}
    <div class="fila">
      <button ${a.redisenar ? '' : 'class="primario"'} id="rebobinar">⏪ Rebobinar al día ${diaRebobinar + 1}</button>
      <button ${a.redisenar ? 'class="primario"' : ''} id="redisenar">🔧 Rediseñar la base</button>
    </div>`;
  document.getElementById('rebobinar').addEventListener('click', () => rebobinar(diaRebobinar));
  document.getElementById('redisenar').addEventListener('click', () => { G.config = { ...G.estados[0].config }; G.rebobinados += 1; construir(); });
}

// ───────────────────────── Fuentes ─────────────────────────
function fuentes() {
  arriba();
  const filas = Object.values(G.nasa.cifras).map((c) => `<tr><td>${esc(c.texto)}<br>
    <a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.fuente)}</a></td>
    <td><span class="etq ${c.verificado ? '' : 'pendiente'}">${c.verificado ? 'verificado' : 'por verificar'}</span></td></tr>`).join('');
  $app.innerHTML = `
    <button id="volver">← Misiones</button>
    <h2 style="margin-top:12px">📚 Datos NASA usados</h2>
    <p class="suave">Cada número de la simulación tiene una fuente. Los valores de equilibrio del juego (masa de los paneles, energía del invernadero…) están separados en <code>data/juego.json</code> y no se presentan como datos NASA.</p>
    <section class="tarjeta"><table class="tabla-fuentes"><tbody>${filas}</tbody></table></section>`;
  document.getElementById('volver').addEventListener('click', inicio);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
cargar().catch((err) => {
  $app.innerHTML = `<p class="cargando">No se pudo cargar el juego (${esc(err.message)}). Ábrelo con un servidor local: <code>npx serve</code></p>`;
});
