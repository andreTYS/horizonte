// Panel docente de ASU STELLAR · Horizonte: consulta /api/resultados del servidor del VPS,
// genera el enlace (y QR) del modo aula, pausa a toda el aula y exporta los datos a CSV.
import qrcode from '../vendor/qrcode/qrcode.mjs';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = (nombre) => `<svg class="i" aria-hidden="true"><use href="icons/sprite.svg#i-${nombre}"></use></svg>`;
const MOTIVOS = { energia: 'Energía', o2: 'Oxígeno', agua: 'Agua', comida: 'Comida', radiacion: 'Radiación', salud: 'Salud', ciencia: 'Ciencia insuficiente', exito: 'Llegan al final' };
const fecha = (f) => (f ? new Date(f.includes('T') ? f : f.replace(' ', 'T') + 'Z').toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '');

let sesion = null;   // { aula, token }
let datos = null;    // última respuesta de /api/resultados
let misiones = {};   // id → título sin número

fetch('data/misiones.json').then((r) => r.json()).then((lista) => {
  misiones = Object.fromEntries(lista.map((m) => [m.id, m.titulo.replace(/^(Misión \d|Extra) · /, '')]));
}).catch(() => {});
const nombreMision = (id) => misiones[id] || id;

try {
  $('token').value = sessionStorage.getItem('horizonte.token') || '';
  $('aula').value = sessionStorage.getItem('horizonte.aulaDocente') || '';
} catch { /* sin almacenamiento */ }

$('form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  sesion = { aula: $('aula').value.trim().toUpperCase(), token: $('token').value };
  try { sessionStorage.setItem('horizonte.token', sesion.token); sessionStorage.setItem('horizonte.aulaDocente', sesion.aula); } catch { /* sin almacenamiento */ }
  cargar();
});

async function cargar() {
  $('salida').innerHTML = '<p class="suave">Cargando…</p>';
  try {
    const r = await fetch(`api/resultados?aula=${encodeURIComponent(sesion.aula)}`, { headers: { Authorization: `Bearer ${sesion.token}` } });
    if (r.status === 401) throw new Error('Clave docente incorrecta.');
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}.`);
    datos = await r.json();
    pintar();
  } catch (err) {
    $('salida').innerHTML = `<div class="aviso peligro">${esc(err.message)}</div>`;
  }
}

const tabla = (filas, cols) => `<div class="tabla-scroll"><table class="tabla-fuentes"><thead><tr>${cols.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>${
  filas.map((f) => `<tr>${cols.map(([k, , fmt]) => `<td>${fmt ? fmt(f[k], f) : esc(f[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

/** Enlace para estudiantes: abre el juego con el código de aula y el modo aula activo. */
function enlace(tranquilo) {
  const u = new URL('./', location.href);
  u.searchParams.set('aula', sesion.aula);
  u.searchParams.set('modo', 'aula');
  if (tranquilo) u.searchParams.set('ritmo', 'tranquilo');
  return u.href;
}

function tarjetaAula() {
  return `<section class="tarjeta tarjeta-aula">
    <div class="entre"><h3>${I('aula')} Aula ${esc(datos.aula)}</h3><button class="fantasma" id="actualizar">Actualizar</button></div>
    <div class="aula-grid">
      <div>
        <p class="suave chico">Comparte este enlace o el código QR. El juego se abre con el código de aula, <b>sin sonido ni voz al inicio</b> (cada estudiante puede activarlos) y con la pausa de aula activa.</p>
        <label class="casilla"><input type="checkbox" id="tranquilo"> Ritmo tranquilo: sin el botón ×5 (avanzan de un día en un día)</label>
        <div class="enlace-aula"><input id="enlace" readonly><button class="secundario" id="copiar">${I('copiar')} Copiar</button></div>
        <div class="pausa-panel ${datos.pausa ? 'activa' : ''}">
          <p><b>${datos.pausa ? `${I('pausa')} El aula está en pausa` : `${I('play')} El aula está jugando`}</b></p>
          <label>Mensaje en la pantalla de pausa (opcional) <input id="mensaje" maxlength="120" value="${esc(datos.mensaje || '')}" placeholder="Miren la pizarra"></label>
          <button class="${datos.pausa ? 'secundario' : 'primario'}" id="pausar">${datos.pausa ? `${I('play')} Quitar la pausa` : `${I('pausa')} Pausar el aula`}</button>
          <p class="chico suave">Los estudiantes con el modo aula ven la pausa en unos 8 segundos. Su partida no se pierde.</p>
        </div>
      </div>
      <figure class="qr" id="qr" aria-label="Código QR del enlace"></figure>
    </div>
  </section>`;
}

function pintar() {
  const d = datos;
  const ap = d.aprendizaje;
  const nota = (x) => (x ? `${x.puntaje}/${x.maximo}${x.nivel ? ' · ' + x.nivel : ''}` : '—');
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');
  const aprendizaje = ap && ap.estudiantes.length ? `
    <section class="tarjeta"><h3>${I('medidor')} Aprendizaje</h3>
      <div class="resumen-diseno">
        <div class="dato"><small>Prueba inicial (prom.)</small><b>${ap.inicial ?? '—'} / 5</b></div>
        <div class="dato bien"><small>Prueba final (prom.)</small><b>${ap.final ?? '—'} / 5</b></div>
        <div class="dato"><small>Ganancia normalizada</small><b>${ap.ganancia != null ? Math.round(ap.ganancia * 100) + ' %' : '—'}</b></div>
        <div class="dato"><small>Rúbrica Artemis-7 (prom.)</small><b>${ap.caso ?? '—'} / 8</b></div>
      </div>
      <p class="chico suave" style="margin-top:10px">Niveles en la rúbrica: AD ${ap.niveles.AD} · A ${ap.niveles.A} · B ${ap.niveles.B} · C ${ap.niveles.C}</p>
      ${tabla(ap.estudiantes, [['nombre', 'Estudiante'], ['inicial', 'Inicial', nota], ['final', 'Final', nota], ['caso', 'Rúbrica', nota]])}
    </section>` : '';
  const predTotal = d.predicciones.reduce((a, x) => a + x.total, 0), predOk = d.predicciones.reduce((a, x) => a + x.aciertos, 0);
  const predicciones = `<section class="tarjeta"><h3>${I('predecir')} Predicciones</h3>
    <p class="chico suave">Antes de lanzar, cada estudiante predice qué fallará primero (o si llegarán al final). Acertar más con el tiempo indica que entienden cómo se conectan los sistemas.</p>
    ${d.predicciones.length ? `<div class="resumen-diseno"><div class="dato"><small>Predicciones</small><b>${predTotal}</b></div><div class="dato bien"><small>Aciertos</small><b>${pct(predOk, predTotal)}</b></div></div>
      ${tabla(d.predicciones, [['mision', 'Misión', nombreMision], ['total', 'Predicciones'], ['aciertos', 'Aciertos'], ['aciertos', '%', (a, f) => pct(a, f.total)]])}` : '<p class="suave">Aún no hay predicciones.</p>'}
  </section>`;
  const bitacora = `<section class="tarjeta"><h3>${I('lapiz')} Bitácora de tus estudiantes</h3>
    <p class="chico suave">Al terminar una misión escriben qué cambiaron o qué protegieron. Es la evidencia de su explicación.</p>
    ${d.notas.length ? `<ul class="lista-notas">${d.notas.slice(0, 100).map((n) => `<li><p>«${esc(n.nota)}»</p><small>${esc(n.nombre || 'Sin nombre')} · ${esc(nombreMision(n.mision))} · ${esc(fecha(n.fecha))}</small></li>`).join('')}</ul>` : '<p class="suave">Aún no hay frases en la bitácora.</p>'}
  </section>`;
  $('salida').innerHTML = `${tarjetaAula()}${aprendizaje}${predicciones}${bitacora}
    <section class="tarjeta"><h3>Resumen por misión</h3>${d.resumen.length ? tabla(d.resumen, [['mision', 'Misión', nombreMision], ['intentos', 'Intentos'], ['exitos', 'Éxitos'], ['rebobinados_prom', 'Rebobinados (prom.)']]) : '<p class="suave">Aún no hay partidas.</p>'}</section>
    <section class="tarjeta"><h3>¿Dónde fallan más?</h3>${d.fallas.length ? tabla(d.fallas, [['mision', 'Misión', nombreMision], ['motivo', 'Causa', (m) => MOTIVOS[m] || esc(m)], ['veces', 'Veces']]) : '<p class="suave">Sin fallas registradas.</p>'}</section>
    <section class="tarjeta"><div class="entre"><h3>Partidas</h3><div class="fila-botones"><button class="secundario" id="csvPartidas">${I('descargar')} Partidas (CSV)</button><button class="secundario" id="csvNotas">${I('descargar')} Bitácoras (CSV)</button></div></div>
      ${tabla(d.partidas.slice(0, 200), [['nombre', 'Estudiante', (x) => esc(x || '—')], ['mision', 'Misión', nombreMision], ['exito', 'Resultado', (x) => (x ? '<span class="ok">Lo logró</span>' : '<span class="mal">Falló</span>')],
        ['motivo', 'Causa', (m) => MOTIVOS[m] || ''], ['prediccion', 'Predijo', (p, f) => (p ? `${MOTIVOS[p] || esc(p)} ${(f.exito ? p === 'exito' : p === f.motivo) ? '✓' : ''}` : '—')],
        ['estrellas', 'Estrellas'], ['rebobinados', 'Rebobinados'], ['fecha', 'Fecha', fecha]])}</section>`;

  const actualizarEnlace = () => {
    const url = enlace($('tranquilo').checked);
    $('enlace').value = url;
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    $('qr').innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }) + '<figcaption>Escanéalo con el celular</figcaption>';
  };
  actualizarEnlace();
  $('tranquilo').addEventListener('change', actualizarEnlace);
  $('copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('enlace').value); $('copiar').textContent = 'Copiado'; } catch { $('enlace').select(); }
  });
  $('actualizar').addEventListener('click', cargar);
  $('pausar').addEventListener('click', async () => {
    const r = await fetch('api/aula', {
      method: 'POST', headers: { Authorization: `Bearer ${sesion.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ aula: sesion.aula, pausa: !datos.pausa, mensaje: $('mensaje').value.trim() }),
    });
    if (r.ok) { datos.pausa = !datos.pausa; datos.mensaje = $('mensaje').value.trim(); pintar(); }
  });
  $('csvPartidas').addEventListener('click', () => descargarCsv(`partidas-${d.aula}.csv`, d.partidas,
    [['fecha', 'Fecha'], ['nombre', 'Estudiante'], ['mision', 'Misión'], ['exito', 'Logró'], ['motivo', 'Causa'], ['prediccion', 'Predicción'], ['dias', 'Días'], ['ciencia', 'Ciencia'], ['rebobinados', 'Rebobinados'], ['estrellas', 'Estrellas']]));
  $('csvNotas').addEventListener('click', () => descargarCsv(`bitacoras-${d.aula}.csv`, d.notas, [['fecha', 'Fecha'], ['nombre', 'Estudiante'], ['mision', 'Misión'], ['nota', 'Frase']]));
}

/** CSV con punto y coma y BOM: Excel en español lo abre bien. */
function descargarCsv(nombre, filas, cols) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const texto = [cols.map(([, t]) => celda(t)).join(';'), ...filas.map((f) => cols.map(([k]) => celda(k === 'mision' ? nombreMision(f[k]) : f[k])).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
