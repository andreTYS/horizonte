// Astronauta de ASU STELLAR · Horizonte, hecho con piezas simples pero con detalle:
// casco con visor y anillo de cuello, mochila de soporte vital, panel de control en el pecho, brazos y piernas
// articulados (caminan), guantes, botas, parche en el hombro y accesorios que se ganan con créditos.
// Se usa en el mapa (con la tripulación) y, en grande, en la pantalla para personalizarla.
import * as THREE from 'three';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
const nombrado = (m, name) => Object.assign(m, { name });
function malla(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// ── Parches: se dibujan en un canvas (sin imágenes externas) ──
const PARCHES = {
  'parche-peru': (x) => { x.fillStyle = '#d91023'; x.fillRect(0, 0, 43, 128); x.fillRect(85, 0, 43, 128); x.fillStyle = '#fff'; x.fillRect(43, 0, 42, 128); },
  'parche-stellar': (x) => { fondo(x, '#18203f'); estrella(x, 64, 62, 40, 17, '#ffc94a'); texto(x, 'STELLAR', 64, 112, '#5cc8ee', 15); },
  'parche-inti': (x) => {
    fondo(x, '#5b54c4');
    x.strokeStyle = '#ffc94a'; x.lineWidth = 7;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.beginPath(); x.moveTo(64 + Math.cos(a) * 30, 60 + Math.sin(a) * 30); x.lineTo(64 + Math.cos(a) * 48, 60 + Math.sin(a) * 48); x.stroke(); }
    x.fillStyle = '#ffc94a'; x.beginPath(); x.arc(64, 60, 26, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#18203f'; x.beginPath(); x.arc(55, 55, 4, 0, 7); x.arc(73, 55, 4, 0, 7); x.fill();
    x.strokeStyle = '#18203f'; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 10, 0.2, Math.PI - 0.2); x.stroke();
  },
  'parche-condor': (x) => {
    fondo(x, '#5cc8ee');
    x.fillStyle = '#18203f';
    x.beginPath(); x.moveTo(64, 58); x.quadraticCurveTo(30, 30, 6, 52); x.quadraticCurveTo(34, 52, 50, 70); x.lineTo(78, 70); x.quadraticCurveTo(94, 52, 122, 52); x.quadraticCurveTo(98, 30, 64, 58); x.fill();
    x.fillStyle = '#f5f6ff'; x.beginPath(); x.ellipse(64, 60, 7, 5, 0, 0, 7); x.fill();
    texto(x, 'KUNTUR', 64, 108, '#18203f', 16);
  },
  'parche-llama': (x) => {
    fondo(x, '#6fd39a');
    x.fillStyle = '#f5f6ff';
    x.fillRect(40, 58, 46, 24); x.fillRect(74, 28, 12, 34); x.fillRect(74, 22, 20, 12); x.fillRect(76, 14, 5, 10); x.fillRect(85, 14, 5, 10);
    for (const px of [42, 52, 70, 80]) x.fillRect(px, 80, 6, 18);
    x.fillStyle = '#e77fb3'; x.fillRect(44, 56, 30, 8);
    texto(x, 'LLAMA', 64, 116, '#18203f', 15);
  },
  'parche-moquegua': (x) => { fondo(x, '#ff9a52'); texto(x, 'MOQUEGUA', 64, 58, '#18203f', 17); texto(x, 'PERÚ', 64, 84, '#18203f', 20); },
};
function fondo(x, c) { x.fillStyle = c; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#f5f6ff'; x.lineWidth = 6; x.stroke(); }
function texto(x, s, cx, cy, c, tam) { x.fillStyle = c; x.font = `800 ${tam}px "Baloo 2", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, cx, cy); }
function estrella(x, cx, cy, r1, r2, c) {
  x.fillStyle = c; x.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  x.fill();
}
// Relieve de tela acolchada para el traje (costuras horizontales y algo de ruido)
let relieveTela = null;
function texturaTela() {
  if (relieveTela) return relieveTela;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { const v = 110 + Math.random() * 40; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  for (let y = 0; y < 128; y += 16) { x.fillStyle = '#3a3a3a'; x.fillRect(0, y, 128, 2); x.fillStyle = '#b0b0b0'; x.fillRect(0, y + 2, 128, 2); }
  relieveTela = new THREE.CanvasTexture(c);
  relieveTela.wrapS = relieveTela.wrapT = THREE.RepeatWrapping;
  relieveTela.repeat.set(2, 3);
  return relieveTela;
}
const cacheParches = new Map();
export function texturaParche(id) {
  if (cacheParches.has(id)) return cacheParches.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  (PARCHES[id] || PARCHES['parche-peru'])(x);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheParches.set(id, t);
  return t;
}

// ── Accesorios ──
function accesorios(acento) {
  const g = new THREE.Group();
  g.name = 'accesorios';
  const metal = std(0xc9ced8, { metalness: 0.7, roughness: 0.3 });
  // Antena de comunicaciones en el casco
  const antena = new THREE.Group(); antena.name = 'acc-antena';
  antena.add(malla(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), metal, 0.16, 1.82, -0.05));
  antena.add(malla(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff7a7a, emissive: 0xff7a7a, emissiveIntensity: 1.5 }), 0.16, 1.99, -0.05));
  // Luces del casco
  const luces = new THREE.Group(); luces.name = 'acc-luces';
  for (const s of [-1, 1]) {
    luces.add(malla(new THREE.BoxGeometry(0.07, 0.06, 0.08), metal, s * 0.2, 1.62, 0.12));
    luces.add(malla(new THREE.CircleGeometry(0.025, 12), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff3d6, emissiveIntensity: 2.5 }), s * 0.2, 1.62, 0.162));
  }
  // Mochila cohete (jetpack)
  const jet = new THREE.Group(); jet.name = 'acc-jetpack';
  for (const s of [-1, 1]) {
    jet.add(malla(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 14), std(0xe6e9fb), s * 0.13, 1.08, -0.36));
    jet.add(malla(new THREE.ConeGeometry(0.075, 0.12, 14), acento, s * 0.13, 1.35, -0.36));
    const llama = malla(new THREE.ConeGeometry(0.05, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xff9a52, emissiveIntensity: 2 }), s * 0.13, 0.78, -0.36);
    llama.rotation.x = Math.PI; jet.add(llama);
  }
  // Bufanda andina (franjas de colores)
  const bufanda = new THREE.Group(); bufanda.name = 'acc-bufanda';
  ['#e77fb3', '#ffc94a', '#5cc8ee', '#6fd39a'].forEach((c, i) => {
    const anillo = malla(new THREE.TorusGeometry(0.205, 0.022, 8, 24), std(c, { roughness: 0.9 }), 0, 1.3 - i * 0.035, 0);
    anillo.rotation.x = Math.PI / 2; bufanda.add(anillo);
  });
  const punta = malla(new THREE.BoxGeometry(0.08, 0.26, 0.03), std(0xe77fb3, { roughness: 0.9 }), 0.1, 1.12, 0.2); punta.rotation.z = 0.2; bufanda.add(punta);
  // Orejas de llama en el casco
  const orejas = new THREE.Group(); orejas.name = 'acc-orejas';
  for (const s of [-1, 1]) { const o = malla(new THREE.ConeGeometry(0.05, 0.2, 10), std(0xf0e6d6, { roughness: 0.9 }), s * 0.13, 1.88, 0); o.rotation.z = -s * 0.35; orejas.add(o); }
  // Gorra de capitán (visera sobre el casco)
  const gorra = new THREE.Group(); gorra.name = 'acc-capitan';
  gorra.add(malla(new THREE.CylinderGeometry(0.2, 0.25, 0.1, 20), std(0x29335e), 0, 1.86, 0));
  gorra.add(malla(new THREE.BoxGeometry(0.22, 0.02, 0.14), std(0x18203f), 0, 1.82, 0.2));
  gorra.add(malla(new THREE.SphereGeometry(0.035, 10, 8), std(0xffc94a, { metalness: 0.6 }), 0, 1.88, 0.2));
  g.add(antena, luces, jet, bufanda, orejas, gorra);
  g.children.forEach((c) => { c.visible = false; });
  return g;
}

/** Crea un astronauta. Materiales con nombre: traje, blanco (piezas claras), naranja (acento), oro (visor), parche. */
export function crearAstronauta() {
  const g = new THREE.Group();
  g.name = 'astronauta';
  const tela = texturaTela();
  const traje = nombrado(new THREE.MeshPhysicalMaterial({ color: 0xeef0f6, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.8, sheenColor: 0xffffff, bumpMap: tela, bumpScale: 1.2 }), 'traje');
  const claro = nombrado(new THREE.MeshPhysicalMaterial({ color: 0xf8f9fc, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }), 'blanco');
  const acento = nombrado(std(0xff9a52, { roughness: 0.5 }), 'naranja');
  const visorMat = nombrado(new THREE.MeshPhysicalMaterial({ color: 0xd9a540, metalness: 0.9, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xd9a540, emissiveIntensity: 0.08, envMapIntensity: 1.6 }), 'oro');
  const vidrio = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.18, clearcoat: 1, envMapIntensity: 2, depthWrite: false });
  const oscuro = std(0x3a3f52, { roughness: 0.8 });
  const metal = std(0xc9ced8, { metalness: 0.75, roughness: 0.3 });

  // Torso y cadera
  const torso = malla(new THREE.CapsuleGeometry(0.26, 0.36, 6, 16), traje, 0, 1.05, 0); torso.scale.set(1.08, 1, 0.82);
  const cadera = malla(new THREE.CylinderGeometry(0.24, 0.22, 0.14, 16), claro, 0, 0.74, 0);
  const cinto = malla(new THREE.TorusGeometry(0.245, 0.035, 8, 24), acento, 0, 0.8, 0); cinto.rotation.x = Math.PI / 2;
  // Panel de control en el pecho, con botones que brillan
  const panel = malla(new THREE.BoxGeometry(0.22, 0.14, 0.06), claro, 0, 1.08, 0.22);
  const botones = [[0x6fd39a, -0.06], [0xffc94a, 0], [0xff7a7a, 0.06]].map(([c, x]) => malla(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 }), x, 1.09, 0.255));
  botones.forEach((b) => { b.rotation.x = Math.PI / 2; });
  // Mochila de soporte vital (PLSS)
  const mochila = malla(new THREE.BoxGeometry(0.46, 0.56, 0.22), claro, 0, 1.08, -0.27);
  const tapa = malla(new THREE.BoxGeometry(0.4, 0.08, 0.23), acento, 0, 1.32, -0.27);
  const tubo = malla(new THREE.TorusGeometry(0.12, 0.022, 8, 16, Math.PI), oscuro, 0.2, 1.1, -0.08); tubo.rotation.y = Math.PI / 2;
  // Casco: anillo de cuello, burbuja, visor
  const cuello = malla(new THREE.TorusGeometry(0.17, 0.04, 10, 24), metal, 0, 1.4, 0); cuello.rotation.x = Math.PI / 2;
  const casco = malla(new THREE.SphereGeometry(0.27, 28, 20), claro, 0, 1.62, 0);
  const visor = malla(new THREE.SphereGeometry(0.24, 28, 16, Math.PI * 0.08, Math.PI * 0.84, 0.62, 1.15), visorMat, 0, 1.62, 0.05);
  const marco = malla(new THREE.TorusGeometry(0.19, 0.018, 8, 28), acento, 0, 1.6, 0.19);
  const reflejo = malla(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), -0.08, 1.7, 0.25); reflejo.scale.set(1, 0.55, 0.3); reflejo.castShadow = false;
  const burbuja = malla(new THREE.SphereGeometry(0.29, 32, 24, Math.PI * 0.05, Math.PI * 0.9, 0.35, 1.5), vidrio, 0, 1.62, 0.015); burbuja.castShadow = false;
  // Mangueras de la mochila al panel del pecho, placa con nombre y rejillas de la mochila
  for (const sx of [-1, 1]) {
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.2, 1.25, -0.2), new THREE.Vector3(sx * 0.3, 1.12, 0.05), new THREE.Vector3(sx * 0.13, 1.02, 0.24)]);
    g.add(malla(new THREE.TubeGeometry(curva, 16, 0.018, 8), new THREE.MeshStandardMaterial({ color: sx < 0 ? 0x5cc8ee : 0xff7a7a, roughness: 0.5 })));
  }
  const placa = malla(new THREE.BoxGeometry(0.12, 0.035, 0.01), std(0x29335e), 0.12, 1.22, 0.215); placa.rotation.y = 0.1;
  for (let i = 0; i < 4; i++) g.add(malla(new THREE.BoxGeometry(0.3, 0.015, 0.02), oscuro, 0, 0.92 + i * 0.05, -0.385));
  g.add(torso, cadera, cinto, panel, ...botones, mochila, tapa, tubo, cuello, casco, visor, burbuja, reflejo, placa);

  // Brazos (hombro → codo → guante), articulados para caminar
  for (const s of [-1, 1]) {
    const hombro = new THREE.Group(); hombro.name = s < 0 ? 'brazo-i' : 'brazo-d';
    hombro.position.set(s * 0.33, 1.24, 0);
    hombro.add(malla(new THREE.SphereGeometry(0.095, 14, 10), traje));
    const sup = malla(new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), traje, 0, -0.16, 0);
    const anillo = malla(new THREE.TorusGeometry(0.08, 0.018, 6, 16), acento, 0, -0.3, 0); anillo.rotation.x = Math.PI / 2;
    const inf = malla(new THREE.CapsuleGeometry(0.07, 0.18, 4, 10), traje, 0, -0.43, 0);
    const guante = malla(new THREE.SphereGeometry(0.075, 12, 10), oscuro, 0, -0.6, 0.01); guante.scale.set(1, 1.15, 0.9);
    const puno = malla(new THREE.CylinderGeometry(0.075, 0.08, 0.06, 16), metal, 0, -0.53, 0);
    hombro.add(sup, anillo, inf, guante, puno);
    if (s > 0) hombro.add(malla(new THREE.BoxGeometry(0.07, 0.04, 0.05), std(0x29335e), 0, -0.47, 0.07)); // pantalla de muñeca
    hombro.rotation.z = s * 0.12;
    g.add(hombro);
  }
  // Parche en el hombro izquierdo
  const parche = malla(new THREE.CircleGeometry(0.075, 24), nombrado(new THREE.MeshStandardMaterial({ map: texturaParche('parche-peru'), roughness: 0.8 }), 'parche'), -0.36, 1.13, 0.065);
  parche.rotation.y = -0.55; parche.castShadow = false;
  g.add(parche);

  // Piernas (cadera → rodilla → bota)
  for (const s of [-1, 1]) {
    const pierna = new THREE.Group(); pierna.name = s < 0 ? 'pierna-i' : 'pierna-d';
    pierna.position.set(s * 0.12, 0.72, 0);
    const muslo = malla(new THREE.CapsuleGeometry(0.095, 0.2, 4, 10), traje, 0, -0.15, 0);
    const rodilla = malla(new THREE.SphereGeometry(0.075, 10, 8), claro, 0, -0.3, 0.06);
    const canilla = malla(new THREE.CapsuleGeometry(0.088, 0.18, 4, 10), traje, 0, -0.43, 0);
    const bota = malla(new THREE.BoxGeometry(0.17, 0.12, 0.27), oscuro, 0, -0.62, 0.04);
    const suela = malla(new THREE.BoxGeometry(0.18, 0.03, 0.28), acento, 0, -0.69, 0.04);
    pierna.add(muslo, rodilla, canilla, bota, suela);
    for (let k = 0; k < 4; k++) pierna.add(malla(new THREE.BoxGeometry(0.17, 0.02, 0.025), oscuro, 0, -0.665, -0.07 + k * 0.075)); // relieve de la suela
    pierna.add(malla(new THREE.TorusGeometry(0.09, 0.012, 6, 16), metal, 0, -0.55, 0).rotateX(Math.PI / 2)); // anillo de la bota
    g.add(pierna);
  }
  g.add(accesorios(acento));
  g.add(marco);
  return g;
}

/** Viste al astronauta: { traje, acento, visor } en hex y, opcionalmente, parche y accesorio (ids del catálogo). */
export function vestirAstronauta(a, c = {}) {
  a.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    if (!m.userData.matPropio) { m.material = m.material.clone(); m.userData.matPropio = true; m.userData.matNombre = m.material.name; }
    const n = m.userData.matNombre;
    if (n === 'traje' && c.traje != null) m.material.color.setHex(c.traje);
    if (n === 'blanco' && c.traje != null) m.material.color.copy(new THREE.Color(c.traje).lerp(new THREE.Color(0xffffff), 0.55));
    if (n === 'naranja' && c.acento != null) m.material.color.setHex(c.acento);
    if (n === 'oro' && c.visor != null) { m.material.color.setHex(c.visor); m.material.emissive?.setHex(c.visor); }
    if (n === 'parche' && c.parche) { m.material.map = texturaParche(c.parche); m.material.needsUpdate = true; }
  });
  const acc = a.getObjectByName('accesorios');
  if (acc) acc.children.forEach((x) => { x.visible = x.name === c.accesorio; });
}

/** Balancea brazos y piernas al caminar (fase en radianes; amplitud 0 = quieto). */
export function caminar(a, fase, amp = 0.5) {
  const s = Math.sin(fase) * amp;
  const pi = a.getObjectByName('pierna-i'), pd = a.getObjectByName('pierna-d');
  const bi = a.getObjectByName('brazo-i'), bd = a.getObjectByName('brazo-d');
  if (pi) pi.rotation.x = s;
  if (pd) pd.rotation.x = -s;
  if (bi) bi.rotation.x = -s * 0.8;
  if (bd) bd.rotation.x = s * 0.8;
}
