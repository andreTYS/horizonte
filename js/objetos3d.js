// Objetos de la base (decoración con sentido): algunos vienen de inicio y otros se desbloquean con créditos estelares.
// Cada uno es clicable: la cámara se acerca y se muestra su ficha.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25, ...extra });
const brillo = (color, i = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });
function malla(geo, m, sombra = true) { const o = new THREE.Mesh(geo, m); o.castShadow = sombra; o.receiveShadow = true; return o; }
const en = (o, x, y, z) => { o.position.set(x, y, z); return o; };

/** Dónde va cada objeto (alrededor de la plataforma, sin tapar los módulos). */
export const POS_OBJETOS = {
  'obj-bandera': [8, -8],
  'obj-contenedores': [-30, -6],
  'obj-torre': [30, -2],
  'obj-telescopio': [-31, 11],
  'obj-huerto': [14, 27],
  'obj-antena': [29, -22],
  'obj-dron': [0, 0],
  'obj-llama': [-9, 25],
};

/** Los objetos se ven a 1,8× su tamaño de construcción: más fáciles de ver y tocar en una pantalla pequeña. */
export const ESCALA_OBJETOS = 1.8;

function bandera() {
  const g = new THREE.Group();
  g.add(en(malla(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 10), mat(0xdedede, { metalness: 0.8 })), 0, 2.1, 0));
  // Bandera del Perú: rojo, blanco, rojo (en la Luna no hay viento: va sostenida por una barra, como las del Apolo)
  const tela = new THREE.Group();
  [[0xd91023, -0.6], [0xffffff, 0], [0xd91023, 0.6]].forEach(([c, x]) => {
    const f = malla(new THREE.BoxGeometry(0.6, 1.2, 0.03), mat(c, { roughness: 0.9, metalness: 0 }));
    f.position.x = x;
    tela.add(f);
  });
  tela.position.set(0.95, 3.4, 0);
  const barra = malla(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), mat(0xdedede));
  barra.rotation.z = Math.PI / 2; barra.position.set(0.95, 4.02, 0);
  g.add(tela, barra);
  return g;
}

function contenedores() {
  const g = new THREE.Group();
  const colores = [0xff8a2a, 0xeef0f6, 0x3a3f52, 0xffc21a];
  [[0, 0, 0, 0], [2.3, 0, 0.2, 1], [0.8, 1.2, 0.1, 2], [-0.4, 0, 2, 3], [1.9, 0, 2.2, 0]].forEach(([x, y, z, c], i) => {
    const caja = malla(new THREE.BoxGeometry(2, 1.15, 1.6), mat(colores[c]));
    caja.position.set(x, 0.6 + y, z);
    caja.rotation.y = (i % 3) * 0.12;
    const franja = malla(new THREE.BoxGeometry(2.02, 0.14, 1.62), mat(0x1b1f2b));
    franja.position.copy(caja.position); franja.rotation.copy(caja.rotation);
    g.add(caja, franja);
  });
  return g;
}

function torre() {
  const g = new THREE.Group();
  g.add(en(malla(new THREE.CylinderGeometry(0.07, 0.1, 5, 8), mat(0xc9ced8, { metalness: 0.8 })), 0, 2.5, 0));
  const caja = malla(new THREE.BoxGeometry(0.6, 0.4, 0.4), mat(0xeef0f6)); caja.position.y = 1.4; g.add(caja);
  const molino = new THREE.Group(); molino.position.y = 5.1; molino.name = 'gira';
  for (let i = 0; i < 3; i++) {
    const brazo = malla(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), mat(0xc9ced8)); brazo.rotation.z = Math.PI / 2;
    const copa = malla(new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI), mat(0xff8a2a));
    const brazoG = new THREE.Group(); brazoG.rotation.y = (i / 3) * Math.PI * 2;
    brazo.position.x = 0.35; copa.position.x = 0.7; brazoG.add(brazo, copa); molino.add(brazoG);
  }
  const luz = malla(new THREE.SphereGeometry(0.09), brillo(0x6fd39a)); luz.position.y = 4.6; luz.name = 'baliza';
  g.add(molino, luz);
  return g;
}

function telescopio() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pata = malla(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), mat(0x3a3f52));
    const a = (i / 3) * Math.PI * 2;
    pata.position.set(Math.cos(a) * 0.35, 0.75, Math.sin(a) * 0.35);
    pata.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(pata);
  }
  const tubo = malla(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 20), mat(0xeef0f6)); tubo.rotation.z = -0.9; tubo.position.set(0.3, 1.9, 0);
  const lente = malla(new THREE.CircleGeometry(0.21, 20), brillo(0x7fd8f2, 1.2)); lente.position.set(1.15, 2.5, 0); lente.rotation.y = Math.PI / 2;
  g.add(tubo, lente);
  g.name = 'apunta';
  return g;
}

function huerto() {
  const g = new THREE.Group();
  const base = malla(new THREE.BoxGeometry(5, 0.3, 3.2), mat(0x6b5236, { roughness: 1, metalness: 0 })); base.position.y = 0.15; g.add(base);
  const colores = [0x7b3fa0, 0xe0b040, 0xd65a3a]; // papas nativas: morada, amarilla, roja
  for (let f = 0; f < 3; f++) for (let c = 0; c < 6; c++) {
    const planta = malla(new THREE.ConeGeometry(0.28, 0.6, 7), mat(0x38c26a, { roughness: 0.9 }));
    planta.position.set(-2 + c * 0.8, 0.6, -1 + f);
    const papa = malla(new THREE.SphereGeometry(0.12, 8, 6), mat(colores[f]));
    papa.position.set(-1.75 + c * 0.8, 0.36, -0.8 + f);
    g.add(planta, papa);
  }
  // Túnel transparente que los protege
  const tunel = malla(new THREE.CylinderGeometry(1.8, 1.8, 5.2, 24, 1, true, Math.PI, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0xbfefff, transparent: true, opacity: 0.22, roughness: 0.1, side: THREE.DoubleSide }), false);
  tunel.rotation.z = Math.PI / 2; // el eje del medio cilindro queda a lo largo del huerto
  tunel.position.y = 0.3;
  g.add(tunel);
  const lamp = malla(new THREE.BoxGeometry(4.6, 0.06, 0.12), brillo(0xf29ad0, 1.8)); lamp.position.y = 1.95; g.add(lamp);
  return g;
}

function antena() {
  const g = new THREE.Group();
  const base = malla(new THREE.CylinderGeometry(1.1, 1.4, 0.6, 16), mat(0x8d93a8)); base.position.y = 0.3;
  const cuello = malla(new THREE.CylinderGeometry(0.25, 0.3, 2.2, 12), mat(0xc9ced8, { metalness: 0.8 })); cuello.position.y = 1.6;
  const plato = new THREE.Group(); plato.position.y = 3; plato.name = 'gira-lento';
  const disco = malla(new THREE.SphereGeometry(2.6, 32, 12, 0, Math.PI * 2, 0, 0.7), mat(0xf2f3f6, { side: THREE.DoubleSide, metalness: 0.2 }));
  disco.rotation.x = -1.2;
  const foco = malla(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), mat(0xc9ced8)); foco.rotation.x = -1.2 + Math.PI / 2; foco.position.set(0, 0.6, 0.35);
  const luz = malla(new THREE.SphereGeometry(0.14), brillo(0xff3030, 3)); luz.position.set(0, 1.4, 0.75); luz.name = 'baliza';
  plato.add(disco, foco, luz);
  g.add(base, cuello, plato);
  return g;
}

function dron() {
  const g = new THREE.Group(); g.name = 'dron';
  const cuerpo = malla(new THREE.BoxGeometry(0.7, 0.18, 0.7), mat(0xeef0f6)); g.add(cuerpo);
  const ojo = malla(new THREE.SphereGeometry(0.1), brillo(0x5cc8ee, 3)); ojo.position.set(0, -0.08, 0.38); g.add(ojo);
  for (const [x, z] of [[0.55, 0.55], [-0.55, 0.55], [0.55, -0.55], [-0.55, -0.55]]) {
    const brazo = malla(new THREE.BoxGeometry(0.06, 0.05, 0.8), mat(0x3a3f52)); brazo.position.set(x / 2, 0, z / 2); brazo.rotation.y = Math.atan2(x, z); g.add(brazo);
    const helice = malla(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }), false);
    helice.position.set(x, 0.08, z); g.add(helice);
  }
  return g;
}

function llama() {
  // Llama de piedra con casco, hecha de bloques (homenaje a la mascota de ASU STELLAR)
  const g = new THREE.Group();
  const piedra = mat(0xd9cdb8, { roughness: 0.95, metalness: 0 });
  const peana = malla(new THREE.CylinderGeometry(1, 1.2, 0.5, 8), mat(0x8d93a8)); peana.position.y = 0.25; g.add(peana);
  const cuerpo = malla(new THREE.BoxGeometry(1.4, 0.8, 0.7), piedra); cuerpo.position.y = 1.5; g.add(cuerpo);
  for (const [x, z] of [[0.5, 0.25], [-0.5, 0.25], [0.5, -0.25], [-0.5, -0.25]]) { const p = malla(new THREE.BoxGeometry(0.2, 0.8, 0.2), piedra); p.position.set(x, 0.85, z); g.add(p); }
  const cuello = malla(new THREE.BoxGeometry(0.35, 1.1, 0.35), piedra); cuello.position.set(0.6, 2.3, 0); g.add(cuello);
  const cabeza = malla(new THREE.BoxGeometry(0.6, 0.4, 0.4), piedra); cabeza.position.set(0.75, 2.9, 0); g.add(cabeza);
  for (const z of [0.12, -0.12]) { const oreja = malla(new THREE.BoxGeometry(0.1, 0.3, 0.08), piedra); oreja.position.set(0.6, 3.2, z); g.add(oreja); }
  const casco = malla(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xbfefff, transparent: true, opacity: 0.25, roughness: 0.05 }), false);
  casco.position.set(0.7, 2.95, 0); g.add(casco);
  const manta = malla(new THREE.BoxGeometry(1, 0.1, 0.75), mat(0xe77fb3, { roughness: 0.9 })); manta.position.set(-0.1, 1.95, 0); g.add(manta);
  return g;
}

export const FABRICAS_OBJETOS = { 'obj-bandera': bandera, 'obj-contenedores': contenedores, 'obj-torre': torre, 'obj-telescopio': telescopio, 'obj-huerto': huerto, 'obj-antena': antena, 'obj-dron': dron, 'obj-llama': llama };

/** Anima las partes que se mueven (molino de viento, antena, dron). */
export function animarObjeto(o, t) {
  o.traverse((p) => {
    if (p.name === 'gira') p.rotation.y = t * 3;
    if (p.name === 'gira-lento') p.rotation.y = Math.sin(t * 0.15) * 0.8;
    if (p.name === 'baliza') p.material.emissiveIntensity = (t * 0.8) % 1 < 0.15 ? 4 : 0.3;
  });
  if (o.userData.id === 'obj-dron') {
    const a = t * 0.35;
    o.position.set(Math.cos(a) * 20, 9 + Math.sin(t * 1.3) * 0.6, Math.sin(a) * 20);
    o.rotation.y = -a;
  }
}
