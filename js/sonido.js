// Sonido de HORIZONTE.
// - Efectos reales: "Oculus Audio Pack 01" (Meta, CC BY 4.0) en assets/sonidos/
// - Capas generadas con Web Audio (zumbido espacial, ruido de tormenta, retumbe del despegue)
// - Voz de Nebula (archivos generados con Piper TTS), con el ambiente bajando mientras habla
// El audio arranca con el primer toque del jugador (regla de los navegadores).

let ctx = null;
let maestro = null;
let busAmbiente = null;
let ambiente = null;
const muestras = {};
let activo = (() => { try { return localStorage.getItem('horizonte.sonido') !== 'no'; } catch { return true; } })();
let vozActual = null;

export const sonidoActivo = () => activo;
export const contexto = () => ctx;

const ARCHIVOS = ['clic', 'abrir', 'atras', 'modulo', 'interruptor', 'alarma', 'aviso', 'exito', 'falla', 'impacto', 'tormenta', 'despegue', 'rebobinar', 'habitat', 'hidraulica'];

async function cargarMuestras() {
  await Promise.all(ARCHIVOS.map(async (n) => {
    try {
      const r = await fetch(`assets/sonidos/${n}.mp3`);
      if (r.ok) muestras[n] = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch { /* sin ese archivo: se usa el sonido generado */ }
  }));
  if (muestras.habitat && ambiente) iniciarZumbidoHabitat();
}

function iniciar() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  maestro = ctx.createGain();
  maestro.gain.value = activo ? 0.6 : 0;
  const comp = ctx.createDynamicsCompressor();
  maestro.connect(comp).connect(ctx.destination);
  busAmbiente = ctx.createGain();
  busAmbiente.gain.value = 1;
  busAmbiente.connect(maestro);
  crearAmbiente();
  cargarMuestras();
}

export function alternarSonido() {
  activo = !activo;
  try { localStorage.setItem('horizonte.sonido', activo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  iniciar();
  if (maestro) maestro.gain.setTargetAtTime(activo ? 0.6 : 0, ctx.currentTime, 0.1);
  if (!activo) callarVoz();
  return activo;
}

// ── Ambiente: zumbido espacial generado + sonido real de la sala de máquinas del hábitat ──
function crearAmbiente() {
  const salida = ctx.createGain();
  salida.gain.value = 0;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 420;
  filtro.Q.value = 6;
  const lfo = ctx.createOscillator();
  const lfoGan = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGan.gain.value = 180;
  lfo.connect(lfoGan).connect(filtro.frequency);
  const oscs = [55, 55.4, 82.5].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 2 ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i === 2 ? 0.05 : 0.08;
    o.connect(g).connect(filtro);
    o.start();
    return o;
  });
  filtro.connect(salida).connect(busAmbiente);
  lfo.start();
  salida.gain.setTargetAtTime(0.28, ctx.currentTime, 2);
  ambiente = { salida, filtro, oscs };
}

function iniciarZumbidoHabitat() {
  const src = ctx.createBufferSource();
  src.buffer = muestras.habitat;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(g).connect(busAmbiente);
  src.start();
  g.gain.setTargetAtTime(0.16, ctx.currentTime, 3);
  ambiente.habitat = g;
}

/** De noche el ambiente baja de tono; en tormenta se vuelve más tenso. */
export function ambienteEstado({ noche = false, tormenta = false } = {}) {
  if (!ambiente) return;
  const t = ctx.currentTime;
  const base = noche ? 0.8 : 1;
  ambiente.oscs.forEach((o, i) => o.frequency.setTargetAtTime([55, 55.4, 82.5][i] * base * (tormenta ? 1.06 : 1), t, 1.5));
  ambiente.filtro.Q.setTargetAtTime(tormenta ? 12 : 6, t, 0.8);
  ambiente.habitat?.gain.setTargetAtTime(noche ? 0.22 : 0.16, t, 1.5);
}

// ── Utilidades ──
function muestra(nombre, { vol = 1, velocidad = 1, desde = 0 } = {}) {
  if (!ctx || !activo || !muestras[nombre]) return false;
  const src = ctx.createBufferSource();
  src.buffer = muestras[nombre];
  src.playbackRate.value = velocidad;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(maestro);
  src.start(ctx.currentTime + desde);
  return true;
}

function tono(freq, dur, { tipo = 'sine', vol = 0.25, desde = 0, hasta = null, ataque = 0.005 } = {}) {
  if (!ctx || !activo) return;
  const t = ctx.currentTime + desde;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(freq, t);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(maestro);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function ruido(dur, { vol = 0.2, desde = 0, frec = 800, hastaFrec = null, tipo = 'bandpass' } = {}) {
  if (!ctx || !activo) return;
  const t = ctx.currentTime + desde;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = tipo;
  f.frequency.setValueAtTime(frec, t);
  if (hastaFrec) f.frequency.exponentialRampToValueAtTime(hastaFrec, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(maestro);
  src.start(t);
}

// ── Efectos del juego (muestra real si está cargada; si no, sonido generado) ──
export const sfx = {
  clic: () => muestra('clic', { vol: 0.35 }) || tono(1400, 0.05, { tipo: 'square', vol: 0.05 }),
  abrir: () => muestra('abrir', { vol: 0.5 }) || tono(900, 0.08, { vol: 0.08, hasta: 1300 }),
  paso: () => muestra('aviso', { vol: 0.35, velocidad: 1.2 }) || (tono(660, 0.08, { vol: 0.08 }), tono(990, 0.1, { vol: 0.06, desde: 0.06 })),
  modulo: () => { if (!muestra('modulo', { vol: 0.55 })) tono(520, 0.12, { tipo: 'triangle', vol: 0.12, hasta: 880 }); muestra('interruptor', { vol: 0.5, desde: 0.05 }); },
  alarma: () => {
    if (!muestra('alarma', { vol: 0.6 })) tono(880, 0.14, { tipo: 'square', vol: 0.08 });
    muestra('alarma', { vol: 0.5, desde: 0.35 });
    muestra('alarma', { vol: 0.4, desde: 0.7 });
  },
  aviso: () => muestra('aviso', { vol: 0.55 }) || tono(1046, 0.2, { vol: 0.1 }),
  tormenta: () => { muestra('tormenta', { vol: 0.7 }); muestra('alarma', { vol: 0.5 }); ruido(2.2, { vol: 0.22, frec: 300, hastaFrec: 3000 }); },
  polvo: () => { muestra('tormenta', { vol: 0.5, velocidad: 0.8 }); ruido(3, { vol: 0.25, frec: 500, hastaFrec: 160, tipo: 'lowpass' }); },
  despegue: () => {
    muestra('hidraulica', { vol: 0.5 });
    ruido(2.6, { vol: 0.32, frec: 120, hastaFrec: 900, tipo: 'lowpass', desde: 0.3 });
    tono(55, 2.4, { tipo: 'sawtooth', vol: 0.09, hasta: 170, desde: 0.3 });
    muestra('despegue', { vol: 0.7, velocidad: 0.7, desde: 0.9 });
  },
  rebobinar: () => { muestra('rebobinar', { vol: 0.7, velocidad: 0.8 }); tono(1200, 0.45, { tipo: 'triangle', vol: 0.1, hasta: 180 }); },
  exito: () => { if (!muestra('exito', { vol: 0.75 })) [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.35, { tipo: 'triangle', vol: 0.14, desde: i * 0.12 })); },
  falla: () => { muestra('impacto', { vol: 0.6 }); if (!muestra('falla', { vol: 0.6, desde: 0.1 })) [392, 330, 262, 196].forEach((f, i) => tono(f, 0.4, { tipo: 'sawtooth', vol: 0.07, desde: i * 0.18 })); },
};

// ── Voz de Nebula ──
const cacheVoz = new Map();
export function callarVoz() {
  document.body.classList.remove('nebula-habla');
  try { vozActual?.stop(); } catch { /* ya terminó */ }
  vozActual = null;
  if (busAmbiente) busAmbiente.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
}

/** Reproduce un archivo de voz. Devuelve false si no se pudo (para usar la voz del navegador). */
export async function reproducirVoz(url) {
  if (!activo) return true;
  iniciar();
  if (!ctx) return false;
  try {
    let buf = cacheVoz.get(url);
    if (!buf) {
      const r = await fetch(url);
      if (!r.ok) return false;
      buf = await ctx.decodeAudioData(await r.arrayBuffer());
      cacheVoz.set(url, buf);
    }
    callarVoz();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 1.15;
    src.connect(g).connect(maestro);
    busAmbiente.gain.setTargetAtTime(0.35, ctx.currentTime, 0.15); // el ambiente baja mientras Nebula habla
    src.onended = () => { if (vozActual === src) callarVoz(); };
    src.start();
    vozActual = src;
    document.body.classList.add('nebula-habla');
    return true;
  } catch {
    return false;
  }
}

// El primer toque del jugador enciende el audio; cada botón hace un clic.
document.addEventListener('pointerdown', (ev) => {
  iniciar();
  if (ev.target.closest('button')) sfx.clic();
}, { passive: true });
document.addEventListener('keydown', () => iniciar(), { once: true });
