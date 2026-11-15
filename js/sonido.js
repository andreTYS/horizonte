// Sonido de HORIZONTE.
// - Efectos reales: "Oculus Audio Pack 01" (Meta, CC BY 4.0) en assets/sonidos/
// - Música de fondo generada con Web Audio (acordes suaves + caja musical), ruido de tormenta y retumbe del despegue
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

/** Fija el sonido (modo aula: empieza apagado). */
export function fijarSonido(on) {
  if (on !== activo) alternarSonido();
}

export function alternarSonido() {
  activo = !activo;
  try { localStorage.setItem('horizonte.sonido', activo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  if (activo || ctx) iniciar();
  if (maestro) maestro.gain.setTargetAtTime(activo ? 0.6 : 0, ctx.currentTime, 0.1);
  if (!activo) callarVoz();
  return activo;
}

// ── Música de fondo: generada en el navegador, suave y amigable para niños ──
// Acordes suaves, bajo que camina, batería ligera (bombo, palmas y platillo) y melodías cortas de caja musical
// hechas con las notas del acorde (nunca suenan "mal"). De día alegre, de noche tranquila, en tormenta en menor y más rápida.
const NOTA = (n) => 440 * 2 ** ((n - 69) / 12); // número MIDI → Hz
const ANIMOS = {
  // ritmo: 16 pasos (corcheas en 2 compases). k = bombo, s = palmas suaves, h = platillo cerrado
  dia: { bpm: 104, acordes: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], ritmo: 'k.h.s.h.k.hks.h.', bajo: [0, null, 12, null, 7, null, 12, 7, 0, null, 12, null, 7, 5, 4, 2] },
  noche: { bpm: 84, acordes: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]], ritmo: '..h...h...h...h.', bajo: [0, null, null, null, 7, null, null, null, 0, null, null, null, 12, null, 7, null] },
  tormenta: { bpm: 112, acordes: [[57, 60, 64, 69], [53, 57, 60, 65], [50, 53, 57, 62], [52, 56, 59, 64]], ritmo: 'k.hhs.hhk.hks.hh', bajo: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 7, 5, 5] },
};
// Melodías cortas y pegajosas: índices a las notas del acorde (0 = raíz, 1, 2, 3, 4 = raíz una octava arriba). Se alternan.
const MOTIVOS = [
  [0, null, 1, 2, null, 4, null, 2, 3, null, 2, 1, null, 0, null, null],
  [2, null, 2, 3, 4, null, 3, 2, 1, null, 2, null, 0, null, null, null],
  [4, 3, 2, null, 1, null, 2, null, 3, null, 4, 3, 2, null, null, null],
  [0, 1, 2, 4, null, 2, null, 1, 2, null, null, 0, 1, null, null, null],
];
let ruidoBuf = null;

function crearAmbiente() {
  const salida = ctx.createGain();
  salida.gain.value = 0;
  // Eco suave para dar sensación de espacio (sin reverb pesada)
  const eco = ctx.createDelay(1);
  eco.delayTime.value = 0.38;
  const ecoVuelta = ctx.createGain();
  ecoVuelta.gain.value = 0.28;
  const ecoFiltro = ctx.createBiquadFilter();
  ecoFiltro.type = 'lowpass';
  ecoFiltro.frequency.value = 1800;
  eco.connect(ecoFiltro).connect(ecoVuelta).connect(eco);
  ecoFiltro.connect(salida);
  const brillo = ctx.createBiquadFilter(); // quita lo áspero
  brillo.type = 'lowpass';
  brillo.frequency.value = 2600;
  brillo.connect(salida);
  brillo.connect(eco);
  salida.connect(busAmbiente);
  salida.gain.setTargetAtTime(0.9, ctx.currentTime, 2);
  ambiente = { salida, entrada: brillo, seco: salida, animo: 'dia', compas: 0, proximo: ctx.currentTime + 0.3, paso: 0 };
  setInterval(programarMusica, 120);
}

function voz(freq, inicio, dur, { tipo = 'sine', vol = 0.05, ataque = 0.02, armonico = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = tipo;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(vol, inicio + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
  o.connect(g).connect(ambiente.entrada);
  o.start(inicio);
  o.stop(inicio + dur + 0.05);
  if (armonico) { // brillo de campanita (caja musical)
    const o2 = ctx.createOscillator();
    o2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, inicio);
    g2.gain.exponentialRampToValueAtTime(vol * armonico, inicio + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, inicio + dur * 0.4);
    o2.connect(g2).connect(ambiente.entrada);
    o2.start(inicio);
    o2.stop(inicio + dur);
  }
}

function percusion(tipo, t) {
  if (!ruidoBuf) {
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (tipo === 'k') { // bombo suave: seno que baja de tono
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ambiente.seco); o.start(t); o.stop(t + 0.25);
    return;
  }
  const src = ctx.createBufferSource(); src.buffer = ruidoBuf;
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  if (tipo === 'h') { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.045, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); }
  else { f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8; g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); }
  src.connect(f).connect(g).connect(ambiente.seco); src.start(t); src.stop(t + 0.2);
}

/** Programa la música un poco por adelantado (así no se corta aunque la pestaña esté ocupada). */
function programarMusica() {
  if (!ctx || !ambiente || ctx.state !== 'running') return;
  const a = ANIMOS[ambiente.animo];
  const pulso = 60 / a.bpm / 2; // corcheas
  while (ambiente.proximo < ctx.currentTime + 0.6) {
    const t = ambiente.proximo;
    const paso = ambiente.paso % 16; // 16 corcheas = 2 compases por acorde
    const vuelta = Math.floor(ambiente.paso / 16);
    const acorde = a.acordes[vuelta % a.acordes.length];
    if (paso === 0) acorde.slice(0, 3).forEach((n, i) => voz(NOTA(n), t + i * 0.03, pulso * 16 + 0.4, { tipo: 'triangle', vol: 0.016, ataque: 0.6 }));
    // Bajo que camina
    const b = a.bajo[paso];
    if (b != null) voz(NOTA(acorde[0] - 24 + b), t, pulso * 1.6, { tipo: 'triangle', vol: 0.07, ataque: 0.01 });
    // Ritmo (la intro de 1 vuelta va sin batería)
    const golpe = a.ritmo[paso];
    if (golpe !== '.' && vuelta > 0) percusion(golpe, t);
    // Melodía: un motivo por acorde; cada 4 acordes se descansa una vuelta para que no canse
    const frase = Math.floor(vuelta / 4) % 3;
    const motivo = MOTIVOS[(vuelta + frase) % MOTIVOS.length];
    const i = motivo[paso];
    if (i != null && frase !== 2) {
      const notas = [acorde[0], acorde[1], acorde[2], acorde[3] ?? acorde[0] + 12, acorde[0] + 12].map((n) => n + 12);
      voz(NOTA(notas[i]), t, pulso * 2.2, { vol: ambiente.animo === 'noche' ? 0.03 : 0.042, ataque: 0.006, armonico: 0.4 });
    }
    ambiente.paso += 1;
    ambiente.proximo += pulso;
  }
}

/** De noche la música baja y se calma; en tormenta pasa a menor (sin ruido). */
export function ambienteEstado({ noche = false, tormenta = false } = {}) {
  if (!ambiente) return;
  const nuevo = tormenta ? 'tormenta' : noche ? 'noche' : 'dia';
  if (nuevo !== ambiente.animo) {
    ambiente.animo = nuevo;
    ambiente.paso = Math.ceil(ambiente.paso / 16) * 16; // cambia al empezar el siguiente acorde
  }
  ambiente.salida.gain.setTargetAtTime(noche ? 0.7 : 0.9, ctx.currentTime, 1.5);
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
    ruido(2.6, { vol: 0.2, frec: 110, hastaFrec: 500, tipo: 'lowpass', desde: 0.3 });
    tono(70, 2.4, { tipo: 'sine', vol: 0.1, hasta: 140, desde: 0.3 });
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
