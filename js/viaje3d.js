// Viaje en 3D (versión sencilla y liviana): cohete en la plataforma de la Tierra, despegue con fuego y humo,
// viaje entre la Tierra y la Luna o Marte, y aterrizaje junto al puesto de avanzada.
// Se crea al lanzar y se destruye al aterrizar, para no gastar tarjeta gráfica durante la misión.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FABRICAS } from './modelos3d.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...extra });
const brilla = (color, i = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });

// Cohete inspirado en el SLS de la NASA: etapa central naranja, dos propulsores blancos, etapa superior y cápsula con torre de escape.
function cohete() {
  const g = new THREE.Group();
  const naranja = new THREE.MeshStandardMaterial({ color: 0xd9782f, roughness: 0.75, metalness: 0.05 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf2f3f6, roughness: 0.45, metalness: 0.1 });
  const gris = new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: 0.4, metalness: 0.7 });
  const negro = new THREE.MeshStandardMaterial({ color: 0x25272e, roughness: 0.6, metalness: 0.3 });
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  // Etapa central con anillos
  m(new THREE.CylinderGeometry(0.55, 0.55, 4.6, 40), naranja, 0, 2.6, 0);
  for (const y of [0.6, 1.8, 3.0, 4.2]) m(new THREE.CylinderGeometry(0.562, 0.562, 0.05, 40), new THREE.MeshStandardMaterial({ color: 0xb8622a, roughness: 0.8 }), 0, y, 0);
  m(new THREE.CylinderGeometry(0.47, 0.55, 0.35, 40), blanco, 0, 5.07, 0); // adaptador
  m(new THREE.CylinderGeometry(0.42, 0.47, 0.9, 40), blanco, 0, 5.7, 0);  // etapa superior
  m(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 40), negro, 0, 6.15, 0);
  // Cápsula Orion (cono) + torre de escape
  m(new THREE.CylinderGeometry(0.22, 0.43, 0.55, 40), blanco, 0, 6.47, 0);
  m(new THREE.ConeGeometry(0.22, 0.6, 32), blanco, 0, 7.04, 0);
  m(new THREE.CylinderGeometry(0.045, 0.06, 0.9, 12), gris, 0, 7.75, 0);
  m(new THREE.ConeGeometry(0.06, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0xd94a3a, roughness: 0.5 }), 0, 8.32, 0);
  // Propulsores laterales (SRB) con franjas
  for (const s of [-1, 1]) {
    m(new THREE.CylinderGeometry(0.24, 0.24, 4.3, 32), blanco, s * 0.82, 2.4, 0);
    m(new THREE.ConeGeometry(0.24, 0.55, 32), blanco, s * 0.82, 4.82, 0);
    for (const y of [1.2, 2.4, 3.6]) m(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 32), negro, s * 0.82, y, 0);
    m(new THREE.CylinderGeometry(0.17, 0.27, 0.32, 24), gris, s * 0.82, 0.12, 0);
    m(new THREE.BoxGeometry(0.16, 0.12, 0.1), gris, s * 0.55, 4.0, 0);
  }
  // Cuatro motores RS-25 de la etapa central
  for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) m(new THREE.CylinderGeometry(0.08, 0.15, 0.3, 20), gris, x, 0.17, z);
  // Fuego: núcleo brillante (además de las partículas)
  const fuego = new THREE.Group();
  const conoFuego = (r, l, c, x) => { const f = new THREE.Mesh(new THREE.ConeGeometry(r, l, 20, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); f.rotation.x = Math.PI; f.position.set(x, -l / 2, 0); fuego.add(f); };
  conoFuego(0.3, 2.2, 0xffe2a8, 0); conoFuego(0.2, 2.6, 0xfff6e0, -0.82); conoFuego(0.2, 2.6, 0xfff6e0, 0.82);
  fuego.visible = false;
  g.add(fuego);
  g.userData.fuego = fuego;
  return g;
}

// Torre de lanzamiento de celosía (como la torre móvil del SLS) con brazos de acceso
function torreLanzamiento() {
  const g = new THREE.Group();
  const acero = new THREE.MeshStandardMaterial({ color: 0x5d6270, roughness: 0.5, metalness: 0.75 });
  const viga = (x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), acero); o.position.set(x, y, z); o.castShadow = true; g.add(o); };
  const L = 0.9;
  for (const [x, z] of [[-L, -L], [L, -L], [-L, L], [L, L]]) viga(x, 4.6, z, 0.08, 9.2, 0.08);
  for (let y = 0.4; y < 9.2; y += 0.7) {
    viga(0, y, -L, 2 * L, 0.05, 0.05); viga(0, y, L, 2 * L, 0.05, 0.05); viga(-L, y, 0, 0.05, 0.05, 2 * L); viga(L, y, 0, 0.05, 0.05, 2 * L);
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), acero); d.position.set(L, y + 0.35, 0); d.rotation.x = 0.9; g.add(d);
    const d2 = d.clone(); d2.position.set(-L, y + 0.35, 0); d2.rotation.x = -0.9; g.add(d2);
  }
  // Brazos hacia el cohete (a la altura de la cápsula y de la etapa central)
  for (const y of [6.5, 3.4]) viga(1.9, y, 0, 2.0, 0.12, 0.35);
  // Luz roja de la cima
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  luz.position.set(0, 9.3, 0); g.add(luz);
  return g;
}

// Partículas con textura suave (fuego aditivo, humo normal). Cada partícula tiene velocidad y vida.
function texturaSuave() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function sistemaParticulas(n, { aditivo, tam, color }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: tam, map: texturaSuave(), vertexColors: true, transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: aditivo ? 0.9 : 0.75 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const vel = new Float32Array(n * 3), vida = new Float32Array(n).fill(99), max = new Float32Array(n).fill(1);
  let i0 = 0;
  const base = new THREE.Color(color), rojo = new THREE.Color(0xff5a1a), blancoHumo = new THREE.Color(0xf7f7f5);
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -9999;
  return {
    pts,
    emitir(x, y, z, vx, vy, vz, dur, disp = 0.3) {
      const i = i0++ % n;
      pos.set([x + (Math.random() - 0.5) * disp, y, z + (Math.random() - 0.5) * disp], i * 3);
      vel.set([vx + (Math.random() - 0.5) * disp * 3, vy, vz + (Math.random() - 0.5) * disp * 3], i * 3);
      vida[i] = 0; max[i] = dur * (0.7 + Math.random() * 0.6);
    },
    vaciar() { vida.fill(99); for (let i = 0; i < n; i++) pos[i * 3 + 1] = -9999; geo.attributes.position.needsUpdate = true; },
    actualizar(dt, frenado = 0.96, sube = 0) {
      for (let i = 0; i < n; i++) {
        if (vida[i] > max[i]) { if (pos[i * 3 + 1] > -9000) pos[i * 3 + 1] = -9999; continue; } // fuera de la vista (nunca una mancha negra)
        vida[i] += dt;
        const k = vida[i] / max[i];
        vel[i * 3] *= frenado; vel[i * 3 + 2] *= frenado; vel[i * 3 + 1] = vel[i * 3 + 1] * frenado + sube * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (aditivo) { // el fuego se apaga oscureciéndose (con mezcla aditiva, oscuro = transparente)
          const c = base.clone().lerp(rojo, k), f = 1 - k;
          col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
        } else { // el humo se aclara un poco al dispersarse, nunca se pone negro
          const c = base.clone().lerp(blancoHumo, k * 0.5);
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const escena = new THREE.Scene();
  // Reflejos del entorno: los metales y el cohete se ven reales
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.6;
  const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const luz = new THREE.DirectionalLight(0xfff1dd, 2.6);
  luz.position.set(12, 18, 10);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  Object.assign(luz.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  escena.add(luz, new THREE.HemisphereLight(0xbfe3f5, 0x6f8f5f, 0.7));
  // Resplandor del motor (ilumina el humo y la plataforma)
  const luzMotor = new THREE.PointLight(0xffa64d, 0, 40, 1.6);
  escena.add(luzMotor);

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
  const pasto = new THREE.Mesh(new THREE.CircleGeometry(160, 64), mat(0x6f9e5f, { roughness: 1 }));
  pasto.rotation.x = -Math.PI / 2; pasto.receiveShadow = true;
  // Plataforma de hormigón, lanzador móvil y foso de llamas
  const concreto = mat(0xb6b2a8, { roughness: 0.95 });
  const losa = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 0.6, 48), concreto);
  losa.position.y = 0.3; losa.receiveShadow = true;
  const lanzador = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.1, 4.5), mat(0x4d525e, { metalness: 0.6, roughness: 0.5 }));
  lanzador.position.y = 0.95; lanzador.castShadow = true; lanzador.receiveShadow = true;
  const foso = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 12), mat(0x2c2a27, { roughness: 1 }));
  foso.position.y = 0.32;
  const torre = torreLanzamiento();
  torre.position.set(-3.2, 1.5, 0);
  // Camino y torres de agua/rayos a lo lejos
  const camino = new THREE.Mesh(new THREE.PlaneGeometry(3, 120), mat(0x8d877c, { roughness: 1 }));
  camino.rotation.x = -Math.PI / 2; camino.position.set(0, 0.02, 60);
  tierraBase.add(pasto, losa, lanzador, foso, torre, camino);
  for (const [x, z] of [[20, -16], [-22, -14], [24, 12]]) {
    const pararrayo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 14, 8), mat(0xc9ccd4, { metalness: 0.6 }));
    pararrayo.position.set(x, 7, z); pararrayo.castShadow = true; tierraBase.add(pararrayo);
  }
  const tanque = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), mat(0xe9eaee, { metalness: 0.3, roughness: 0.3 }));
  tanque.position.set(-16, 2.2, -12); tanque.castShadow = true; tierraBase.add(tanque);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, r = 26 + (i % 4) * 7;
    const arbol = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 8), mat(0x3f7a47));
    arbol.position.set(Math.cos(a) * r, 1.5, Math.sin(a) * r); arbol.castShadow = true;
    tierraBase.add(arbol);
  }
  const control = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 4), mat(0xe6e9fb));
  control.position.set(22, 1.5, -18); control.castShadow = true;
  tierraBase.add(control);
  escena.add(tierraBase);

  const nave = cohete();
  const BASE_COHETE = 1.5;
  nave.position.y = BASE_COHETE;
  nave.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  escena.add(nave);

  // Cápsula Orion con su módulo de servicio y 4 paneles solares (para el viaje)
  const orion = new THREE.Group();
  const blancoO = mat(0xeef0f4, { metalness: 0.2, roughness: 0.35 });
  const capsula = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 32), blancoO);
  capsula.position.set(0, 0.95, 0);
  orion.add(capsula);
  orion.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32), mat(0xc9ccd4, { metalness: 0.6, roughness: 0.35 })));
  for (let i = 0; i < 4; i++) {
    const ala = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.6), mat(0x1f3a7a, { metalness: 0.5, roughness: 0.3 }));
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ala.position.set(Math.cos(a) * 1.6, -0.2, Math.sin(a) * 1.6); ala.rotation.y = -a;
    orion.add(ala);
  }
  const toberaO = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 16, 1, true), mat(0x6d717c, { metalness: 0.8 }));
  toberaO.position.y = -0.85; orion.add(toberaO);
  orion.visible = false;
  escena.add(orion);

  // Módulo de aterrizaje (el mismo del juego: dorado, con patas)
  const lander = FABRICAS.lander();
  lander.scale.setScalar(0.85);
  lander.visible = false;
  const fuegoLander = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  fuegoLander.rotation.x = Math.PI; fuegoLander.position.y = -0.8;
  lander.add(fuegoLander);
  lander.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  escena.add(lander);

  // Partículas: fuego (aditivo), humo de la plataforma y polvo del aterrizaje
  const fuegoP = sistemaParticulas(1400, { aditivo: true, tam: 0.9, color: 0xfff1c4 });
  const humoP = sistemaParticulas(1800, { aditivo: false, tam: 3.2, color: 0xe9e6e0 });
  const polvoP = sistemaParticulas(900, { aditivo: false, tam: 2.4, color: marte ? 0xd59a72 : 0xc9cbd4 });
  escena.add(fuegoP.pts, humoP.pts, polvoP.pts);

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
      const a = 0.6 + t * 0.2;
      camara.position.set(Math.sin(a) * 15, 5 + Math.sin(t * 0.4) * 0.6, Math.cos(a) * 15);
      camara.lookAt(0, 4.5, 0);
      if (Math.random() < 0.4) humoP.emitir(0.6, 2, 0.6, 0.3, 0.6, 0.2, 2.5, 0.3); // vapor del combustible frío
    } else if (modo === 'despegue') {
      const tl = Math.max(0, t - 0.9); // 0,9 s de cuenta regresiva
      const encendido = t > 0.45;
      fuego.visible = encendido;
      nave.position.y = BASE_COHETE + tl * tl * 3.6;
      const yb = nave.position.y;
      if (encendido) {
        // Fuego de los 3 motores y nubes de humo que salen por el foso hacia los lados
        for (let i = 0; i < 18; i++) { const x = [0, -0.82, 0.82][i % 3]; fuegoP.emitir(x, yb - 0.2, 0, 0, -9 - Math.random() * 5, 0, 0.35, 0.25); }
        if (yb < 9) for (let i = 0; i < 10; i++) { const lado = Math.random() < 0.5 ? -1 : 1; humoP.emitir(0, 0.8, lado * 2, (Math.random() - 0.5) * 6, 1 + Math.random() * 2.5, lado * (9 + Math.random() * 6), 2.6, 1.2); }
        else for (let i = 0; i < 4; i++) humoP.emitir(nave.position.x, yb - 1.5, 0, (Math.random() - 0.5) * 1.2, -2 - Math.random() * 2, (Math.random() - 0.5) * 1.2, 3, 0.6);
      }
      luzMotor.intensity = encendido ? 60 + Math.random() * 25 : 0;
      luzMotor.position.set(0, yb - 1.5, 1.5);
      // La cámara tiembla con el rugido de los motores y sigue al cohete
      const temblor = encendido ? Math.max(0, 0.18 - tl * 0.04) : 0;
      camara.position.set(14 + (Math.random() - 0.5) * temblor, 3 + Math.min(yb, 60) * 0.5 + (Math.random() - 0.5) * temblor, 16);
      camara.lookAt(0, yb + 2.5, 0);
      const k = Math.min(1, Math.max(0, (nave.position.y - 8) / 40));
      cielo.copy(azul).lerp(negro, k);
      estrellas.material.opacity = k;
    } else if (modo === 'viaje') {
      const k = Math.min(1, t / 3.3);
      const s = k * k * (3 - 2 * k);
      const p = ruta.getPointAt(s), d = ruta.getTangentAt(s);
      orion.position.copy(p);
      orion.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      orion.scale.setScalar(0.8);
      fuegoP.emitir(p.x - d.x * 1.1, p.y - d.y * 1.1, p.z - d.z * 1.1, -d.x * 3, -d.y * 3, -d.z * 3, 0.25, 0.05);
      tierra.rotation.y += dt * 0.3;
      destino.rotation.y += dt * 0.2;
      camara.position.set(0, 6, 30);
      camara.lookAt(0, 3, -8);
    } else if (modo === 'aterrizaje') {
      const k = Math.min(1, t / 2.2);
      const s = 1 - (1 - k) ** 3;
      lander.position.set(4.5, (1 - s) * 30, 2);
      fuegoLander.visible = k < 0.97;
      fuegoLander.scale.set(1, 0.7 + Math.random() * 0.5, 1);
      if (k > 0.6 && k < 0.98) for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2; polvoP.emitir(4.5, 0.2, 2, Math.cos(a) * 7, 0.4 + Math.random(), Math.sin(a) * 7, 1.6, 0.5); }
      luzMotor.intensity = k < 0.97 ? 25 : 0;
      luzMotor.position.set(4.5, lander.position.y - 1, 2);
      camara.position.set(13, 5, 16);
      camara.lookAt(-1.5, 2 + (1 - s) * 7, 0);
      bandera.rotation.y = Math.sin(t * 2) * 0.05;
    }
    fuegoP.actualizar(dt, 0.9);
    humoP.actualizar(dt, 0.95, 0.9);
    polvoP.actualizar(dt, 0.93, marte ? 0.3 : -0.4);
    renderer.render(escena, camara);
  });

  return {
    fase(nombre) {
      if (!viva) return;
      modo = nombre;
      t0 = performance.now();
      nave.position.set(0, BASE_COHETE, 0);
      nave.userData.fuego.visible = false;
      fuegoP.vaciar(); humoP.vaciar(); polvoP.vaciar();
      luzMotor.intensity = 0;
      const enTierra = nombre === 'carga' || nombre === 'despegue';
      nave.visible = enTierra;
      orion.visible = nombre === 'viaje';
      lander.visible = nombre === 'aterrizaje';
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
      pmrem.dispose();
      escena.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
