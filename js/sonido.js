// Sonido de HORIZONTE generado en el navegador (Web Audio): sin archivos, pesa 0 KB.
// El audio arranca con el primer toque del jugador (regla de los navegadores).

let ctx = null;
let maestro = null;
let ambiente = null;
let activo = (() => { try { return localStorage.getItem('horizonte.sonido') !== 'no'; } catch { return true; } })();

export const sonidoActivo = () => activo;

function iniciar() {
  if (ctx) return ctx.state === 'suspended' ? ctx.resume() : undefined;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  maestro = ctx.createGain();
  maestro.gain.value = activo ? 0.5 : 0;
  const comp = ctx.createDynamicsCompressor();
  maestro.connect(comp).connect(ctx.destination);
  crearAmbiente();
}

export function alternarSonido() {
  activo = !activo;
  try { localStorage.setItem('horizonte.sonido', activo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  iniciar();
  if (maestro) maestro.gain.setTargetAtTime(activo ? 0.5 : 0, ctx.currentTime, 0.1);
  return activo;
}

// Zumbido espacial de fondo: dos osciladores graves desafinados + filtro que "respira"
function crearAmbiente() {
  const salida = ctx.createGain();
  salida.gain.value = 0.0;
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
  filtro.connect(salida).connect(maestro);
  lfo.start();
  salida.gain.setTargetAtTime(0.35, ctx.currentTime, 2);
  ambiente = { salida, filtro, oscs };
}

/** De noche el ambiente baja de tono y se oscurece; en tormenta se vuelve más tenso. */
export function ambienteEstado({ noche = false, tormenta = false } = {}) {
  if (!ambiente) return;
  const t = ctx.currentTime;
  const base = noche ? 0.8 : 1;
  ambiente.oscs.forEach((o, i) => o.frequency.setTargetAtTime([55, 55.4, 82.5][i] * base * (tormenta ? 1.06 : 1), t, 1.5));
  ambiente.filtro.Q.setTargetAtTime(tormenta ? 12 : 6, t, 0.8);
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

export const sfx = {
  clic: () => tono(1400, 0.05, { tipo: 'square', vol: 0.05 }),
  paso: () => { tono(660, 0.08, { vol: 0.08 }); tono(990, 0.1, { vol: 0.06, desde: 0.06 }); },
  modulo: () => { tono(520, 0.12, { tipo: 'triangle', vol: 0.12, hasta: 880 }); },
  alarma: () => { for (let i = 0; i < 3; i++) { tono(880, 0.14, { tipo: 'square', vol: 0.08, desde: i * 0.3 }); tono(660, 0.14, { tipo: 'square', vol: 0.08, desde: i * 0.3 + 0.15 }); } },
  tormenta: () => { ruido(2.2, { vol: 0.25, frec: 300, hastaFrec: 3000 }); tono(110, 1.6, { tipo: 'sawtooth', vol: 0.06, hasta: 70 }); },
  polvo: () => ruido(2.8, { vol: 0.22, frec: 500, hastaFrec: 180, tipo: 'lowpass' }),
  despegue: () => { ruido(2.4, { vol: 0.3, frec: 120, hastaFrec: 900, tipo: 'lowpass' }); tono(60, 2.2, { tipo: 'sawtooth', vol: 0.08, hasta: 160 }); },
  rebobinar: () => tono(1200, 0.45, { tipo: 'triangle', vol: 0.12, hasta: 180 }),
  exito: () => [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.35, { tipo: 'triangle', vol: 0.14, desde: i * 0.12 })),
  falla: () => [392, 330, 262, 196].forEach((f, i) => tono(f, 0.4, { tipo: 'sawtooth', vol: 0.07, desde: i * 0.18 })),
};

// El primer toque del jugador enciende el audio; cada botón hace un clic suave.
document.addEventListener('pointerdown', (ev) => {
  iniciar();
  if (ev.target.closest('button')) sfx.clic();
}, { passive: true });
document.addEventListener('keydown', () => iniciar(), { once: true });
