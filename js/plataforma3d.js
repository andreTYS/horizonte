// Plataforma de la base (estilo videojuego): losas con juntas, bordes de advertencia, caminos,
// pista de aterrizaje y luces que se encienden de noche. Más rocas sobre el terreno.
import * as THREE from 'three';

export const ALTO_PLATAFORMA = 0.12; // los módulos se apoyan a esta altura

// Zonas de la base (deben coincidir con POS de mundo3d.js)
const ZONAS = {
  panel: { x: -10.2, z: -10.6, w: 15.5, d: 10.5 },
  bateria: { x: 11.6, z: -7.9, w: 8, d: 5.8 },
  reciclador: { x: -8, z: 7, w: 5.6, d: 3.8 },
  invernadero: { x: 3, z: 11.5, w: 7, d: 4.4 },
  extractor: { x: -15, z: -1, w: 5, d: 5 },
  moxie: { x: 11, z: 4, w: 4.5, d: 3.6 },
};
const REDONDAS = { reactor: { x: 18, z: 13, r: 5.2 }, lander: { x: -18, z: 12, r: 5.4 } };

function lienzo(tam, dibujar) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  dibujar(c.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function losas(g, tam, celda, base = '#4b505d') {
  g.fillStyle = base;
  g.fillRect(0, 0, tam, tam);
  for (let y = 0; y < tam; y += celda) {
    for (let x = 0; x < tam; x += celda) {
      const v = Math.floor(Math.random() * 14) - 7;
      g.fillStyle = `rgb(${75 + v},${80 + v},${93 + v})`;
      g.fillRect(x + 2, y + 2, celda - 4, celda - 4);
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.fillRect(x + 2, y + 2, celda - 4, 3);
      g.fillStyle = 'rgba(200,210,230,.55)';
      for (const [bx, by] of [[8, 8], [celda - 10, 8], [8, celda - 10], [celda - 10, celda - 10]]) g.fillRect(x + bx, y + by, 3, 3);
    }
  }
  g.strokeStyle = 'rgba(10,12,18,.9)';
  g.lineWidth = 3;
  for (let i = 0; i <= tam; i += celda) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, tam); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(tam, i); g.stroke();
  }
}

function franjas(g, x, y, w, h, ancho = 18) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#16181f'; g.fillRect(x, y, w, h);
  g.fillStyle = '#f2b51d';
  for (let i = -h; i < w + h; i += ancho * 2) {
    g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + ancho, y + h); g.lineTo(x + i + ancho + h, y); g.lineTo(x + i + h, y); g.closePath(); g.fill();
  }
  g.restore();
}

const texLosas = () => lienzo(512, (g, t) => { losas(g, t, 128); });
const texZona = () => lienzo(512, (g, t) => {
  losas(g, t, 128, '#434855');
  franjas(g, 0, 0, t, 22); franjas(g, 0, t - 22, t, 22);
});
const texCentro = () => lienzo(1024, (g, t) => {
  losas(g, t, 128);
  const c = t / 2;
  g.strokeStyle = 'rgba(95,214,255,.55)'; g.lineWidth = 10;
  g.beginPath(); g.arc(c, c, t * 0.33, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.setLineDash([24, 18]);
  g.beginPath(); g.arc(c, c, t * 0.4, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(255,181,71,.85)';
  g.font = `bold ${t * 0.045}px sans-serif`; g.textAlign = 'center';
  for (const [a, txt] of [[-Math.PI / 2, 'HORIZONTE'], [Math.PI / 2, 'BASE LUNAR 01']]) {
    g.save(); g.translate(c + Math.cos(a) * t * 0.43, c + Math.sin(a) * t * 0.43 + t * 0.016); g.fillText(txt, 0, 0); g.restore();
  }
});
const texReactor = () => lienzo(512, (g, t) => {
  losas(g, t, 128, '#3c3f48');
  const c = t / 2;
  g.save(); g.beginPath(); g.arc(c, c, t * 0.49, 0, Math.PI * 2); g.arc(c, c, t * 0.4, 0, Math.PI * 2, true); g.clip();
  franjas(g, 0, 0, t, t, 26); g.restore();
  g.strokeStyle = '#ff5b6b'; g.lineWidth = 6; g.setLineDash([20, 14]);
  g.beginPath(); g.arc(c, c, t * 0.36, 0, Math.PI * 2); g.stroke();
});
const texPista = () => lienzo(512, (g, t) => {
  g.fillStyle = '#3d414c'; g.fillRect(0, 0, t, t);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * t, Math.random() * t, 2, 2); }
  const c = t / 2;
  g.strokeStyle = '#f2f4ff'; g.lineWidth = 14;
  g.beginPath(); g.arc(c, c, t * 0.4, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffb547';
  g.fillRect(c - t * 0.16, c - t * 0.2, t * 0.07, t * 0.4);
  g.fillRect(c + t * 0.09, c - t * 0.2, t * 0.07, t * 0.4);
  g.fillRect(c - t * 0.16, c - t * 0.035, t * 0.32, t * 0.07);
});

/**
 * @returns {{ grupo: THREE.Group, luces: THREE.MeshStandardMaterial[], balizas: THREE.Mesh[] }}
 */
export function crearPlataforma() {
  const grupo = new THREE.Group();
  grupo.name = 'plataforma';
  const luces = [];
  const balizas = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.55, metalness: 0.7 });
  const luzCian = new THREE.MeshStandardMaterial({ color: 0x5fd6ff, emissive: 0x5fd6ff, emissiveIntensity: 0.4 });
  const luzAmbar = new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0xffb547, emissiveIntensity: 0.4 });
  luces.push(luzCian, luzAmbar);
  const malla = (geo, mat, sombra = false) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = sombra; grupo.add(m); return m; };
  const mat = (tex, rep = 1) => {
    if (rep !== 1) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(rep, rep); }
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.25 });
  };

  // Plataforma central hexagonal
  const hex = malla(new THREE.CylinderGeometry(7.4, 7.9, 0.24, 6), [metal, mat(texCentro()), metal]);
  hex.rotation.y = Math.PI / 6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, b = ((i + 1) / 6) * Math.PI * 2, R = 7.45;
    const p1 = new THREE.Vector3(Math.cos(a) * R, 0.13, Math.sin(a) * R), p2 = new THREE.Vector3(Math.cos(b) * R, 0.13, Math.sin(b) * R);
    const tira = malla(new THREE.BoxGeometry(p1.distanceTo(p2), 0.05, 0.12), luzCian);
    tira.position.copy(p1).add(p2).multiplyScalar(0.5);
    tira.rotation.y = -Math.atan2(p2.z - p1.z, p2.x - p1.x);
    const poste = malla(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 8), metal, true);
    poste.position.set(Math.cos(a) * 7.9, 0.55, Math.sin(a) * 7.9);
    const foco = malla(new THREE.SphereGeometry(0.14, 12, 8), luzAmbar);
    foco.position.set(Math.cos(a) * 7.9, 1.15, Math.sin(a) * 7.9);
  }

  // Zonas rectangulares con borde de advertencia
  const texZ = texZona();
  for (const z of Object.values(ZONAS)) {
    const t = texZ.clone(); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(z.w / 4)), Math.max(1, Math.round(z.d / 4)));
    const pad = malla(new THREE.BoxGeometry(z.w, 0.2, z.d), [metal, metal, mat(t), metal, metal, metal]);
    pad.position.set(z.x, 0, z.z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const l = malla(new THREE.BoxGeometry(0.3, 0.06, 0.3), luzAmbar);
      l.position.set(z.x + dx * (z.w / 2 - 0.2), 0.12, z.z + dz * (z.d / 2 - 0.2));
    }
  }

  // Reactor (zona de exclusión) y pista de aterrizaje
  const r = REDONDAS.reactor;
  const pr = malla(new THREE.CylinderGeometry(r.r, r.r + 0.2, 0.2, 48), [metal, mat(texReactor()), metal]);
  pr.position.set(r.x, 0, r.z);
  const l = REDONDAS.lander;
  const pl = malla(new THREE.CylinderGeometry(l.r, l.r + 0.25, 0.2, 48), [metal, mat(texPista()), metal]);
  pl.position.set(l.x, 0, l.z);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = malla(new THREE.SphereGeometry(0.12, 10, 6), new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x4ade80, emissiveIntensity: 1.5 }));
    b.position.set(l.x + Math.cos(a) * (l.r - 0.1), 0.14, l.z + Math.sin(a) * (l.r - 0.1));
    b.userData.fase = i / 12;
    balizas.push(b);
  }

  // Caminos desde el hábitat hasta cada zona, con luces en los bordes
  const texC = texLosas();
  const destinos = [...Object.values(ZONAS), ...Object.values(REDONDAS)];
  const puntoLuz = new THREE.BoxGeometry(0.18, 0.05, 0.18);
  for (const d of destinos) {
    const largo = Math.hypot(d.x, d.z) - 7;
    if (largo <= 0.5) continue;
    const ang = Math.atan2(d.z, d.x);
    const t = texC.clone(); t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(largo / 2.4, 1);
    const camino = malla(new THREE.BoxGeometry(largo, 0.16, 2.2), [metal, metal, mat(t), metal, metal, metal]);
    const medio = 7 + largo / 2;
    camino.position.set(Math.cos(ang) * medio, 0, Math.sin(ang) * medio);
    camino.rotation.y = -ang;
    for (let k = 1; k < largo / 2.5; k++) {
      for (const lado of [-1.15, 1.15]) {
        const p = malla(puntoLuz, luzCian);
        const dist = 7 + k * 2.5;
        p.position.set(Math.cos(ang) * dist - Math.sin(ang) * lado, 0.09, Math.sin(ang) * dist + Math.cos(ang) * lado);
      }
    }
  }
  return { grupo, luces, balizas };
}

/** Rocas sobre el terreno (una sola malla instanciada: liviana). */
export function crearRocas(altura, cantidad = 320) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b8e99, roughness: 0.95, flatShading: true });
  const rocas = new THREE.InstancedMesh(geo, mat, cantidad);
  rocas.castShadow = true;
  rocas.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let i = 0, intento = 0;
  while (i < cantidad && intento < cantidad * 10) {
    intento++;
    const a = Math.random() * Math.PI * 2, d = 27 + Math.pow(Math.random(), 0.7) * 100;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const tam = Math.random() < 0.08 ? 1.2 + Math.random() * 1.6 : 0.15 + Math.random() * 0.7;
    s.set(tam * (0.8 + Math.random() * 0.5), tam * (0.45 + Math.random() * 0.35), tam * (0.8 + Math.random() * 0.5));
    e.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    q.setFromEuler(e);
    p.set(x, altura(x, z) + s.y * 0.35, z);
    m.compose(p, q, s);
    rocas.setMatrixAt(i++, m);
  }
  rocas.count = i;
  return rocas;
}
