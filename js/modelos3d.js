// Modelos 3D de la base, construidos con Three.js (materiales PBR, como en Blender).
// Cada función devuelve un THREE.Group. Se pueden exportar a .glb (tools/exportar-glb.html)
// y reemplazar por modelos hechos en Blender listándolos en assets/modelos/manifest.json.
import * as THREE from 'three';

// ── Materiales compartidos ──
const M = {
  blanco: new THREE.MeshStandardMaterial({ color: 0xeef0f6, roughness: 0.45, metalness: 0.05 }),
  gris: new THREE.MeshStandardMaterial({ color: 0x8d93a8, roughness: 0.6, metalness: 0.4 }),
  grisOscuro: new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 0.55, metalness: 0.6 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc9ced8, roughness: 0.25, metalness: 0.9 }),
  oro: new THREE.MeshStandardMaterial({ color: 0xd9a540, roughness: 0.3, metalness: 1 }),
  naranja: new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.5, metalness: 0.1 }),
  amarillo: new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.5 }),
  regolito: new THREE.MeshStandardMaterial({ color: 0x9a8c70, roughness: 1, metalness: 0 }),
  vidrio: new THREE.MeshPhysicalMaterial({ color: 0xbfefff, roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.35, thickness: 0.2 }),
  agua: new THREE.MeshPhysicalMaterial({ color: 0x3fb6ff, roughness: 0.1, transparent: true, opacity: 0.75 }),
  planta: new THREE.MeshStandardMaterial({ color: 0x38c26a, roughness: 0.8 }),
  planta2: new THREE.MeshStandardMaterial({ color: 0x6ee38f, roughness: 0.8 }),
};

function texturaPanel() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 160);
  grad.addColorStop(0, '#2c4fd0'); grad.addColorStop(1, '#14246e');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(190,210,255,.55)'; g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke(); }
  for (let y = 0; y <= 160; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let TEX_PANEL = null;

const malla = (geo, mat, { sombra = true } = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
};
const caja = (w, h, d, mat) => malla(new THREE.BoxGeometry(w, h, d), mat);
const cil = (rt, rb, h, mat, seg = 32) => malla(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

function emisivo(color, intensidad = 2) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad, roughness: 0.4 });
}

// ── Hábitat ──
export function habitat() {
  const g = new THREE.Group();
  g.name = 'habitat';
  const cuerpo = cil(3.2, 3.2, 2.6, M.blanco, 48); cuerpo.position.y = 1.3;
  const cupula = malla(new THREE.SphereGeometry(3.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.blanco);
  cupula.scale.y = 0.75; cupula.position.y = 2.6;
  g.add(cuerpo, cupula);
  for (const y of [0.35, 2.55]) {
    const anillo = malla(new THREE.TorusGeometry(3.22, 0.12, 12, 64), M.gris);
    anillo.rotation.x = Math.PI / 2; anillo.position.y = y;
    g.add(anillo);
  }
  // Ventanas (brillan de noche)
  const ventana = emisivo(0xffd27a, 0.15);
  ventana.name = 'ventana';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const v = caja(0.7, 0.55, 0.1, ventana);
    v.position.set(Math.cos(a) * 3.21, 1.7, Math.sin(a) * 3.21);
    v.lookAt(0, 1.7, 0);
    g.add(v);
  }
  // Esclusa
  const tunel = cil(0.9, 0.9, 2, M.blanco); tunel.rotation.z = Math.PI / 2; tunel.position.set(3.9, 1, 0);
  const puerta = caja(0.15, 1.4, 1.1, M.grisOscuro); puerta.position.set(4.95, 0.95, 0);
  g.add(tunel, puerta);
  // Antena y baliza
  const mastil = cil(0.07, 0.07, 3, M.metal); mastil.position.set(-1.2, 5, -1);
  const plato = malla(new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3), M.metal);
  plato.position.set(-1.2, 6.2, -1); plato.rotation.x = -0.9;
  const baliza = malla(new THREE.SphereGeometry(0.16, 12, 12), emisivo(0xff3b3b, 3), { sombra: false });
  baliza.position.set(-1.2, 6.6, -1); baliza.name = 'baliza';
  g.add(mastil, plato, baliza);
  return g;
}

// ── Blindaje de regolito (sacos apilados) ──
export function blindaje(nivel) {
  const g = new THREE.Group();
  g.name = 'blindaje';
  if (!nivel) return g;
  const filas = nivel === 1 ? 2 : 4;
  const saco = new THREE.BoxGeometry(1.1, 0.42, 0.7);
  for (let f = 0; f < filas; f++) {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (f % 2) * (Math.PI / n);
      if (Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) > 0) continue; // hueco de la esclusa
      const s = malla(saco, M.regolito);
      const r = 3.75 - f * 0.08;
      s.position.set(Math.cos(a) * r, 0.21 + f * 0.42, Math.sin(a) * r);
      s.rotation.y = -a + Math.PI / 2;
      s.scale.set(1, 1 - Math.random() * 0.15, 1);
      g.add(s);
    }
  }
  return g;
}

// ── Panel solar ──
export function panel() {
  TEX_PANEL ||= texturaPanel();
  const g = new THREE.Group();
  g.name = 'panel';
  const poste = cil(0.08, 0.1, 1.4, M.metal); poste.position.y = 0.7;
  const placaMat = new THREE.MeshStandardMaterial({ map: TEX_PANEL, roughness: 0.25, metalness: 0.7 });
  placaMat.name = 'placa';
  const placa = caja(2.4, 0.06, 1.6, placaMat);
  placa.position.y = 1.45; placa.rotation.x = -0.5;
  const marco = caja(2.5, 0.04, 1.7, M.metal); marco.position.copy(placa.position); marco.rotation.copy(placa.rotation); marco.position.y -= 0.03;
  g.add(poste, marco, placa);
  return g;
}

// ── Batería ──
export function bateria() {
  const g = new THREE.Group();
  g.name = 'bateria';
  const cuerpo = caja(1.2, 1.6, 1.2, M.blanco); cuerpo.position.y = 0.8;
  const tapa = caja(1.25, 0.12, 1.25, M.gris); tapa.position.y = 1.66;
  const carga = caja(0.12, 1.2, 0.3, emisivo(0x4ade80, 1.5));
  carga.position.set(0.61, 0.75, 0); carga.name = 'carga';
  carga.geometry.translate(0, 0.6, 0); carga.position.y = 0.15;
  g.add(cuerpo, tapa, carga);
  return g;
}

// ── Reactor de fisión (inspirado en Fission Surface Power) ──
export function reactor() {
  const g = new THREE.Group();
  g.name = 'reactor';
  const base = cil(1.5, 1.7, 0.4, M.grisOscuro); base.position.y = 0.2;
  const nucleo = cil(1.1, 1.2, 3.2, M.grisOscuro); nucleo.position.y = 2;
  const tapa = cil(0.6, 1.1, 0.6, M.gris); tapa.position.y = 3.9;
  const brillo = malla(new THREE.TorusGeometry(1.15, 0.09, 12, 48), emisivo(0xffa53a, 4), { sombra: false });
  brillo.rotation.x = Math.PI / 2; brillo.position.y = 3.3; brillo.name = 'nucleo';
  const franja = malla(new THREE.TorusGeometry(1.22, 0.1, 8, 48), M.amarillo);
  franja.rotation.x = Math.PI / 2; franja.position.y = 1.0;
  g.add(base, nucleo, tapa, brillo, franja);
  // Radiadores
  for (let i = 0; i < 4; i++) {
    const r = caja(3, 2.6, 0.05, M.blanco);
    const a = (i / 4) * Math.PI * 2;
    r.position.set(Math.cos(a) * 2.6, 2.2, Math.sin(a) * 2.6);
    r.rotation.y = -a;
    g.add(r);
  }
  return g;
}

// ── Reciclador de agua ──
export function reciclador() {
  const g = new THREE.Group();
  g.name = 'reciclador';
  const cuerpo = caja(2.2, 1.4, 1.6, M.blanco); cuerpo.position.y = 0.7;
  const tanque = cil(0.55, 0.55, 1.6, M.agua); tanque.position.set(-1.6, 0.8, 0);
  const tubo = malla(new THREE.TorusGeometry(0.5, 0.08, 8, 24, Math.PI), M.metal); tubo.position.set(-0.9, 1.5, 0);
  const luz = caja(0.5, 0.12, 0.05, emisivo(0x6fd3ff, 2)); luz.position.set(0.3, 1.1, 0.81); luz.name = 'estado';
  g.add(cuerpo, tanque, tubo, luz);
  return g;
}

// ── Invernadero (como Veggie de la ISS) ──
export function invernadero() {
  const g = new THREE.Group();
  g.name = 'invernadero';
  const base = caja(5.2, 0.3, 2.8, M.gris); base.position.y = 0.15;
  // Medio cilindro de vidrio acostado a lo largo del eje X (la mitad de arriba)
  const arco = new THREE.CylinderGeometry(1.4, 1.4, 5, 32, 1, true, 0, Math.PI);
  arco.rotateZ(Math.PI / 2);
  const cubierta = malla(arco, M.vidrio, { sombra: false });
  cubierta.position.y = 0.3;
  g.add(base, cubierta);
  for (let i = 0; i < 10; i++) {
    const p = malla(new THREE.IcosahedronGeometry(0.28 + (i % 3) * 0.05, 0), i % 2 ? M.planta : M.planta2);
    p.position.set(-2 + (i % 5) * 1, 0.6, i < 5 ? -0.45 : 0.45);
    g.add(p);
  }
  const luz = malla(new THREE.BoxGeometry(4.6, 0.05, 0.25), emisivo(0xff5fd2, 3), { sombra: false });
  luz.position.y = 1.55; luz.name = 'luz';
  g.add(luz);
  return g;
}

// ── Módulo de aterrizaje (decorativo) ──
export function lander() {
  const g = new THREE.Group();
  g.name = 'lander';
  const cuerpo = cil(1.4, 1.8, 2.2, M.oro, 8); cuerpo.position.y = 2;
  const cabina = cil(0.9, 1.3, 1.4, M.blanco, 8); cabina.position.y = 3.8;
  const tobera = cil(0.4, 0.8, 0.8, M.grisOscuro); tobera.position.y = 0.6;
  g.add(cuerpo, cabina, tobera);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pata = cil(0.07, 0.07, 2.6, M.metal);
    pata.position.set(Math.cos(a) * 1.9, 1.1, Math.sin(a) * 1.9);
    pata.lookAt(Math.cos(a) * 1.0, 2.2, Math.sin(a) * 1.0); pata.rotateX(Math.PI / 2);
    const pie = cil(0.35, 0.35, 0.08, M.metal); pie.position.set(Math.cos(a) * 2.5, 0.04, Math.sin(a) * 2.5);
    g.add(pata, pie);
  }
  return g;
}

// ── Astronauta ──
export function astronauta() {
  const g = new THREE.Group();
  g.name = 'astronauta';
  const cuerpo = malla(new THREE.CapsuleGeometry(0.28, 0.6, 4, 12), M.blanco); cuerpo.position.y = 0.7;
  const casco = malla(new THREE.SphereGeometry(0.26, 20, 16), M.blanco); casco.position.y = 1.45;
  const visor = malla(new THREE.SphereGeometry(0.2, 20, 12, -Math.PI / 2, Math.PI, 0.4, 1.4), M.oro); visor.position.set(0, 1.45, 0.08);
  const mochila = caja(0.4, 0.5, 0.2, M.gris); mochila.position.set(0, 0.85, -0.3);
  g.add(cuerpo, casco, visor, mochila);
  return g;
}

// ── Extractor de hielo (perfora y calienta el regolito para sacar agua) ──
export function extractor() {
  const g = new THREE.Group();
  g.name = 'extractor';
  const base = caja(2.6, 0.4, 2.6, M.grisOscuro); base.position.y = 0.2;
  const tolva = cil(1.0, 0.5, 1.2, M.gris, 24); tolva.position.set(-0.5, 1.0, 0.5);
  const horno = cil(0.55, 0.55, 1.5, M.blanco, 24); horno.position.set(0.6, 1.15, -0.5);
  const brillo = malla(new THREE.TorusGeometry(0.57, 0.06, 8, 24), emisivo(0xff7a2a, 3), { sombra: false });
  brillo.rotation.x = Math.PI / 2; brillo.position.set(0.6, 1.4, -0.5);
  g.add(base, tolva, horno, brillo);
  // Torre de perforación
  for (const [x, z] of [[0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) {
    const pata = cil(0.06, 0.06, 4.2, M.amarillo, 8);
    pata.position.set(x * 0.55, 2.4, z * 0.55);
    pata.rotation.set(z * 0.12, 0, -x * 0.12);
    g.add(pata);
  }
  for (const y of [1.4, 2.6, 3.8]) { const anillo = caja(1.1 - y * 0.08, 0.06, 1.1 - y * 0.08, M.amarillo); anillo.position.y = y; g.add(anillo); }
  const broca = cil(0.12, 0.02, 1.2, M.metal, 12); broca.position.y = 0.2;
  const eje = cil(0.08, 0.08, 3.8, M.metal, 12); eje.position.y = 2.6;
  const motor = caja(0.5, 0.4, 0.5, M.grisOscuro); motor.position.y = 4.5;
  g.add(broca, eje, motor);
  const tubo = cil(0.08, 0.08, 1.4, M.agua, 12); tubo.rotation.z = Math.PI / 2; tubo.position.set(0, 1.9, -0.5);
  g.add(tubo);
  return g;
}

// ── Planta MOXIE ampliada (oxígeno a partir del CO₂ de Marte) ──
export function moxie() {
  const g = new THREE.Group();
  g.name = 'moxie';
  const cuerpo = caja(1.8, 1.2, 1.3, M.blanco); cuerpo.position.y = 0.6;
  const franja = caja(1.82, 0.12, 1.32, M.oro); franja.position.y = 0.95;
  const toma = cil(0.38, 0.38, 0.25, M.grisOscuro, 24); toma.rotation.z = Math.PI / 2; toma.position.set(-1.0, 0.7, 0);
  const rejilla = malla(new THREE.TorusGeometry(0.3, 0.04, 6, 20), M.metal); rejilla.rotation.y = Math.PI / 2; rejilla.position.set(-1.13, 0.7, 0);
  const tanque = malla(new THREE.SphereGeometry(0.45, 24, 16), M.blanco); tanque.position.set(0.55, 1.55, 0);
  const anillo = malla(new THREE.TorusGeometry(0.46, 0.04, 8, 24), M.naranja); anillo.rotation.x = Math.PI / 2; anillo.position.set(0.55, 1.55, 0);
  const luz = caja(0.6, 0.1, 0.04, emisivo(0x9be7ff, 2.5)); luz.position.set(0.3, 0.45, 0.66);
  g.add(cuerpo, franja, toma, rejilla, tanque, anillo, luz);
  return g;
}

export const FABRICAS = { habitat, panel, bateria, reactor, reciclador, invernadero, lander, astronauta, extractor, moxie };
