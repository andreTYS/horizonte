// Mundo 3D de HORIZONTE: terreno lunar, cielo, luces, base y efectos.
// La simulación (sim.js) no sabe nada de esto: la interfaz le pasa el estado con mundo.actualizar({...}).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FABRICAS, blindaje as crearBlindaje } from './modelos3d.js';
import { crearPlataforma, crearRocas } from './plataforma3d.js';

export function soportaWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// Dónde va cada módulo (metros en el mundo)
const POS = {
  habitat: [0, 0],
  panel: (i) => [-16 + (i % 5) * 2.9, -14.5 + Math.floor(i / 5) * 2.6],
  bateria: (i) => [9 + (i % 4) * 1.7, -9.5 + Math.floor(i / 4) * 1.7],
  reactor: [18, 13],
  reciclador: [-8, 7],
  invernadero: [3, 11.5],
  lander: [-18, 12],
  extractor: [-15, -1],
  moxie: [11, 4],
};
const SUELO_Y = 0.11; // altura de la plataforma donde se apoyan los módulos
const MAX_PANELES = 20;
const MAX_BATERIAS = 12;
const NOMBRES = { habitat: 'Hábitat', panel: 'Paneles', bateria: 'Baterías', reactor: 'Reactor', reciclador: 'Reciclador', invernadero: 'Invernadero', extractor: 'Extractor de hielo', moxie: 'MOXIE' };

// ── Ruido para el terreno ──
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
const fbm = (x, y) => ruido(x, y) * 0.5 + ruido(x * 2.1, y * 2.1) * 0.25 + ruido(x * 4.3, y * 4.3) * 0.125;
const CRATERES = Array.from({ length: 26 }, (_, i) => {
  const a = hash(i, 1) * Math.PI * 2, d = 30 + hash(i, 2) * 80;
  return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 3 + hash(i, 3) * 9, p: 0.6 + hash(i, 4) * 1.6 };
}).concat([{ x: 26, z: -22, r: 7, p: 1.8 }, { x: -30, z: -6, r: 5, p: 1.2 }]);

function altura(x, z) {
  const dist = Math.hypot(x, z);
  const plano = THREE.MathUtils.smoothstep(dist, 22, 34); // la base está en terreno nivelado
  let h = (fbm(x * 0.035, z * 0.035) - 0.45) * 7 * plano + (fbm(x * 0.2, z * 0.2) - 0.45) * 0.5 * plano;
  for (const c of CRATERES) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) h -= c.p * (1 - d * d) * 1.6;
    else if (d < 1.4) h += c.p * 0.5 * (1 - (d - 1) / 0.4);
  }
  return h;
}

function texturaRegolito() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const img = g.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) {
    const x = i % 512, y = Math.floor(i / 512);
    const n = fbm(x * 0.05, y * 0.05) * 0.6 + Math.random() * 0.4;
    const v = 120 + n * 90;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 1.04; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 140; i++) { // cráteres pequeños: centro oscuro y borde claro
    const x = Math.random() * 512, y = Math.random() * 512, r = 2 + Math.pow(Math.random(), 3) * 18;
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = Math.max(1, r * 0.25); g.beginPath(); g.arc(x - r * 0.15, y - r * 0.15, r, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(28, 28);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaTierra() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1d5fd1'; g.fillRect(0, 0, 512, 256);
  const mancha = (color, n, rmin, rmax, alpha) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha;
      g.beginPath();
      g.ellipse(hash(i, n) * 512, 30 + hash(i, n + 1) * 196, rmin + hash(i, 7) * rmax, (rmin + hash(i, 8) * rmax) * 0.6, hash(i, 9) * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  mancha('#3d9a56', 26, 10, 38, 0.9);
  mancha('#c9b27a', 10, 6, 18, 0.7);
  mancha('#ffffff', 60, 6, 26, 0.55);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaHalo(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, color[0]); r.addColorStop(0.25, color[1]); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Mundo {
  constructor(canvas, capaEtiquetas) {
    this.canvas = canvas;
    this.capaEtiquetas = capaEtiquetas;
    this.calidad = this.#elegirCalidad();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.calidad !== 'baja', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.calidad === 'alta' ? 2 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color(0x02030a);
    this.camara = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
    this.camara.position.set(40, 30, 40);

    this.controles = new OrbitControls(this.camara, canvas);
    this.controles.target.set(0, 1, 0);
    this.controles.enableDamping = true;
    this.controles.enablePan = false;
    this.controles.minDistance = 18;
    this.controles.maxDistance = 90;
    this.controles.maxPolarAngle = 1.32;
    this.controles.minPolarAngle = 0.35;
    this.controles.autoRotateSpeed = 0.35;

    this.reloj = new THREE.Clock();
    this.estado = { luz: true, tormenta: false, refugio: false, apagados: [], carga: 1, tripulacion: 0 };
    this.objetivo = { sol: 3.4, hemi: 0.45, tierra: 0.0, noche: 0, tormenta: 0, polvo: 0 };
    this.planeta = 'luna';
    this.actual = { ...this.objetivo };
    this.modulos = [];
    this.etiquetas = [];
    this.plantillas = {};

    this.#cielo();
    this.#terreno();
    this.#luces();
    this.#efectos();
    this.base = new THREE.Group();
    this.escena.add(this.base);

    if (this.calidad === 'alta') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.escena, this.camara));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.#cargarModelosBlender();
    this.redimensionar = this.redimensionar.bind(this);
    window.addEventListener('resize', this.redimensionar);
    this.redimensionar();
    this.animar = this.animar.bind(this);
    this.renderer.setAnimationLoop(this.animar);
    document.addEventListener('visibilitychange', () => this.renderer.setAnimationLoop(document.hidden ? null : this.animar));
  }

  #elegirCalidad() {
    try {
      const guardada = localStorage.getItem('horizonte.calidad');
      if (guardada) return guardada;
    } catch { /* sin almacenamiento */ }
    const movil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const nucleos = navigator.hardwareConcurrency || 4;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'baja';
    if (movil) return nucleos >= 8 ? 'media' : 'baja';
    return 'alta';
  }

  // Modelos hechos en Blender: si assets/modelos/manifest.json lista un .glb para un módulo, se usa ese.
  async #cargarModelosBlender() {
    try {
      const r = await fetch('assets/modelos/manifest.json', { cache: 'no-cache' });
      if (!r.ok) return;
      const lista = await r.json();
      const loader = new GLTFLoader();
      await Promise.all(Object.entries(lista).map(async ([tipo, archivo]) => {
        if (!archivo || !FABRICAS[tipo]) return;
        const gltf = await loader.loadAsync(`assets/modelos/${archivo}`);
        gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.plantillas[tipo] = gltf.scene;
      }));
      if (Object.keys(this.plantillas).length && this.ultimaConfig) this.#construirBase(this.ultimaConfig, true);
    } catch { /* sin modelos externos: se usan los procedurales */ }
  }

  #fabricar(tipo) {
    return this.plantillas[tipo] ? this.plantillas[tipo].clone(true) : FABRICAS[tipo]();
  }

  #cielo() {
    const estrellas = (n, tam, op) => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 900;
        const s = Math.sqrt(1 - u * u);
        pos.set([r * s * Math.cos(t), Math.abs(r * u) * 0.9 + 20, r * s * Math.sin(t)], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(geo, new THREE.PointsMaterial({ size: tam, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: op, fog: false }));
    };
    this.estrellas = [estrellas(2500, 1.2, 0.7), estrellas(400, 2.2, 0.95)];
    this.escena.add(...this.estrellas);

    const tierra = new THREE.Mesh(new THREE.SphereGeometry(22, 48, 32), new THREE.MeshStandardMaterial({ map: texturaTierra(), roughness: 0.8, emissive: 0x0a1a40, emissiveIntensity: 0.4 }));
    tierra.position.set(-300, 75, -380);
    tierra.rotation.z = 0.4;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHalo(['rgba(120,180,255,.9)', 'rgba(80,140,255,.35)']), blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(70); halo.position.copy(tierra.position);
    this.tierra = tierra;
    this.haloTierra = halo;
    this.escena.add(tierra, halo);

    this.dirSol = new THREE.Vector3(60, 55, 30).normalize();
    this.solVisible = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHalo(['rgba(255,255,240,1)', 'rgba(255,200,120,.6)']), blending: THREE.AdditiveBlending, depthWrite: false }));
    this.solVisible.scale.setScalar(140);
    // El Sol visible va en el mismo rumbo que la luz, más bajo en el cielo para que entre en cuadro
    this.solVisible.position.set(this.dirSol.x, 0.28, this.dirSol.z).normalize().multiplyScalar(800);
    this.escena.add(this.solVisible);
  }

  #terreno() {
    const tam = 260, seg = this.calidad === 'baja' ? 120 : 200;
    const geo = new THREE.PlaneGeometry(tam, tam, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, altura(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const tex = texturaRegolito();
    const mat = new THREE.MeshStandardMaterial({ color: 0xb4b7c2, map: tex, bumpMap: tex, bumpScale: 2.5, roughness: 0.97, metalness: 0 });
    const suelo = new THREE.Mesh(geo, mat);
    suelo.receiveShadow = true;
    this.suelo = suelo;
    this.escena.add(suelo);
    // Plataforma de la base (losas, caminos, pista y luces) y rocas alrededor
    this.plataforma = crearPlataforma();
    this.escena.add(this.plataforma.grupo);
    this.rocas = crearRocas(altura, this.calidad === 'baja' ? 160 : 340);
    this.escena.add(this.rocas);
  }

  #luces() {
    this.sol = new THREE.DirectionalLight(0xfff1dc, 3.4);
    this.sol.position.copy(this.dirSol).multiplyScalar(80);
    this.sol.castShadow = true;
    const t = this.calidad === 'alta' ? 2048 : 1024;
    this.sol.shadow.mapSize.set(t, t);
    Object.assign(this.sol.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 10, far: 220 });
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.03;
    this.hemi = new THREE.HemisphereLight(0x9aa8d8, 0x2a2622, 0.45);
    this.luzTierra = new THREE.DirectionalLight(0x6d8dff, 0);
    this.luzTierra.position.set(-300, 75, -380).normalize().multiplyScalar(80);
    this.luzHabitat = new THREE.PointLight(0xffb36b, 0, 40, 1.6);
    this.luzHabitat.position.set(0, 4, 0);
    this.luzTormenta = new THREE.AmbientLight(0xff5a2a, 0);
    this.escena.add(this.sol, this.hemi, this.luzTierra, this.luzHabitat, this.luzTormenta);
  }

  #efectos() {
    // Partículas de la tormenta solar
    const n = this.calidad === 'baja' ? 500 : 1400;
    const pos = new Float32Array(n * 6);
    this.velTormenta = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 120, y = Math.random() * 60, z = (Math.random() - 0.5) * 120;
      pos.set([x, y, z, x + 1.4, y + 2.6, z + 0.6], i * 6);
      this.velTormenta[i] = 30 + Math.random() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.tormenta = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tormenta.visible = false;
    this.escena.add(this.tormenta);

    // Escudo del refugio (efecto Fresnel)
    this.escudo = new THREE.Mesh(
      new THREE.SphereGeometry(6.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { t: { value: 0 }, color: { value: new THREE.Color(0x6fd3ff) } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform float t; uniform vec3 color; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(1.-abs(dot(vN,vV)), 2.2); float bandas = .55+.45*sin(vY*6.-t*3.); gl_FragColor = vec4(color, (f*.9+.06)*bandas); }',
      }),
    );
    this.escudo.visible = false;
    this.escena.add(this.escudo);

    // Anillo para resaltar el módulo que se acaba de cambiar
    this.anillo = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 48), new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.anillo.rotation.x = -Math.PI / 2;
    this.anillo.position.y = 0.08;
    this.escena.add(this.anillo);

    // Astronautas
    this.astronautas = [];
  }

  #limpiar(grupo) {
    grupo.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.compartida) o.geometry.dispose(); });
    grupo.clear();
  }

  #construirBase(c, forzar = false) {
    const clave = JSON.stringify([c.panel, c.bateria, c.reactor, c.reciclador, c.invernadero, c.blindaje, c.extractor, c.moxie]);
    if (!forzar && clave === this.claveBase) return;
    this.claveBase = clave;
    this.ultimaConfig = { ...c };
    this.#limpiar(this.base);
    this.modulos = [];
    const poner = (tipo, x, z, extra = {}) => {
      const m = this.#fabricar(tipo);
      m.position.set(x, SUELO_Y, z);
      if (extra.rot) m.rotation.y = extra.rot;
      m.userData.tipo = tipo;
      this.base.add(m);
      this.modulos.push(m);
      return m;
    };
    poner('habitat', ...POS.habitat);
    const b = crearBlindaje(c.blindaje);
    b.position.y = SUELO_Y;
    this.base.add(b);
    poner('lander', ...POS.lander, { rot: 0.4 });
    for (let i = 0; i < Math.min(c.panel, MAX_PANELES); i++) poner('panel', ...POS.panel(i), { rot: Math.PI });
    for (let i = 0; i < Math.min(c.bateria, MAX_BATERIAS); i++) poner('bateria', ...POS.bateria(i));
    if (c.reactor) poner('reactor', ...POS.reactor);
    if (c.reciclador) poner('reciclador', ...POS.reciclador, { rot: 0.5 });
    if (c.invernadero) poner('invernadero', ...POS.invernadero);
    if (c.extractor) poner('extractor', ...POS.extractor, { rot: 0.3 });
    if (c.moxie) poner('moxie', ...POS.moxie, { rot: -0.4 });

    // Cables hacia el hábitat
    const cable = new THREE.MeshStandardMaterial({ color: 0x2b2f3d, roughness: 0.7, emissive: 0xff8a2a, emissiveIntensity: 0.25 });
    const unir = (x, z) => {
      const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.17, z), new THREE.Vector3(x * 0.55, 0.17, z * 0.55 + 1), new THREE.Vector3(x * 0.22, 0.17, z * 0.22), new THREE.Vector3(0, 0.17, 0)]);
      const t = new THREE.Mesh(new THREE.TubeGeometry(curva, 40, 0.07, 6), cable);
      this.base.add(t);
    };
    if (c.panel) unir(-8, -9);
    if (c.bateria) unir(10, -8);
    if (c.reactor) unir(...POS.reactor);
    if (c.reciclador) unir(...POS.reciclador);
    if (c.invernadero) unir(...POS.invernadero);
    if (c.extractor) unir(...POS.extractor);
    if (c.moxie) unir(...POS.moxie);

    this.#crearEtiquetas(c);
    this.#aplicarDinamico();
  }

  #crearEtiquetas(c) {
    if (!this.capaEtiquetas) return;
    this.capaEtiquetas.innerHTML = '';
    this.etiquetas = [];
    const centro = (lista) => {
      const v = new THREE.Vector3();
      lista.forEach((p) => v.add(new THREE.Vector3(p[0], 0, p[1])));
      return v.divideScalar(lista.length);
    };
    const agregar = (texto, pos, alto, tipo) => {
      const el = document.createElement('div');
      el.className = 'etiqueta-3d';
      el.dataset.tipo = tipo;
      el.textContent = texto;
      this.capaEtiquetas.appendChild(el);
      this.etiquetas.push({ el, pos: pos.clone().setY(alto) });
    };
    agregar(NOMBRES.habitat, new THREE.Vector3(0, 0, 0), 8, 'habitat');
    if (c.panel) agregar(`${NOMBRES.panel} ×${c.panel}`, centro(Array.from({ length: Math.min(c.panel, MAX_PANELES) }, (_, i) => POS.panel(i))), 4, 'panel');
    if (c.bateria) agregar(`${NOMBRES.bateria} ×${c.bateria}`, centro(Array.from({ length: Math.min(c.bateria, MAX_BATERIAS) }, (_, i) => POS.bateria(i))), 4, 'bateria');
    if (c.reactor) agregar(NOMBRES.reactor, new THREE.Vector3(...[POS.reactor[0], 0, POS.reactor[1]]), 6.5, 'reactor');
    if (c.reciclador) agregar(NOMBRES.reciclador, new THREE.Vector3(POS.reciclador[0], 0, POS.reciclador[1]), 3.6, 'reciclador');
    if (c.invernadero) agregar(NOMBRES.invernadero, new THREE.Vector3(POS.invernadero[0], 0, POS.invernadero[1]), 3.6, 'invernadero');
    if (c.extractor) agregar(NOMBRES.extractor, new THREE.Vector3(POS.extractor[0], 0, POS.extractor[1]), 5.5, 'extractor');
    if (c.moxie) agregar(NOMBRES.moxie, new THREE.Vector3(POS.moxie[0], 0, POS.moxie[1]), 3.4, 'moxie');
  }

  #astronautas(n) {
    while (this.astronautas.length < n) {
      const a = this.#fabricar('astronauta');
      const i = this.astronautas.length;
      a.userData = { r: 6 + i * 1.6, v: 0.18 + i * 0.05, f: i * 1.7, dir: i % 2 ? 1 : -1 };
      this.escena.add(a);
      this.astronautas.push(a);
    }
    this.astronautas.forEach((a, i) => { a.visible = i < n; });
  }

  /** Cambia la base y su estado. Todos los campos son opcionales. */
  actualizar(o) {
    if (o.config) this.#construirBase(o.config);
    Object.assign(this.estado, o);
    const e = this.estado;
    this.objetivo.sol = e.luz ? 3.4 : 0;
    this.objetivo.hemi = e.luz ? 0.45 : 0.05;
    this.objetivo.tierra = e.luz ? 0 : 0.32;
    this.objetivo.noche = e.luz ? 0 : 1;
    this.objetivo.tormenta = e.tormenta ? 1 : 0;
    this.tormenta.visible = Boolean(e.tormenta || e.polvo);
    this.tormenta.material.color.setHex(e.polvo ? 0xc9875a : 0xffb04a);
    this.objetivo.polvo = e.polvo ? 1 : 0;
    if ((e.planeta || 'luna') !== this.planeta) this.#cambiarPlaneta(e.planeta || 'luna');
    this.escudo.visible = Boolean(e.refugio);
    this.#astronautas(e.refugio ? 0 : e.tripulacion || 0);
    this.#aplicarDinamico();
  }

  #aplicarDinamico() {
    const e = this.estado;
    let panelIdx = 0;
    for (const m of this.modulos) {
      const tipo = m.userData.tipo;
      m.userData.alarma = (e.apagados || []).some((a) =>
        (tipo === 'habitat' && (a.startsWith('soporte') || a.startsWith('electrolizador'))) || a.startsWith(tipo));
      if (tipo === 'panel') {
        const danado = panelIdx++ < (e.danados || 0);
        m.rotation.z = danado ? 0.35 : 0;
        m.traverse((o) => { if (o.material?.name === 'placa') o.material.color.setHex(danado ? 0x3a2a30 : 0xffffff); });
      }
      if (tipo === 'bateria') {
        const carga = THREE.MathUtils.clamp(e.carga ?? 1, 0.02, 1);
        m.traverse((o) => {
          if (o.name === 'carga') {
            o.scale.y = carga;
            if (!o.userData.matPropio) { o.material = o.material.clone(); o.userData.matPropio = true; }
            const col = carga > 0.5 ? 0x4ade80 : carga > 0.2 ? 0xfbbf24 : 0xf87171;
            o.material.color.setHex(col); o.material.emissive.setHex(col);
          }
        });
      }
      if (tipo === 'invernadero') m.traverse((o) => { if (o.name === 'luz') o.visible = e.invernaderoOn !== false && !m.userData.alarma; });
    }
  }

  #cambiarPlaneta(planeta) {
    this.planeta = planeta;
    const marte = planeta === 'marte';
    this.suelo.material.color.setHex(marte ? 0xd98b5f : 0xb4b7c2);
    this.rocas.material.color.setHex(marte ? 0x8f4f33 : 0x8b8e99);
    this.hemi.color.setHex(marte ? 0xffc79a : 0x9aa8d8);
    this.sol.color.setHex(marte ? 0xffe2c4 : 0xfff1dc);
    for (const e of this.estrellas) e.visible = !marte; // el cielo de Marte de día es color caramelo
    this.tierra.visible = this.haloTierra.visible = !marte;
    this.escena.fog = marte ? new THREE.FogExp2(0xc08a62, 0.004) : null;
  }

  /** Destaca un tipo de módulo (al agregarlo en el diseño). */
  resaltar(tipo) {
    const m = [...this.modulos].reverse().find((x) => x.userData.tipo === tipo);
    if (!m) return;
    this.anillo.position.x = m.position.x;
    this.anillo.position.z = m.position.z;
    this.anillo.scale.setScalar(tipo === 'habitat' ? 4.5 : tipo === 'reactor' ? 3.4 : tipo === 'invernadero' ? 3 : 1.6);
    this.anillo.material.opacity = 1;
  }

  /** portada: gira sola · diseno: vista alta · mision: más cerca */
  vista(modo) {
    this.modo = modo;
    this.controles.autoRotate = modo === 'portada';
    const destino = { portada: [44, 26, 44], diseno: [30, 40, 34], mision: [32, 24, 30], resultado: [26, 18, 28] }[modo] || [40, 30, 40];
    this.transicion = { desde: this.camara.position.clone(), hasta: new THREE.Vector3(...destino), t: 0 };
    if (this.capaEtiquetas) this.capaEtiquetas.hidden = modo !== 'diseno';
  }

  redimensionar() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    // En pantallas verticales alejamos la cámara para que entre la base
    this.camara.fov = w < h ? 52 : 38;
    this.camara.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  animar() {
    const dt = Math.min(this.reloj.getDelta(), 0.05);
    const t = this.reloj.elapsedTime;
    const k = 1 - Math.exp(-dt * 2.5);
    for (const clave of Object.keys(this.objetivo)) this.actual[clave] += (this.objetivo[clave] - this.actual[clave]) * k;
    const a = this.actual;

    this.sol.intensity = a.sol;
    this.hemi.intensity = a.hemi;
    this.luzTierra.intensity = a.tierra;
    this.solVisible.material.opacity = Math.min(1, a.sol / 3.4);
    this.luzHabitat.intensity = a.noche * 90;
    this.luzTormenta.intensity = a.tormenta * (0.6 + Math.sin(t * 6) * 0.25);
    if (this.planeta === 'marte') {
      const dia = Math.min(1, a.sol / 3.4) * (1 - a.polvo * 0.45);
      this.escena.background.setRGB(0.03 + dia * 0.55, 0.02 + dia * 0.33, 0.02 + dia * 0.2);
      this.escena.fog.color.copy(this.escena.background);
      this.escena.fog.density = 0.004 + a.polvo * 0.022;
      this.sol.intensity = a.sol * (1 - a.polvo * 0.7);
    } else {
      this.escena.background.setRGB(0.008 + a.tormenta * 0.05, 0.012 + a.tormenta * 0.012, 0.04 - a.tormenta * 0.02);
    }
    for (const m of this.plataforma.luces) m.emissiveIntensity = 0.35 + a.noche * 2.2;
    for (const b of this.plataforma.balizas) b.material.emissiveIntensity = 0.3 + ((t * 1.2 + b.userData.fase) % 1 < 0.12 ? 3 : 0) + a.noche;

    // Ventanas y baliza
    this.base.traverse((o) => {
      if (o.material?.name === 'ventana') o.material.emissiveIntensity = 0.15 + a.noche * 2.6;
      if (o.name === 'baliza') o.material.emissiveIntensity = 1 + (Math.sin(t * 4) > 0 ? 3 : 0);
    });
    // Alarmas: el módulo apagado parpadea en rojo
    const pulso = (Math.sin(t * 7) + 1) / 2;
    for (const m of this.modulos) {
      if (!m.userData.alarma && !m.userData.teniaAlarma) continue;
      m.traverse((o) => {
        if (!o.isMesh || !o.material?.emissive) return;
        if (!o.userData.matOriginal) { o.userData.matOriginal = o.material; o.material = o.material.clone(); }
        if (m.userData.alarma) { o.material.emissive.setHex(0xff2a2a); o.material.emissiveIntensity = pulso * 1.2; }
        else { o.material = o.userData.matOriginal; delete o.userData.matOriginal; }
      });
      m.userData.teniaAlarma = m.userData.alarma;
    }

    // Tormenta
    if (this.tormenta.visible) {
      const p = this.tormenta.geometry.attributes.position;
      for (let i = 0; i < this.velTormenta.length; i++) {
        const d = this.velTormenta[i] * dt;
        let y = p.getY(i * 2) - d, x = p.getX(i * 2) - d * 0.55;
        if (y < -2) { y = 55 + Math.random() * 10; x = (Math.random() - 0.5) * 120 + 20; }
        p.setXYZ(i * 2, x, y, p.getZ(i * 2));
        p.setXYZ(i * 2 + 1, x + 1.4, y + 2.6, p.getZ(i * 2 + 1));
      }
      p.needsUpdate = true;
    }
    if (this.escudo.visible) this.escudo.material.uniforms.t.value = t;

    // Astronautas caminando alrededor de la base
    for (const as of this.astronautas) {
      if (!as.visible) continue;
      const u = as.userData;
      const ang = u.f + t * u.v * u.dir;
      as.position.set(Math.cos(ang) * u.r, SUELO_Y + Math.abs(Math.sin(t * 4 + u.f)) * 0.12, Math.sin(ang) * u.r);
      as.rotation.y = -ang + (u.dir > 0 ? Math.PI : 0);
    }

    // Anillo de resaltado
    if (this.anillo.material.opacity > 0) this.anillo.material.opacity = Math.max(0, this.anillo.material.opacity - dt * 0.7);

    // Transición de cámara
    if (this.transicion) {
      this.transicion.t = Math.min(1, this.transicion.t + dt * 0.8);
      const s = this.transicion.t * this.transicion.t * (3 - 2 * this.transicion.t);
      this.camara.position.lerpVectors(this.transicion.desde, this.transicion.hasta, s);
      if (this.transicion.t >= 1) this.transicion = null;
    }
    this.tierra.rotation.y += dt * 0.02;
    this.controles.update(dt);

    // Etiquetas HTML sobre los módulos
    if (this.capaEtiquetas && !this.capaEtiquetas.hidden) {
      const w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
      for (const e of this.etiquetas) {
        v.copy(e.pos).project(this.camara);
        e.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
        e.el.style.opacity = v.z < 1 ? 1 : 0;
      }
    }

    if (this.composer) this.composer.render(); else this.renderer.render(this.escena, this.camara);
  }
}
