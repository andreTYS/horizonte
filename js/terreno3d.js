// Terreno grande para explorar: relieve, texturas (color + relieve + variación a gran escala),
// cordillera en el horizonte, Vía Láctea, huellas de rover y puntos de interés.
import * as THREE from 'three';

export const RADIO = 460;          // medio lado del terreno (el mapa mide 920 × 920)
export const RADIO_EXPLORAR = 230; // hasta dónde puede ir la cámara

// ── Ruido ──
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function ruido(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y) => ruido(x, y) * 0.5 + ruido(x * 2.1, y * 2.1) * 0.25 + ruido(x * 4.3, y * 4.3) * 0.125 + ruido(x * 8.7, y * 8.7) * 0.0625;
const cresta = (x, y) => 1 - Math.abs(ruido(x, y) * 2 - 1); // crestas afiladas para montañas

// ── Puntos de interés (posición en el mapa) ──
export const PUNTOS = {
  hielo: { x: 150, z: -150 },
  rover: { x: -95, z: 70 },
  antena: { x: 62, z: 92 },
  cima: { x: -175, z: -150 },
};

// Cráteres: chicos cerca de la base, grandes lejos, y el gran cráter en sombra con hielo.
const CRATERES = [
  ...Array.from({ length: 30 }, (_, i) => {
    const a = hash(i, 1) * Math.PI * 2, d = 36 + hash(i, 2) * 90;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 3 + hash(i, 3) * 9, p: 0.6 + hash(i, 4) * 1.6 };
  }),
  ...Array.from({ length: 34 }, (_, i) => {
    const a = hash(i, 11) * Math.PI * 2, d = 120 + hash(i, 12) * 230;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 8 + hash(i, 13) * 26, p: 1 + hash(i, 14) * 2.4 };
  }),
  { x: 26, z: -22, r: 7, p: 1.8 }, { x: -30, z: -6, r: 5, p: 1.2 },
  { x: PUNTOS.hielo.x, z: PUNTOS.hielo.z, r: 42, p: 5.5, grande: true },
].filter((c) => c.grande || Math.hypot(c.x - PUNTOS.hielo.x, c.z - PUNTOS.hielo.z) > 70);

export function altura(x, z) {
  const dist = Math.hypot(x, z);
  const plano = THREE.MathUtils.smoothstep(dist, 22, 34); // la base está en terreno nivelado
  const lejos = THREE.MathUtils.smoothstep(dist, 60, 260);
  let h = (fbm(x * 0.035, z * 0.035) - 0.45) * 7 * plano + (fbm(x * 0.2, z * 0.2) - 0.45) * 0.5 * plano;
  h += (fbm(x * 0.009 + 7, z * 0.009 + 3) - 0.45) * 26 * lejos;                 // lomas grandes
  const borde = THREE.MathUtils.smoothstep(dist, 270, 420);                         // cordillera del horizonte
  if (borde > 0) h += borde * (cresta(x * 0.018, z * 0.018) * 0.7 + fbm(x * 0.05, z * 0.05) * 0.5) * 75;
  // Cima con luz casi permanente
  const dc = Math.hypot(x - PUNTOS.cima.x, z - PUNTOS.cima.z);
  if (dc < 45) h += 22 * Math.pow(1 - dc / 45, 1.6);
  for (const c of CRATERES) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) h -= c.p * (1 - d * d) * 1.6;
    else if (d < 1.4) h += c.p * 0.5 * (1 - (d - 1) / 0.4);
  }
  return h;
}

/** Brillo a gran escala (0..1+): mares oscuros, rayos claros alrededor de cráteres, fondo de cráter oscuro. */
function tono(x, z) {
  let v = 0.82 + (fbm(x * 0.006 + 40, z * 0.006 - 20) - 0.45) * 0.55; // "mares" de basalto
  v += (fbm(x * 0.05, z * 0.05) - 0.45) * 0.18;
  for (const c of CRATERES) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 0.85) v -= 0.12 * (1 - d / 0.85) * Math.min(1, c.p / 2);
    else if (d < 3 && c.r > 6) { // eyección y rayos
      const ang = Math.atan2(z - c.z, x - c.x);
      const rayos = Math.pow(Math.max(0, Math.sin(ang * 7 + c.x) * Math.sin(ang * 11 + c.z)), 3);
      v += (0.1 + rayos * 0.25) * (1 - (d - 0.85) / 2.15) * Math.min(1, c.r / 14);
    }
  }
  const dh = Math.hypot(x - PUNTOS.hielo.x, z - PUNTOS.hielo.z) / 30; // el cráter de hielo nunca recibe sol
  if (dh < 1) v *= 0.45 + 0.55 * dh * dh;
  return THREE.MathUtils.clamp(v, 0.3, 1.25);
}

// ── Texturas generadas ──
function lienzo(tam) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  return [c, c.getContext('2d')];
}

/** Regolito: color + mapa de relieve (normales) a partir del mismo campo de alturas. Se repite sin costuras. */
function texturasRegolito(tam) {
  const alt = new Float32Array(tam * tam);
  const per = tam / 16; // ruido periódico: la textura se repite sin costuras
  const rp = (x, y, f) => {
    const p = Math.round(per * f);
    const xi = Math.floor(x * f), yi = Math.floor(y * f), xf = x * f - xi, yf = y * f - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h2 = (a, b) => hash(((a % p) + p) % p, ((b % p) + p) % p + f * 17);
    const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const X = x / 16, Y = y / 16;
    alt[y * tam + x] = rp(X, Y, 1) * 0.5 + rp(X, Y, 2) * 0.25 + rp(X, Y, 4) * 0.15 + Math.random() * 0.1;
  }
  // Cráteres pequeños (con borde) y piedritas, envueltos en los bordes
  const sello = (cx, cy, r, prof) => {
    const R = Math.ceil(r * 1.5);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy) / r;
      if (d > 1.5) continue;
      const i = (((cy + dy) % tam + tam) % tam) * tam + (((cx + dx) % tam + tam) % tam);
      alt[i] += d < 1 ? -prof * (1 - d * d) : prof * 0.45 * (1 - (d - 1) / 0.5);
    }
  };
  for (let i = 0; i < 70; i++) sello(Math.floor(Math.random() * tam), Math.floor(Math.random() * tam), 2 + Math.pow(Math.random(), 3) * tam * 0.05, 0.22);
  for (let i = 0; i < 500; i++) sello(Math.floor(Math.random() * tam), Math.floor(Math.random() * tam), 1 + Math.random() * 1.8, -0.5); // piedritas

  const [cc, gc] = lienzo(tam), [cn, gn] = lienzo(tam);
  const col = gc.createImageData(tam, tam), nor = gn.createImageData(tam, tam);
  const H = (x, y) => alt[((y + tam) % tam) * tam + ((x + tam) % tam)];
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const i = (y * tam + x) * 4, h = H(x, y);
    const dx = (H(x + 1, y) - H(x - 1, y)) * 3.2, dy = (H(x, y + 1) - H(x, y - 1)) * 3.2;
    const l = Math.hypot(dx, dy, 1);
    nor.data[i] = (-dx / l * 0.5 + 0.5) * 255; nor.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nor.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nor.data[i + 3] = 255;
    const v = 128 + (h - 0.5) * 60 + (Math.random() - 0.5) * 14;
    col.data[i] = v; col.data[i + 1] = v * 0.99; col.data[i + 2] = v * 1.02; col.data[i + 3] = 255;
  }
  gc.putImageData(col, 0, 0); gn.putImageData(nor, 0, 0);
  const preparar = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { mapa: preparar(cc, true), relieve: preparar(cn, false) };
}

/** Huellas de rover: dos bandas con dibujo de oruga. */
function texturaHuellas() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  for (const x0 of [4, 40]) {
    g.fillStyle = 'rgba(200,202,210,.4)'; g.fillRect(x0 - 2, 0, 2, 64); g.fillRect(x0 + 20, 0, 2, 64); // bordes de tierra removida
    g.fillStyle = 'rgba(12,12,16,.82)'; g.fillRect(x0, 0, 20, 64);
    g.fillStyle = 'rgba(150,150,160,.5)';
    for (let y = 0; y < 64; y += 8) g.fillRect(x0 + 2, y, 16, 3); // dibujo de la rueda
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function texturaViaLactea() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
  const img = g.getImageData(0, 0, 1024, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
    const banda = Math.exp(-Math.pow((y - 256 - Math.sin(x / 1024 * Math.PI * 2) * 60) / 46, 2));
    const n = fbm(x * 0.012, y * 0.02) * fbm(x * 0.05 + 9, y * 0.05);
    const v = banda * Math.max(0, n - 0.12) * 260;
    const i = (y * 1024 + x) * 4;
    img.data[i] = v * 0.85; img.data[i + 1] = v * 0.82; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Terreno ──
const SEGMENTOS = { baja: 150, media: 210, alta: 270 };
const CURVA = 1.45; // más vértices cerca de la base y menos en el horizonte
const deformar = (u) => Math.sign(u) * Math.pow(Math.abs(u), CURVA) * RADIO;
const desdeformar = (x) => Math.sign(x) * Math.pow(Math.min(1, Math.abs(x) / RADIO), 1 / CURVA);

/** Altura de la malla tal como se dibuja (entre vértices es una interpolación, no la fórmula exacta). */
export function alturaMalla(x, z, calidad) {
  const seg = SEGMENTOS[calidad] || SEGMENTOS.alta;
  const fi = (desdeformar(x) + 1) / 2 * seg, fj = (desdeformar(z) + 1) / 2 * seg;
  const i = Math.min(seg - 1, Math.floor(fi)), j = Math.min(seg - 1, Math.floor(fj));
  const tx = fi - i, tz = fj - j;
  const X = (k) => deformar(k / seg * 2 - 1);
  const h00 = altura(X(i), X(j)), h10 = altura(X(i + 1), X(j)), h01 = altura(X(i), X(j + 1)), h11 = altura(X(i + 1), X(j + 1));
  return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

export function crearTerreno(calidad) {
  const seg = SEGMENTOS[calidad] || SEGMENTOS.alta;
  const geo = new THREE.PlaneGeometry(2, 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  const colores = new Float32Array(p.count * 3);
  const TILE = 14; // metros por repetición de la textura de detalle
  for (let i = 0; i < p.count; i++) {
    const x = deformar(p.getX(i)), z = deformar(p.getZ(i));
    p.setXYZ(i, x, altura(x, z), z);
    uv.setXY(i, x / TILE, z / TILE);
    const v = tono(x, z);
    colores.set([v, v, v * 1.02], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  geo.computeVertexNormals();
  const { mapa, relieve } = texturasRegolito(calidad === 'baja' ? 256 : 512);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc4c7d0, map: mapa, normalMap: relieve, normalScale: new THREE.Vector2(1, 1),
    vertexColors: true, roughness: 0.96, metalness: 0,
  });
  // Segunda escala de la misma textura: rompe la repetición visible a lo lejos
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        diffuseColor.rgb *= 0.7 + 0.6 * texture2D(map, vMapUv * 0.083 + vec2(0.31, 0.57)).r;
      #endif`);
  };
  const suelo = new THREE.Mesh(geo, mat);
  suelo.receiveShadow = true;
  return suelo;
}

export function crearViaLactea() {
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 48, 24),
    new THREE.MeshBasicMaterial({ map: texturaViaLactea(), side: THREE.BackSide, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  cielo.rotation.set(0.5, 0, 0.9);
  return cielo;
}

/** Cinta que sigue el terreno (huellas de rover). */
function huella(puntos, calidad, ancho = 1.6) {
  const curva = new THREE.CatmullRomCurve3(puntos.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = Math.ceil(curva.getLength() / 1.2);
  const pos = [], uvs = [], idx = [];
  let largo = 0, prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, c = curva.getPointAt(t), tg = curva.getTangentAt(t);
    if (prev) largo += c.distanceTo(prev);
    prev = c.clone();
    const nx = -tg.z * ancho / 2, nz = tg.x * ancho / 2;
    for (const s of [-1, 1]) {
      const x = c.x + nx * s, z = c.z + nz * s;
      pos.push(x, Math.max(alturaMalla(x, z, calidad), altura(x, z), 0.12) + 0.12, z);
      uvs.push(s < 0 ? 0 : 1, largo / ancho);
    }
    if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texturaHuellas(), transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true;
  return m;
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, ...extra });

function rover() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 2), mat(0xe8e8ec));
  cuerpo.position.y = 1.3; g.add(cuerpo);
  const franja = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.18, 2.02), mat(0xff8a2a, { emissive: 0xff6a00, emissiveIntensity: 0.2 }));
  franja.position.y = 1.15; g.add(franja);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 1.8), mat(0x1b2a6b, { metalness: 0.6, roughness: 0.3, emissive: 0x0a1440, emissiveIntensity: 0.4 }));
  panel.position.y = 1.85; panel.rotation.z = 0.08; g.add(panel);
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4), mat(0x9aa0aa));
  mastil.position.set(1.1, 2.4, 0.6); g.add(mastil);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), mat(0x30343e));
  cam.position.set(1.1, 3.1, 0.6); g.add(cam);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.09), new THREE.MeshStandardMaterial({ color: 0x66ff99, emissive: 0x33ff88, emissiveIntensity: 2 }));
  luz.position.set(1.1, 3.3, 0.6); luz.name = 'baliza'; g.add(luz);
  const rueda = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
  rueda.rotateX(Math.PI / 2);
  for (const x of [-1.2, 0, 1.2]) for (const z of [-1.15, 1.15]) {
    const r = new THREE.Mesh(rueda, mat(0x2a2c33, { roughness: 0.9 }));
    r.position.set(x, 0.5, z); g.add(r);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function antena() {
  const g = new THREE.Group();
  const acero = mat(0xb9bec8, { metalness: 0.7, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 9.5), acero);
    pata.position.set(Math.cos(a) * 0.9, 4.6, Math.sin(a) * 0.9);
    pata.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1);
    g.add(pata);
  }
  for (let y = 1.5; y < 9; y += 1.6) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.95 - y * 0.05, 0.04, 6, 18), acero);
    aro.rotation.x = Math.PI / 2; aro.position.y = y; g.add(aro);
  }
  const plato = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 12, 0, Math.PI * 2, 0, 0.75), mat(0xf2f3f6, { side: THREE.DoubleSide, metalness: 0.2, roughness: 0.5 }));
  plato.position.y = 10.6; plato.rotation.set(-2.1, 0, 0.5); g.add(plato);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 2 }));
  luz.position.y = 9.6; luz.name = 'baliza'; g.add(luz);
  const caja = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.4), mat(0x8a909c));
  caja.position.set(2.2, 0.6, 0.5); g.add(caja);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function bandera() {
  const g = new THREE.Group();
  const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4), mat(0xdedede));
  asta.position.y = 2; g.add(asta);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0xff8a00, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
  tela.position.set(0.9, 3.4, 0); g.add(tela);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.14), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb547, emissiveIntensity: 2 }));
  luz.position.y = 4.1; luz.name = 'baliza'; g.add(luz);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Brillos de hielo en el fondo del cráter en sombra. */
function hieloEnSombra() {
  const n = 260, pos = new Float32Array(n * 3);
  const { x: cx, z: cz } = PUNTOS.hielo;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 26;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    pos.set([x, altura(x, z) + 0.15, z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fe6ff, size: 0.55, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
}

/** Objetos de los puntos de interés + huellas. Devuelve { grupo, hielo, balizas }. */
export function crearExploracion(calidad) {
  const grupo = new THREE.Group();
  const poner = (obj, { x, z }, rot = 0, dy = 0) => {
    obj.position.set(x, altura(x, z) + dy, z);
    obj.rotation.y = rot;
    grupo.add(obj);
    return obj;
  };
  poner(rover(), PUNTOS.rover, 0.9);
  poner(antena(), PUNTOS.antena, 0.4);
  poner(bandera(), { x: PUNTOS.cima.x + 3, z: PUNTOS.cima.z + 2 });
  const hielo = hieloEnSombra();
  grupo.add(hielo);
  // Huellas del rover: desde la base hasta donde está estacionado y hasta el cráter de hielo
  grupo.add(huella([[-25, 22], [-40, 32], [-62, 42], [-80, 60], [PUNTOS.rover.x + 2, PUNTOS.rover.z - 1]], calidad));
  grupo.add(huella([[30, -14], [60, -48], [95, -88], [118, -112]], calidad));
  grupo.add(huella([[12, 27], [30, 52], [PUNTOS.antena.x - 4, PUNTOS.antena.z - 6]], calidad, 1.2));
  const balizas = [];
  grupo.traverse((o) => { if (o.name === 'baliza') balizas.push(o); });
  return { grupo, hielo, balizas };
}

/** Altura del punto (para etiquetas y cámara). */
export function alturaPunto(id) {
  const { x, z } = PUNTOS[id];
  return altura(x, z) + ({ antena: 13, rover: 4.5, cima: 6, hielo: 4 }[id] || 4);
}
