// Panel docente: consulta /api/resultados del servidor del VPS.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOTIVOS = { energia: 'Energía', o2: 'Oxígeno', agua: 'Agua', comida: 'Comida', radiacion: 'Radiación', salud: 'Salud', ciencia: 'Ciencia insuficiente' };

try { $('token').value = sessionStorage.getItem('horizonte.token') || ''; } catch { /* sin almacenamiento */ }

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const aula = $('aula').value.trim(), token = $('token').value;
  try { sessionStorage.setItem('horizonte.token', token); } catch { /* sin almacenamiento */ }
  $('salida').innerHTML = '<p class="suave">Cargando…</p>';
  try {
    const r = await fetch(`api/resultados?aula=${encodeURIComponent(aula)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) throw new Error('Clave docente incorrecta.');
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}.`);
    const d = await r.json();
    const tabla = (filas, cols) => `<table class="tabla-fuentes"><tbody><tr>${cols.map(([, t]) => `<td><b>${t}</b></td>`).join('')}</tr>${
      filas.map((f) => `<tr>${cols.map(([k, , fmt]) => `<td>${esc(fmt ? fmt(f[k]) : f[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('salida').innerHTML = `
      <section class="tarjeta"><h3>Resumen · ${esc(d.aula)}</h3>${d.resumen.length ? tabla(d.resumen, [['mision', 'Misión'], ['intentos', 'Intentos'], ['exitos', 'Éxitos'], ['rebobinados_prom', 'Rebobinados (prom.)']]) : '<p class="suave">Aún no hay partidas.</p>'}</section>
      <section class="tarjeta"><h3>¿Dónde fallan más?</h3>${d.fallas.length ? tabla(d.fallas, [['mision', 'Misión'], ['motivo', 'Causa', (m) => MOTIVOS[m] || m], ['veces', 'Veces']]) : '<p class="suave">Sin fallas registradas.</p>'}</section>
      <section class="tarjeta"><h3>Partidas</h3>${tabla(d.partidas.slice(0, 200), [['nombre', 'Estudiante'], ['mision', 'Misión'], ['exito', 'Resultado', (x) => (x ? '✅' : '❌')], ['motivo', 'Causa', (m) => MOTIVOS[m] || ''], ['estrellas', '★'], ['rebobinados', '⏪'], ['fecha', 'Fecha', (f) => (f ? new Date(f).toLocaleString('es-PE') : '')]])}</section>`;
  } catch (err) {
    $('salida').innerHTML = `<div class="aviso peligro">${esc(err.message)}</div>`;
  }
});
