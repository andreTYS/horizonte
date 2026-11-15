// Viaje en 3D (versión sencilla y liviana): cohete en la plataforma de la Tierra, despegue con fuego y humo,
// viaje entre la Tierra y la Luna o Marte, y aterrizaje junto al puesto de avanzada.
// Se crea al lanzar y se destruye al aterrizar, para no gastar tarjeta gráfica durante la misión.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...extra });
const brilla = (color, i = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });

function cohete() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 3.2, 24), mat(0xf5f6ff));
  cuerpo.position.y = 1.9;
  const franja = new THREE.Mesh(new THREE.CylinderGeometry(0.565, 0.57, 0.3, 24), mat(0xffc94a));
  franja.position.y = 1.0;
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 24), mat(0xff7a7a));
  punta.position.y = 4.15;
  const ventana = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), mat(0x5cc8ee, { emissive: 0x2a6f8f, emissiveIntensity: 0.4 }));
  ventana.position.set(0, 2.7, 0.56);
  const tobera = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.4, 16), mat(0x8a91b8, { metalness: 0.5 }));
  tobera.position.y = 0.1;
  g.add(cuerpo, franja, punta, ventana, tobera);
  for (let i = 0; i < 4; i++) {
    const aleta = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.7), mat(0x9a8ef0));
    const a = (i / 4) * Math.PI * 2;
    aleta.position.set(Math.sin(a) * 0.65, 0.65, Math.cos(a) * 0.65);
    aleta.rotation.y = a;
    g.add(aleta);
  }
  const fuego = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.6, 16), brilla(0xffc94a, 2));
  f1.rotation.x = Math.PI; f1.position.y = -0.85;
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 16), brilla(0xfff3d6, 2.5));
  f2.rotation.x = Math.PI; f2.position.y = -0.55;
  fuego.add(f1, f2);
  fuego.visible = false;
  g.add(fuego);
  g.userData.fuego = fuego;
  return g;
}

function planeta(color, radio, manchas) {
  // Textura simple pintada en un canvas (sin descargar imágenes)
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 128);
  for (const [col, n, r] of manchas) {
    x.fillStyle = col;
    for (let i = 0; i < n; i++) { x.beginPath(); x.ellipse(Math.random() * 256, 16 + Math.random() * 96, r * (0.5 + Math.random()), r * 0.6 * (0.5 + Math.random()), 0, 0, Math.PI * 2); x.fill(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.SphereGeometry(radio, 40, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}

export function crearViaje3D(contenedor, { marte = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'viaje-3d';
  contenedor.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const luz = new THREE.DirectionalLight(0xffffff, 2.2);
  luz.position.set(6, 10, 8);
  escena.add(luz, new THREE.HemisphereLight(0xbfe3f5, 0x6fae6c, 1.1));

  // Estrellas (se ven al salir de la atmósfera)
  const pos = new Float32Array(1500 * 3);
  for (let i = 0; i < pos.length; i += 3) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(400 + Math.random() * 300);
    pos.set([v.x, v.y, v.z], i);
  }
  const geoE = new THREE.BufferGeometry();
  geoE.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const estrellas = new THREE.Points(geoE, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0 }));
  escena.add(estrellas);

  // ── Escena 1: plataforma en la Tierra ──
  const tierraBase = new THREE.Group();
  const pasto = new THREE.Mesh(new THREE.CircleGeometry(120, 48), mat(0x7fbf73, { roughness: 1 }));
  pasto.rotation.x = -Math.PI / 2;
  const losa = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 0.4, 32), mat(0xb9bccb));
  losa.position.y = 0.2;
  const torre = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.5, 0.6), mat(0xff9a52));
  torre.position.set(-1.9, 3.25, 0);
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.3), mat(0xffc94a));
  brazo.position.set(-1.1, 4.6, 0);
  tierraBase.add(pasto, losa, torre, brazo);
  // Arbolitos y edificio de control para dar escala
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 16 + (i % 3) * 5;
    const arbol = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 8), mat(0x4f9a5b));
    arbol.position.set(Math.cos(a) * r, 1.2, Math.sin(a) * r - 10);
    tierraBase.add(arbol);
  }
  const control = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), mat(0xe6e9fb));
  control.position.set(9, 1, -6);
  tierraBase.add(control);
  escena.add(tierraBase);

  const nave = cohete();
  nave.position.y = 0.4;
  escena.add(nave);

  // Humo: esferas blancas que crecen y se desvanecen
  const humos = [];
  const matHumo = new THREE.MeshStandardMaterial({ color: 0xf5f6ff, transparent: true, opacity: 0.8, roughness: 1 });
  function soltarHumo(x, y, z, fuerza = 1) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), matHumo.clone());
    h.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
    h.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3 * fuerza, Math.random() * 0.6, (Math.random() - 0.5) * 3 * fuerza), vida: 0 };
    escena.add(h);
    humos.push(h);
  }

  // ── Escena 2: el espacio entre la Tierra y el destino ──
  const espacio = new THREE.Group();
  const tierra = planeta('#3f8fd0', 6, [['#6fbf73', 14, 22], ['#f5f6ff', 6, 14]]);
  tierra.position.set(-22, -2, -10);
  const destino = marte ? planeta('#e0794a', 3.6, [['#a8502f', 18, 10], ['#ffb98a', 10, 8]]) : planeta('#c9ccd8', 2.6, [['#9a9eb2', 22, 7]]);
  destino.position.set(22, 2, -12);
  espacio.add(tierra, destino);
  const ruta = new THREE.CatmullRomCurve3([new THREE.Vector3(-16, 0, -8), new THREE.Vector3(0, 9, -4), new THREE.Vector3(18, 4, -11)]);
  const linea = new THREE.Mesh(new THREE.TubeGeometry(ruta, 60, 0.05, 6), new THREE.MeshBasicMaterial({ color: 0xc9cfee, transparent: true, opacity: 0.5 }));
  espacio.add(linea);
  espacio.visible = false;
  escena.add(espacio);

  // ── Escena 3: el puesto de avanzada en el destino ──
  const llegada = new THREE.Group();
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(140, 48), mat(marte ? 0xd08156 : 0xb9bccb, { roughness: 1 }));
  suelo.rotation.x = -Math.PI / 2;
  llegada.add(suelo);
  for (let i = 0; i < 40; i++) {
    const roca = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.9), mat(marte ? 0xa8502f : 0x8a8ea3, { roughness: 1 }));
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 40;
    roca.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    llegada.add(roca);
  }
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf5f6ff));
  cupula.position.set(-7, 0, -3);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 20), mat(0xe6e9fb));
  tubo.rotation.z = Math.PI / 2; tubo.position.set(-3.4, 0.9, -3);
  const panelSolar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.6), mat(0x2a5f9e, { metalness: 0.4 }));
  panelSolar.position.set(-8, 1.6, 2.5); panelSolar.rotation.x = -0.4;
  const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), mat(0xdedede));
  mastil.position.set(-4.5, 1.6, 0.5);
  const bandera = new THREE.Group();
  [[0xd91023, -0.35], [0xffffff, 0], [0xd91023, 0.35]].forEach(([c, x]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.02), mat(c)); f.position.x = x; bandera.add(f); });
  bandera.position.set(-3.95, 2.8, 0.5);
  const luzBase = new THREE.PointLight(0xffc94a, 8, 12);
  luzBase.position.set(-7, 3, -1);
  llegada.add(cupula, tubo, panelSolar, mastil, bandera, luzBase);
  llegada.visible = false;
  escena.add(llegada);

  let modo = 'carga', t0 = performance.now(), viva = true;
  const cielo = new THREE.Color();
  const azul = new THREE.Color(0x8fcdee), negro = new THREE.Color(0x141a33), cieloMarte = new THREE.Color(0xe7b48f);
  escena.background = cielo.copy(azul);

  function tam() {
    const w = contenedor.clientWidth || window.innerWidth, h = contenedor.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.fov = w < h ? 60 : 45;
    camara.updateProjectionMatrix();
  }
  tam();
  window.addEventListener('resize', tam);

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05);
    const t = (performance.now() - t0) / 1000;
    const fuego = nave.userData.fuego;
    if (fuego.visible) fuego.scale.set(1, 0.85 + Math.random() * 0.35, 1);

    if (modo === 'carga') {
      const a = t * 0.25;
      camara.position.set(Math.sin(a) * 11, 4 + Math.sin(t * 0.4) * 0.5, Math.cos(a) * 11);
      camara.lookAt(0, 2.5, 0);
    } else if (modo === 'despegue') {
      const tl = Math.max(0, t - 0.9); // 0,9 s de cuenta regresiva
      fuego.visible = t > 0.5;
      if (t > 0.5 && t < 2.2) for (let i = 0; i < 2; i++) soltarHumo(0, 0.3, 0, 1.2);
      nave.position.y = 0.4 + tl * tl * 4.5;
      nave.position.x = (Math.random() - 0.5) * (t > 0.5 && t < 1.2 ? 0.05 : 0);
      if (tl > 0.3) soltarHumo(nave.position.x, nave.position.y - 1, 0, 0.2);
      camara.position.set(9, 3 + nave.position.y * 0.55, 9);
      camara.lookAt(0, nave.position.y + 1.5, 0);
      const k = Math.min(1, Math.max(0, (nave.position.y - 8) / 40));
      cielo.copy(azul).lerp(negro, k);
      estrellas.material.opacity = k;
    } else if (modo === 'viaje') {
      const k = Math.min(1, t / 3.3);
      const s = k * k * (3 - 2 * k);
      const p = ruta.getPointAt(s), d = ruta.getTangentAt(s);
      nave.position.copy(p);
      nave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      nave.scale.setScalar(0.7);
      tierra.rotation.y += dt * 0.3;
      destino.rotation.y += dt * 0.2;
      camara.position.set(0, 6, 30);
      camara.lookAt(0, 3, -8);
    } else if (modo === 'aterrizaje') {
      const k = Math.min(1, t / 2.2);
      const s = 1 - (1 - k) ** 3;
      nave.position.set(2.5, 0.25 + (1 - s) * 30, 1);
      fuego.visible = k < 0.98;
      fuego.scale.y *= 0.6;
      if (k > 0.75 && k < 0.98) for (let i = 0; i < 3; i++) soltarHumo(2.5, 0.2, 1, 1.6);
      camara.position.set(11, 4.5, 14);
      camara.lookAt(-1.5, 2 + (1 - s) * 6, 0);
      bandera.rotation.y = Math.sin(t * 2) * 0.05;
    }
    for (const h of humos) {
      h.userData.vida += dt;
      h.position.addScaledVector(h.userData.v, dt);
      h.scale.setScalar(1 + h.userData.vida * 2.4);
      h.material.opacity = Math.max(0, 0.8 - h.userData.vida * 0.45);
    }
    for (let i = humos.length - 1; i >= 0; i--) if (humos[i].userData.vida > 1.8) { escena.remove(humos[i]); humos[i].geometry.dispose(); humos[i].material.dispose(); humos.splice(i, 1); }
    renderer.render(escena, camara);
  });

  return {
    fase(nombre) {
      if (!viva) return;
      modo = nombre;
      t0 = performance.now();
      nave.scale.setScalar(1);
      nave.quaternion.identity();
      nave.position.set(0, 0.4, 0);
      nave.userData.fuego.visible = false;
      const enTierra = nombre === 'carga' || nombre === 'despegue';
      tierraBase.visible = enTierra;
      espacio.visible = nombre === 'viaje';
      llegada.visible = nombre === 'aterrizaje';
      if (enTierra) { escena.background = cielo.copy(azul); estrellas.material.opacity = nombre === 'carga' ? 0 : estrellas.material.opacity; }
      if (nombre === 'viaje') { escena.background = cielo.copy(negro); estrellas.material.opacity = 1; }
      if (nombre === 'aterrizaje') { escena.background = cielo.copy(marte ? cieloMarte : negro); estrellas.material.opacity = marte ? 0 : 1; }
    },
    destruir() {
      viva = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', tam);
      escena.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
