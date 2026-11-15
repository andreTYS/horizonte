// Escena isométrica de la base lunar, dibujada en SVG.
// No depende de ninguna librería: recibe el estado del juego y devuelve un <svg>.

const TW = 56; // ancho de una baldosa
const TH = 28; // alto de una baldosa
const N = 9; // la base ocupa una cuadrícula de 9 × 9
const OX = 320;
const OY = 92;

const iso = (x, y, z = 0) => [OX + (x - y) * (TW / 2), OY + (x + y) * (TH / 2) - z];
const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const poli = (pts, attrs) => `<polygon points="${pts.map(pt).join(' ')}" ${attrs}/>`;

// Ruido determinista: la misma baldosa siempre tiene el mismo tono
const ruido = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// Dónde va cada módulo en la cuadrícula
const SLOTS = {
  panel: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]],
  bateria: [[7, 0], [8, 0], [7, 1], [8, 1], [7, 2], [8, 2], [7, 3], [8, 3]],
  habitat: [4, 4],
  reciclador: [1.4, 5.6],
  invernadero: [3.6, 7],
  reactor: [7.6, 7.6],
};

/** Caja isométrica con tres caras visibles. */
function caja(x, y, w, d, h, { top, izq, der }, extra = '', z0 = 0) {
  const A = iso(x, y, z0 + h), B = iso(x + w, y, z0 + h), C = iso(x + w, y + d, z0 + h), D = iso(x, y + d, z0 + h);
  const B0 = iso(x + w, y, z0), C0 = iso(x + w, y + d, z0), D0 = iso(x, y + d, z0);
  return `<g ${extra}>${poli([D0, C0, C, D], `fill="${izq}"`)}${poli([B0, C0, C, B], `fill="${der}"`)}${poli([A, B, C, D], `fill="${top}"`)}</g>`;
}

function suelo(noche) {
  let s = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const r = ruido(x, y);
      const l = noche ? 22 + r * 6 : 52 + r * 10;
      s += poli([iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)],
        `fill="hsl(228 12% ${l}%)" stroke="hsl(228 12% ${l - 4}%)" stroke-width="0.6"`);
    }
  }
  // Bordes del terreno (da volumen a la "isla" de regolito)
  const prof = 26;
  const izq = [iso(0, N), iso(N, N), iso(N, N, -prof), iso(0, N, -prof)];
  const der = [iso(N, 0), iso(N, N), iso(N, N, -prof), iso(N, 0, -prof)];
  s += poli(izq, `fill="${noche ? '#1c2033' : '#4a5068'}"`) + poli(der, `fill="${noche ? '#151829' : '#3a3f55'}"`);
  // Cráteres
  for (const [cx, cy, r] of [[5.6, 1.4, 0.55], [1.2, 7.8, 0.4], [7.9, 5.2, 0.35], [3.3, 2.5, 0.25]]) {
    const [px, py] = iso(cx, cy);
    s += `<ellipse cx="${px}" cy="${py}" rx="${r * TW}" ry="${r * TH}" fill="${noche ? '#191c2c' : '#5b6178'}"/>`;
    s += `<ellipse cx="${px + 2}" cy="${py + 1.5}" rx="${r * TW * 0.8}" ry="${r * TH * 0.75}" fill="${noche ? '#22263a' : '#6d738c'}"/>`;
  }
  return s;
}

function cielo(luz, ancho, alto) {
  let s = `<rect width="${ancho}" height="${alto}" fill="url(#cielo-${luz ? 'dia' : 'noche'})"/>`;
  for (let i = 0; i < 70; i++) {
    const x = ruido(i, 1) * ancho, y = ruido(i, 2) * alto * 0.55, r = ruido(i, 3) * 1.2 + 0.3;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.3 + ruido(i, 4) * 0.7).toFixed(2)}" class="${i % 7 === 0 ? 'titila' : ''}"/>`;
  }
  // La Tierra siempre se ve desde la cara visible de la Luna
  s += `<g transform="translate(96 62)"><circle r="22" fill="#2b6cd6"/><path d="M-14 -8 q8 -6 14 2 t10 10 q-6 8 -14 4 z" fill="#3fa36b"/><path d="M4 -18 q8 4 10 12" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>
    <circle r="22" fill="url(#sombra-tierra)"/></g>`;
  if (luz) s += `<g transform="translate(${ancho - 100} 58)"><circle r="40" fill="url(#halo)"/><circle r="17" fill="#fff6d6"/></g>`;
  return s;
}

function panel(x, y, danado, luz) {
  const post = caja(x + 0.42, y + 0.42, 0.16, 0.16, 12, { top: '#8a90a8', izq: '#6b7088', der: '#555a70' });
  const a = iso(x + 0.06, y + 0.08, 22), b = iso(x + 0.94, y + 0.08, 22), c = iso(x + 0.94, y + 0.92, 10), d = iso(x + 0.06, y + 0.92, 10);
  const relleno = danado ? '#3a2a33' : luz ? 'url(#panel)' : '#1d2b55';
  let lineas = '';
  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    const p1 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], p2 = [d[0] + (c[0] - d[0]) * t, d[1] + (c[1] - d[1]) * t];
    const q1 = [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t], q2 = [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t];
    lineas += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}"/><line x1="${q1[0]}" y1="${q1[1]}" x2="${q2[0]}" y2="${q2[1]}"/>`;
  }
  const grieta = danado ? `<path d="M${pt(a)} L${(a[0] + c[0]) / 2 + 4},${(a[1] + c[1]) / 2} L${pt(c)}" stroke="#f87171" stroke-width="1.6" fill="none"/>` : '';
  return `<g class="mod-panel">${post}${poli([a, b, c, d], `fill="${relleno}" stroke="#c9d4ff" stroke-width="0.8"`)}<g stroke="#9fb4ff" stroke-width="0.5" opacity=".6">${lineas}</g>${grieta}</g>`;
}

function bateria(x, y, carga, apagado) {
  const color = carga > 0.5 ? '#4ade80' : carga > 0.2 ? '#fbbf24' : '#f87171';
  const c = caja(x + 0.18, y + 0.18, 0.64, 0.64, 20, { top: '#d9dcea', izq: '#a3a8bf', der: '#7f849c' });
  const xr = x + 0.82, h = Math.max(1, 15 * carga);
  const barra = poli([iso(xr, y + 0.32, 2), iso(xr, y + 0.5, 2), iso(xr, y + 0.5, 2 + h), iso(xr, y + 0.32, 2 + h)], `fill="${color}"`);
  return `<g class="${apagado ? 'apagado' : ''}">${c}${barra}</g>`;
}

function reactor(x, y, activo) {
  let s = caja(x, y, 1, 1, 34, { top: '#4b5168', izq: '#3a3f55', der: '#2d3246' });
  // Radiadores (paneles que disipan el calor del reactor)
  for (let i = 0; i < 3; i++) s += caja(x + 1.05, y + 0.12 + i * 0.3, 0.55, 0.06, 26, { top: '#e8ecff', izq: '#c3c9e6', der: '#aab1d4' });
  const [cx, cy] = iso(x + 0.5, y + 0.5, 34);
  s += `<ellipse cx="${cx}" cy="${cy}" rx="12" ry="6" fill="${activo ? '#ffb547' : '#555'}" class="${activo ? 'brilla' : ''}"/>`;
  s += `<text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="11" fill="#ffd68a">☢</text>`;
  return `<g>${s}</g>`;
}

function reciclador(x, y, apagado) {
  let s = caja(x, y, 1, 0.8, 18, { top: '#e6f2ff', izq: '#b6cde6', der: '#95afcc' });
  s += caja(x + 0.2, y + 0.2, 0.3, 0.3, 10, { top: '#6fd3ff', izq: '#4bb4e0', der: '#3a98c2' }, '', 18);
  const [cx, cy] = iso(x + 0.5, y + 0.8, 9);
  s += `<text x="${cx - 6}" y="${cy}" font-size="11">💧</text>`;
  return `<g class="${apagado ? 'apagado' : ''}">${s}</g>`;
}

function invernadero(x, y, encendido, apagado) {
  const vidrio = { top: 'rgba(170,240,255,.35)', izq: 'rgba(120,210,240,.35)', der: 'rgba(90,180,220,.35)' };
  let plantas = '';
  for (let i = 0; i < 6; i++) {
    const [px, py] = iso(x + 0.35 + (i % 3) * 0.65, y + 0.3 + Math.floor(i / 3) * 0.45, 6);
    plantas += `<circle cx="${px}" cy="${py}" r="5" fill="${encendido ? '#3fbf6b' : '#5d7a5f'}"/><circle cx="${px + 3}" cy="${py - 3}" r="3.5" fill="${encendido ? '#5fe08a' : '#6d8a6f'}"/>`;
  }
  const base = caja(x, y, 2.2, 1, 4, { top: '#7a6a55', izq: '#5e5142', der: '#4d4236' });
  const luz = encendido ? `<ellipse cx="${iso(x + 1.1, y + 0.5, 12)[0]}" cy="${iso(x + 1.1, y + 0.5, 12)[1]}" rx="40" ry="16" fill="#ff5fd2" opacity=".28" class="brilla"/>` : '';
  return `<g class="${apagado ? 'apagado' : ''}">${base}${plantas}${luz}${caja(x, y, 2.2, 1, 22, vidrio, '', 4)}</g>`;
}

function habitat(blindaje, luz, refugio, apagado) {
  const [cx, cy] = iso(5, 5);
  const rx = TW * 1.05, ry = TH * 1.05, h = 30;
  let s = '';
  // Cuerpo cilíndrico y cúpula
  s += `<path d="M${cx - rx},${cy} v${-h} a${rx},${ry} 0 0,0 ${rx * 2},0 v${h} a${rx},${ry} 0 0,1 ${-rx * 2},0z" fill="url(#casco)"/>`;
  s += `<path d="M${cx - rx},${cy - h} a${rx},${rx * 0.95} 0 0,1 ${rx * 2},0 a${rx},${ry} 0 0,1 ${-rx * 2},0z" fill="url(#cupula)"/>`;
  s += `<ellipse cx="${cx}" cy="${cy - h}" rx="${rx}" ry="${ry}" fill="none" stroke="#c7cde8" stroke-width="1"/>`;
  // Ventanas: de noche brillan
  for (const dx of [-30, -10, 10, 30]) {
    s += `<rect x="${cx + dx - 5}" y="${cy - h + 8 + Math.abs(dx) * 0.12}" width="10" height="9" rx="3" fill="${luz ? '#2b3d73' : '#ffd36b'}" ${luz ? '' : 'class="brilla"'}/>`;
  }
  // Escotilla y antena
  s += `<rect x="${cx - 8}" y="${cy - 16}" width="16" height="18" rx="3" fill="#8b91ab"/>`;
  s += `<line x1="${cx + 20}" y1="${cy - h - 40}" x2="${cx + 20}" y2="${cy - h - 66}" stroke="#c7cde8" stroke-width="2"/><circle cx="${cx + 20}" cy="${cy - h - 68}" r="3" fill="#f87171" class="titila"/>`;
  // Blindaje de regolito (sacos apilados alrededor)
  if (blindaje > 0) {
    const alto = blindaje === 1 ? 9 : 18;
    s += `<path d="M${cx - rx - 10},${cy + 2} q0,${-alto} 12,${-alto - 4} h${rx * 2 - 4} q12,4 12,${alto + 4} a${rx + 10},${ry + 6} 0 0,1 ${-(rx + 10) * 2},0z" fill="url(#regolito)" stroke="#6d6450" stroke-width="1"/>`;
    for (let i = 0; i < 7; i++) s += `<ellipse cx="${cx - rx + 4 + i * (rx * 2 - 8) / 6}" cy="${cy - alto + 6 + Math.sin(i) * 2}" rx="8" ry="4" fill="#8c8068" opacity=".8"/>`;
  }
  if (refugio) s += `<ellipse cx="${cx}" cy="${cy - 30}" rx="${rx + 26}" ry="${rx + 10}" fill="url(#escudo)" stroke="#6fd3ff" stroke-width="2" class="pulso"/>`;
  return `<g class="${apagado ? 'apagado' : ''}">${s}</g>`;
}

function astronautas(n) {
  let s = '';
  const pos = [[6.4, 5.6], [3.2, 4.4], [6.2, 3.4], [2.8, 6.2]];
  for (let i = 0; i < Math.min(n, 4); i++) {
    const [x, y] = iso(...pos[i]);
    s += `<g transform="translate(${x} ${y})" class="camina" style="animation-delay:${i * 0.4}s">
      <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="#000" opacity=".25"/>
      <rect x="-4" y="-14" width="8" height="10" rx="3" fill="#f2f4ff"/>
      <circle cx="0" cy="-18" r="5" fill="#f2f4ff"/><rect x="-3" y="-20" width="6" height="3.5" rx="1.5" fill="#ffb547"/>
      <rect x="-6" y="-13" width="3" height="7" rx="1" fill="#c9cde0"/></g>`;
  }
  return s;
}

function cables(c) {
  const [hx, hy] = iso(5, 5, 2);
  let s = '';
  const linea = (x, y) => { const [px, py] = iso(x, y, 2); s += `<path d="M${px},${py} Q${(px + hx) / 2},${Math.max(py, hy) + 14} ${hx},${hy}" />`; };
  if (c.panel) linea(2.5, 2);
  if (c.bateria) linea(7.4, 2.4);
  if (c.reactor) linea(7.6, 7.8);
  return `<g stroke="#ffb547" stroke-width="1.4" fill="none" stroke-dasharray="4 4" opacity=".55" class="flujo">${s}</g>`;
}

function tormenta(ancho, alto) {
  let s = `<rect width="${ancho}" height="${alto}" fill="#ff7a3d" opacity=".12" class="pulso"/>`;
  for (let i = 0; i < 40; i++) {
    const x = ruido(i, 9) * (ancho + 200) - 100, y = ruido(i, 8) * alto;
    s += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 14).toFixed(0)}" y2="${(y + 22).toFixed(0)}" stroke="${i % 3 ? '#ffd166' : '#ff7a3d'}" stroke-width="1.6" class="particula" style="animation-delay:${(ruido(i, 7) * 1.2).toFixed(2)}s"/>`;
  }
  return `<g>${s}</g>`;
}

function etiqueta(x, y, z, texto) {
  const [px, py] = iso(x, y, z);
  return `<g class="etiqueta"><rect x="${px - texto.length * 3.3 - 6}" y="${py - 22}" width="${texto.length * 6.6 + 12}" height="17" rx="8.5" fill="rgba(11,16,38,.82)" stroke="#6fd3ff" stroke-width=".8"/><text x="${px}" y="${py - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="#eef1ff" font-family="system-ui, sans-serif">${texto}</text></g>`;
}

/**
 * @param {object} o
 * @param {object} o.config      diseño de la base
 * @param {boolean} o.luz        ¿hay Sol?
 * @param {number} [o.carga]     0–1, carga de baterías
 * @param {number} [o.danados]   paneles dañados
 * @param {string[]} [o.apagados] sistemas apagados hoy
 * @param {boolean} [o.tormenta] ¿hay tormenta solar?
 * @param {boolean} [o.refugio]  ¿tripulación en el refugio?
 * @param {number} [o.tripulacion]
 * @param {boolean} [o.etiquetas] mostrar nombres de los módulos (pantalla de diseño)
 */
export function escena(o) {
  const c = o.config;
  const ancho = 640, alto = 400;
  const apag = (id) => (o.apagados || []).some((a) => a.startsWith(id));
  const objetos = [];
  const add = (x, y, svg) => objetos.push({ k: x + y, svg });

  const nPaneles = Math.min(c.panel, SLOTS.panel.length);
  for (let i = 0; i < nPaneles; i++) add(SLOTS.panel[i][0], SLOTS.panel[i][1], panel(...SLOTS.panel[i], i < (o.danados || 0), o.luz));
  const nBat = Math.min(c.bateria, SLOTS.bateria.length);
  for (let i = 0; i < nBat; i++) add(SLOTS.bateria[i][0], SLOTS.bateria[i][1], bateria(...SLOTS.bateria[i], o.carga ?? 1, false));
  if (c.reciclador) add(...SLOTS.reciclador, reciclador(...SLOTS.reciclador, apag('reciclador')));
  if (c.invernadero) add(SLOTS.invernadero[0] + 1, SLOTS.invernadero[1], invernadero(...SLOTS.invernadero, o.invernaderoOn !== false && !apag('invernadero'), apag('invernadero')));
  if (c.reactor) add(SLOTS.reactor[0] + 0.5, SLOTS.reactor[1] + 0.5, reactor(...SLOTS.reactor, true));
  add(5, 5, habitat(c.blindaje, o.luz, o.refugio, apag('soporte') || apag('electrolizador')));
  objetos.sort((a, b) => a.k - b.k);

  let etiquetas = '';
  if (o.etiquetas) {
    if (nPaneles) etiquetas += etiqueta(1.5, 1.5, 30, `Paneles ×${c.panel}`);
    if (nBat) etiquetas += etiqueta(7.9, 1.9, 34, `Baterías ×${c.bateria}`);
    if (c.reactor) etiquetas += etiqueta(8.1, 8.1, 52, 'Reactor');
    if (c.reciclador) etiquetas += etiqueta(1.9, 6, 30, 'Reciclador');
    if (c.invernadero) etiquetas += etiqueta(4.7, 7.5, 36, 'Invernadero');
    etiquetas += etiqueta(5, 5, 78, 'Hábitat');
  }
  const extra = c.panel > SLOTS.panel.length ? etiqueta(1.5, 3.6, 4, `+${c.panel - SLOTS.panel.length} paneles`) : '';

  return `<svg class="escena ${o.luz ? 'dia' : 'noche'}" viewBox="44 22 552 352" role="img" aria-label="${o.planeta === 'marte' ? `Vista de la base en Marte${o.luz ? ' con luz solar' : ' de noche'}` : `Vista de la base lunar${o.luz ? ' con luz solar' : ' durante la noche lunar'}`}">
  <defs>
    <linearGradient id="cielo-dia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05081a"/><stop offset="1" stop-color="#1b2450"/></linearGradient>
    <linearGradient id="cielo-noche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02030b"/><stop offset="1" stop-color="#0b1026"/></linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#fff2c2"/><stop offset=".35" stop-color="#ffb547" stop-opacity=".55"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></radialGradient>
    <radialGradient id="sombra-tierra" cx=".75" cy=".3" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#1f3fa8"/></linearGradient>
    <linearGradient id="casco" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9cee6"/><stop offset=".5" stop-color="#eef1ff"/><stop offset="1" stop-color="#9aa1c2"/></linearGradient>
    <linearGradient id="cupula" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9c0de"/></linearGradient>
    <linearGradient id="regolito" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a39778"/><stop offset="1" stop-color="#6d6450"/></linearGradient>
    <radialGradient id="escudo"><stop offset=".6" stop-color="#6fd3ff" stop-opacity=".05"/><stop offset="1" stop-color="#6fd3ff" stop-opacity=".35"/></radialGradient>
  </defs>
  ${cielo(o.luz, ancho, alto)}
  ${suelo(!o.luz)}
  ${cables(c)}
  ${objetos.map((x) => x.svg).join('')}
  ${o.refugio ? '' : astronautas(o.tripulacion || 0)}
  ${o.tormenta ? tormenta(ancho, alto) : ''}
  ${etiquetas}${extra}
</svg>`;
}
