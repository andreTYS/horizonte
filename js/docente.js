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

// Crear la clase propia: el docente elige su clave (el servidor la guarda cifrada)
$('formCrear').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const clave = $('claveNueva').value;
  $('salida').innerHTML = '<p class="suave">Creando tu clase…</p>';
  try {
    const r = await fetch('api/clase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aula: $('aulaNueva').value.trim(), clave }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `El servidor respondió ${r.status}.`);
    sesion = { aula: d.aula, token: clave };
    try { sessionStorage.setItem('horizonte.token', clave); sessionStorage.setItem('horizonte.aulaDocente', d.aula); } catch { /* sin almacenamiento */ }
    $('aula').value = d.aula;
    G_nueva = d.aula;
    cargar();
  } catch (err) {
    $('salida').innerHTML = `<div class="aviso peligro">${esc(err.message)}</div>`;
  }
});
let G_nueva = null;

$('form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  sesion = { aula: $('aula').value.trim().toUpperCase(), token: $('token').value };
  try { sessionStorage.setItem('horizonte.token', sesion.token); sessionStorage.setItem('horizonte.aulaDocente', sesion.aula); } catch { /* sin almacenamiento */ }
  cargar();
});

// ── Aula de demostración: datos de ejemplo (inventados) para conocer el panel sin clave ──
function datosDemo() {
  let semilla = 7;
  const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
  const nombres = ['Luz', 'Mateo', 'Ximena', 'Thiago', 'Valeria', 'Joaquín', 'Camila', 'Renzo'];
  const camp = ['cero', 'noche', 'amanecer', 'marte', 'tormenta_marte'];
  const causa = { cero: 'energia', noche: 'energia', amanecer: 'o2', marte: 'energia', tormenta_marte: 'radiacion' };
  const frases = {
    noche: ['Puse el reactor porque la noche dura 14 días.', 'Agregué baterías, pero no alcanzaban: cambié al reactor.'],
    amanecer: ['Llevé más agua porque el oxígeno se hace con agua.', 'El reciclador ahorra agua pero gasta energía.'],
    marte: ['En la tormenta de polvo apagué el invernadero.', 'El reactor sigue funcionando aunque no haya sol.'],
    tormenta_marte: ['Cuando llegó la alerta metí a todos al refugio.', 'El blindaje alto bajó la radiación.'],
    cero: ['Sin baterías la base se apaga en la noche.'],
  };
  const ahora = Date.now(), partidas = [], notas = [], logros = [], estudiantes = [];
  nombres.forEach((nombre, n) => {
    let misiones = 0, creditos = 0;
    const llega = 2 + Math.floor(azar() * 4);
    camp.slice(0, llega).forEach((m, k) => {
      const intentos = 1 + Math.floor(azar() * 3);
      for (let i = 0; i < intentos; i++) {
        const exito = i === intentos - 1 && azar() > 0.15;
        const pred = azar() < 0.6 ? (exito ? 'exito' : causa[m]) : ['agua', 'comida', 'o2'][Math.floor(azar() * 3)];
        partidas.push({ nombre, mision: m, exito, motivo: exito ? null : causa[m], prediccion: pred, estrellas: exito ? 3 - Math.min(2, i) : 0, rebobinados: Math.floor(azar() * 3), dias: 10 + Math.floor(azar() * 20), ciencia: Math.floor(azar() * 30), fecha: new Date(ahora - (n * 9 + k * 3 + i) * 3600e3).toISOString() });
        if (exito) { misiones += 1; creditos += 60 + Math.floor(azar() * 50); }
      }
      if (azar() < 0.7) notas.push({ nombre, mision: m, nota: frases[m][Math.floor(azar() * frases[m].length)], fecha: new Date(ahora - (n * 9 + k * 3) * 3600e3).toISOString() });
    });
    logros.push({ nombre, misiones, insignias: ['primera', 'profeta', 'leccion', 'noche', 'limpio'].slice(0, 1 + Math.floor(azar() * 5)), creditos, actualizado: ahora - n * 1800e3 });
    const ini = 1 + Math.floor(azar() * 3), fin = Math.min(5, ini + 1 + Math.floor(azar() * 3)), caso = 3 + Math.floor(azar() * 6);
    estudiantes.push({ nombre, inicial: { puntaje: ini, maximo: 5 }, final: llega >= 5 ? { puntaje: fin, maximo: 5 } : null, caso: llega >= 5 ? { puntaje: caso, maximo: 8, nivel: caso >= 7 ? 'AD' : caso >= 5 ? 'A' : caso >= 3 ? 'B' : 'C' } : null });
  });
  const prom = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const conFinal = estudiantes.filter((e) => e.final);
  const pi = prom(conFinal.map((e) => e.inicial.puntaje)), pf = prom(conFinal.map((e) => e.final.puntaje));
  const niveles = { AD: 0, A: 0, B: 0, C: 0 };
  estudiantes.forEach((e) => { if (e.caso) niveles[e.caso.nivel] += 1; });
  const porMision = (fn) => camp.map((m) => fn(m, partidas.filter((p) => p.mision === m))).filter(Boolean);
  return {
    aula: 'DEMO-3B', demo: true, pausa: false, mensaje: '',
    aprendizaje: { estudiantes, inicial: prom(estudiantes.map((e) => e.inicial.puntaje)), final: pf, ganancia: pi != null && pf != null ? (pf - pi) / (5 - pi) : null, caso: prom(estudiantes.filter((e) => e.caso).map((e) => e.caso.puntaje)), niveles },
    predicciones: porMision((m, ps) => ps.length && { mision: m, total: ps.length, aciertos: ps.filter((p) => p.prediccion === (p.exito ? 'exito' : p.motivo)).length }),
    resumen: porMision((m, ps) => ps.length && { mision: m, intentos: ps.length, exitos: ps.filter((p) => p.exito).length, rebobinados_prom: prom(ps.map((p) => p.rebobinados)) }),
    fallas: porMision((m, ps) => { const f = ps.filter((p) => !p.exito); return f.length && { mision: m, motivo: causa[m], veces: f.length }; }),
    partidas: partidas.sort((a, b) => b.fecha.localeCompare(a.fecha)), notas, logros,
  };
}

$('demoBtn')?.addEventListener('click', () => {
  sesion = { aula: 'DEMO-3B', token: null, demo: true };
  datos = datosDemo();
  pintar();
  $('salida').scrollIntoView({ behavior: 'smooth' });
});

async function cargar() {
  if (sesion?.demo) { datos = datosDemo(); pintar(); return; }
  $('salida').innerHTML = '<p class="suave">Cargando…</p>';
  try {
    const r = await fetch(`api/resultados?aula=${encodeURIComponent(sesion.aula)}`, { headers: { Authorization: `Bearer ${sesion.token}` } });
    if (r.status === 401) throw new Error('El código o la clave no coinciden. Si fallas muchas veces, espera 10 minutos.');
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}.`);
    datos = await r.json();
    pintar();
  } catch (err) {
    $('salida').innerHTML = `<div class="aviso peligro">${esc(err.message)}</div>`;
  }
}

const tabla = (filas, cols) => `<div class="tabla-scroll" tabindex="0" role="region" aria-label="Tabla"><table class="tabla-fuentes"><thead><tr>${cols.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>${
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
        <div class="enlace-aula"><input id="enlace" readonly aria-label="Enlace para tus estudiantes"><button class="secundario" id="copiar">${I('copiar')} Copiar</button></div>
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
  const logros = `<section class="tarjeta"><h3>${I('estrella')} Logros de tus estudiantes</h3>
    <p class="chico suave">Créditos estelares e insignias ganadas en el juego (se guardan cuando el estudiante escribe su nombre y el código de aula).</p>
    ${d.logros?.length ? tabla(d.logros, [['nombre', 'Estudiante'], ['misiones', 'Misiones cumplidas'], ['insignias', 'Insignias', (x) => String(x.length)], ['creditos', 'Créditos'], ['actualizado', 'Última vez', (x) => new Date(x).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })]]) : '<p class="suave">Aún no hay progreso guardado.</p>'}
  </section>`;
  const avisoNueva = G_nueva === d.aula ? `<div class="aviso-demo" role="status"><b>¡Tu clase está lista!</b> Código: <b class="codigo-grande">${esc(d.aula)}</b>. Díctalo a tus estudiantes o muéstrales el QR. Anota tu clave: la necesitarás para volver a entrar.</div>` : '';
  $('salida').innerHTML = `${avisoNueva}${d.demo ? '<div class="aviso-demo" role="status"><b>Aula de demostración.</b> Los estudiantes y resultados son <b>inventados</b> para que veas cómo funciona el panel. Nada se guarda. Para tu aula real, escribe tu código y la clave docente.</div>' : ''}${tarjetaAula()}${aprendizaje}${predicciones}${logros}${bitacora}
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
    if (d.demo) { datos.pausa = !datos.pausa; datos.mensaje = $('mensaje').value.trim(); pintar(); return; } // en la demo la pausa es solo de muestra
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
