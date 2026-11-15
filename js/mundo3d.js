// Mundo 3D de ASU STELLAR · Horizonte: terreno lunar, cielo, luces, base, efectos y cámara cinematográfica de la portada.
// La simulación (sim.js) no sabe nada de esto: la interfaz le pasa el estado con mundo.actualizar({...}).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { FABRICAS, blindaje as crearBlindaje } from './modelos3d.js';
import { crearAstronauta, vestirAstronauta, caminar } from './astronauta3d.js';
import { FABRICAS_OBJETOS, POS_OBJETOS, ESCALA_OBJETOS, animarObjeto } from './objetos3d.js';
import { crearPlataforma, crearRocas } from './plataforma3d.js';
import { altura, alturaMalla, crearTerreno, crearViaLactea, crearExploracion, PUNTOS, alturaPunto, RADIO_EXPLORAR, rover as crearRover } from './terreno3d.js';

/** ¿Hay WebGL? Si no, deja en `soportaWebGL.motivo` lo que dijo el navegador (p. ej. que bloqueó el 3D en este sitio). */
export function soportaWebGL() {
  soportaWebGL.motivo = '';
  try {
    const c = document.createElement('canvas');
    c.addEventListener('webglcontextcreationerror', (e) => { soportaWebGL.motivo = e.statusMessage || ''; }, { once: true });
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (err) { soportaWebGL.motivo = err.message; return false; }
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

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
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

function texturaNubes() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 140; i++) {
    const x = hash(i, 31) * 512, y = 20 + hash(i, 32) * 216, r = 6 + hash(i, 33) * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.7, hash(i, 34), 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaAro() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 30, 64, 64, 62);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.75, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function crearSatelite() {
  const g = new THREE.Group();
  const luz = new THREE.Mesh(new THREE.SphereGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xff5555, emissive: 0xff3030, emissiveIntensity: 1 }));
  luz.position.y = 2.2;
  g.add(luz);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: 0.8, roughness: 0.3 })));
  const panel = new THREE.MeshStandardMaterial({ color: 0x1b2a6b, emissive: 0x0a1440, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 3), panel);
    p.position.x = s * 6.2;
    g.add(p);
  }
  g.scale.setScalar(1.6);
  return g;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.calidad === 'alta' ? 1.5 : 1.25)); // menos carga para la tarjeta gráfica
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Reflejos suaves de un "estudio" en los metales y paneles (PBR más rico, sin descargar mapas HDR)
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color(0x02030a);
    try {
      this.escena.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.escena.environmentIntensity = 0.14;
    } catch (err) { console.warn('Sin reflejos de entorno:', err.message); } // algunas tarjetas gráficas no lo soportan
    this.camara = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
    this.camara.position.set(40, 30, 40);

    this.controles = new OrbitControls(this.camara, canvas);
    this.controles.target.set(0, 1, 0);
    this.controles.enableDamping = true;
    this.controles.enablePan = true;           // clic derecho / dos dedos: moverse por el mapa
    this.controles.screenSpacePanning = false; // se desliza sobre el suelo
    this.controles.panSpeed = 1.4;
    this.controles.minDistance = 10;
    this.controles.maxDistance = 190;
    this.controles.keyPanSpeed = 22;
    this.controles.listenToKeyEvents(window);  // flechas para moverse
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

    if (this.calidad === 'alta') try {
      // Antialias (MSAA) dentro del compositor: sin esto los bordes se ven dentados con el bloom
      const destino = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: window.devicePixelRatio > 1 ? 2 : 4 });
      this.composer = new EffectComposer(this.renderer, destino);
      this.composer.addPass(new RenderPass(this.escena, this.camara));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.45, 0.86);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      // Viñeta y grano de película: acabado de cine
      this.cine = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, t: { value: 0 }, fuerza: { value: 0.35 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform float t; uniform float fuerza; varying vec2 vUv;
          float azar(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + t) * 43758.5453); }
          void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; float v = smoothstep(.85, .25, length(d * vec2(1.1, 1.))); 
            c.rgb *= mix(1. - fuerza, 1., v); c.rgb += (azar(vUv * 913.) - .5) * .025; gl_FragColor = c; }`,
      });
      this.composer.addPass(this.cine);
    } catch (err) {
      console.warn('Sin posprocesado:', err.message); // se dibuja directo, sin bloom ni viñeta
      this.composer = null;
      this.cine = null;
    }

    this.#cargarModelosBlender();
    this.redimensionar = this.redimensionar.bind(this);
    window.addEventListener('resize', this.redimensionar);
    this.redimensionar();
    this.animar = this.animar.bind(this);
    this.renderer.setAnimationLoop(this.animar);
    // Tocar un módulo (sin arrastrar): ficha del módulo y un astronauta camina hasta él
    let toque = null;
    canvas.addEventListener('pointerdown', (ev) => { toque = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', (ev) => {
      if (!toque || Math.hypot(ev.clientX - toque.x, ev.clientY - toque.y) > 6 || performance.now() - toque.t > 450) return;
      this.#tocar(ev);
    });
    canvas.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); window.dispatchEvent(new CustomEvent('mundo-perdido')); });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
    document.addEventListener('visibilitychange', () => this.renderer.setAnimationLoop(document.hidden || this.pausado ? null : this.animar));
  }

  /** Pausa el dibujo (por ejemplo durante la escena del viaje) y lo reanuda. */
  pausar() { this.pausado = true; this.renderer.setAnimationLoop(null); }
  reanudar() { this.pausado = false; if (!document.hidden) this.renderer.setAnimationLoop(this.animar); }

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
    if (tipo === 'astronauta') { const a = crearAstronauta(); a.scale.setScalar(1.25); return a; }
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
    this.viaLactea = crearViaLactea();
    this.escena.add(this.viaLactea);

    const tierra = new THREE.Mesh(new THREE.SphereGeometry(22, 48, 32), new THREE.MeshStandardMaterial({ map: texturaTierra(), roughness: 0.8, emissive: 0x0a1a40, emissiveIntensity: 0.4 }));
    tierra.position.set(-300, 75, -380);
    tierra.rotation.z = 0.4;
    // Nubes y atmósfera (brillo en el borde, efecto Fresnel)
    const nubes = new THREE.Mesh(new THREE.SphereGeometry(22.4, 48, 32), new THREE.MeshStandardMaterial({ map: texturaNubes(), transparent: true, depthWrite: false, roughness: 1 }));
    tierra.add(nubes);
    this.nubes = nubes;
    tierra.add(new THREE.Mesh(new THREE.SphereGeometry(25, 48, 32), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.); gl_FragColor = vec4(.35, .65, 1., 1.) * f * 1.6; }',
    })));
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
    // Destello de lente del Sol
    if (this.calidad !== 'baja') try {
      const luzDestello = new THREE.PointLight(0xffffff, 0, 1);
      luzDestello.position.copy(this.solVisible.position);
      const halo = texturaHalo(['rgba(255,255,255,1)', 'rgba(255,220,160,.3)']);
      const aro = texturaAro();
      this.destello = new Lensflare();
      this.destello.addElement(new LensflareElement(halo, 260, 0, new THREE.Color(1, 0.95, 0.85)));
      for (const [tam, dist, col] of [[60, 0.4, [0.6, 0.8, 1]], [90, 0.6, [1, 0.6, 1]], [140, 0.85, [0.5, 1, 0.9]], [50, 1, [1, 0.9, 0.5]]]) {
        this.destello.addElement(new LensflareElement(aro, tam, dist, new THREE.Color(...col)));
      }
      luzDestello.add(this.destello);
      this.escena.add(luzDestello);
    } catch (err) { console.warn('Sin destello de lente:', err.message); this.destello = null; }
    // Un satélite cruza el cielo con su luz parpadeante
    this.satelite = crearSatelite();
    this.escena.add(this.satelite);
  }

  #terreno() {
    this.suelo = crearTerreno(this.calidad);
    this.escena.add(this.suelo);
    this.exploracion = crearExploracion(this.calidad);
    this.escena.add(this.exploracion.grupo);
    // Rover de patrulla: da vueltas alrededor de la base levantando polvo
    this.patrulla = crearRover();
    this.patrulla.scale.setScalar(0.8);
    this.escena.add(this.patrulla);
    const nPolvo = 60, pp = new Float32Array(nPolvo * 3);
    this.polvoRover = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pp, 3)),
      new THREE.PointsMaterial({ color: 0xb8b2a8, size: 0.35, transparent: true, opacity: 0.55, depthWrite: false }));
    this.polvoRover.userData = { vida: new Float32Array(nPolvo), i: 0 };
    this.escena.add(this.polvoRover);
    // Plataforma de la base (losas, caminos, pista y luces) y rocas alrededor
    this.plataforma = crearPlataforma();
    this.escena.add(this.plataforma.grupo);
    this.rocas = crearRocas(altura, this.calidad === 'baja' ? 380 : 1100, 330);
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
    this.escena.add(this.sol.target);
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
    // Los módulos nuevos (que no estaban en la base anterior) bajan del cielo con un rebote
    const antes = this.conteoAnterior || null;
    const conteo = {};
    const poner = (tipo, x, z, extra = {}) => {
      const m = this.#fabricar(tipo);
      m.position.set(x, SUELO_Y, z);
      if (extra.rot) m.rotation.y = extra.rot;
      m.userData.tipo = tipo;
      conteo[tipo] = (conteo[tipo] || 0) + 1;
      if (antes && conteo[tipo] > (antes[tipo] || 0) && !this.quieto) m.userData.entra = 0;
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

    this.conteoAnterior = conteo;
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

  /** fn(tipo) se llama cuando el jugador toca un módulo en el diseño o en la misión. */
  alTocar(fn) { this.alTocarModulo = fn; }

  #tocar(ev) {
    if (this.cinematica || !['diseno', 'mision'].includes(this.modo)) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), this.camara);
    const [hit] = ray.intersectObjects([...this.modulos, ...(this.grupoObjetos?.children || [])], true);
    if (!hit) return;
    let o = hit.object;
    while (o && !o.userData.tipo) o = o.parent;
    if (!o) return;
    if (o.userData.tipo !== 'obj-dron') this.#caminarHacia(o.position);
    this.enfocar(o);
    this.alTocarModulo?.(o.userData.tipo);
  }

  /** Lleva la cámara a primer plano del objeto (módulo, objeto de la base). */
  enfocar(o) {
    const caja = new THREE.Box3().setFromObject(o);
    const centro = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3());
    const r = Math.max(tam.x, tam.y, tam.z);
    const lejos = Math.max(4.5, r * 1.9) * (window.innerHeight > window.innerWidth ? 1.5 : 1);
    const dir = this.camara.position.clone().sub(centro).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 1);
    dir.normalize();
    this.controles.minDistance = 2;
    this.controles.autoRotate = false;
    this.enfocado = true;
    if (this.capaEtiquetas) this.capaEtiquetas.hidden = true; // en primer plano, sin etiquetas encima
    this.#volar(centro.clone(), centro.clone().addScaledVector(dir, lejos).add(new THREE.Vector3(0, Math.max(1.8, r * 0.7), 0)), 1.1);
  }

  /** Sale del primer plano y vuelve a la vista de la pantalla actual. */
  soltarEnfoque() {
    if (!this.enfocado) return;
    this.enfocado = false;
    this.vista(this.modo);
  }

  /** Objetos decorativos de la base (ids de recompensas.js). */
  objetos(ids = []) {
    const clave = ids.slice().sort().join(',');
    if (clave === this.claveObjetos) return;
    this.claveObjetos = clave;
    if (this.grupoObjetos) { this.escena.remove(this.grupoObjetos); this.#limpiar(this.grupoObjetos); }
    this.grupoObjetos = new THREE.Group();
    for (const id of ids) {
      const f = FABRICAS_OBJETOS[id];
      if (!f) continue;
      const o = f();
      const [x, z] = POS_OBJETOS[id];
      o.position.set(x, Math.max(altura(x, z), SUELO_Y - 0.05), z);
      o.rotation.y = Math.atan2(-x, -z) || 0; // mirando a la base
      o.scale.setScalar(ESCALA_OBJETOS);
      o.userData.tipo = id;
      o.userData.id = id;
      o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      this.grupoObjetos.add(o);
    }
    this.escena.add(this.grupoObjetos);
  }

  /** Colores de cada astronauta: [{ traje, acento, visor }] (números hex). */
  vestir(colores = []) {
    this.colores = colores;
    this.astronautas.forEach((a, i) => this.#pintarAstronauta(a, colores[i]));
  }

  #pintarAstronauta(a, c) {
    if (c) vestirAstronauta(a, c);
  }

  /** Módulos y objetos de la base como círculos en el suelo (x, z, radio), para que nadie los atraviese. */
  #obstaculos() {
    const lista = [];
    const sumar = (o) => {
      if (!o?.visible) return;
      if (o.userData.radioSuelo == null) {
        const caja = new THREE.Box3().setFromObject(o), tam = caja.getSize(new THREE.Vector3());
        o.userData.radioSuelo = Math.max(0.6, Math.hypot(tam.x, tam.z) / 2 * 0.85);
        o.userData.centroSuelo = caja.getCenter(new THREE.Vector3());
      }
      lista.push([o.userData.centroSuelo.x, o.userData.centroSuelo.z, o.userData.radioSuelo + 0.45]);
    };
    for (const m of this.modulos || []) if (!(m.userData.entra < 1)) sumar(m);
    for (const o of this.grupoObjetos?.children || []) if (o.userData.id !== 'obj-dron') sumar(o);
    return lista;
  }

  /** Si un astronauta quedó dentro de un módulo u objeto, lo empuja hacia afuera (rodea en vez de atravesar). */
  #esquivar(as, obstaculos) {
    for (const [ox, oz, r] of obstaculos) {
      const dx = as.position.x - ox, dz = as.position.z - oz, d = Math.hypot(dx, dz);
      if (d < r && d > 1e-3) { as.position.x = ox + (dx / d) * r; as.position.z = oz + (dz / d) * r; }
    }
  }

  /** El astronauta más cercano camina hasta el módulo, se queda un rato y vuelve a su ronda. */
  #caminarHacia(pos) {
    const visibles = this.astronautas.filter((a) => a.visible);
    if (!visibles.length) return;
    const a = visibles.reduce((m, x) => (x.position.distanceTo(pos) < m.position.distanceTo(pos) ? x : m));
    const haciaCentro = new THREE.Vector3(-pos.x, 0, -pos.z).normalize().multiplyScalar(2.4);
    a.userData.destino = new THREE.Vector3(pos.x + haciaCentro.x, 0, pos.z + haciaCentro.z);
    a.userData.espera = 0;
  }

  #astronautas(n) {
    while (this.astronautas.length < n) {
      const a = this.#fabricar('astronauta');
      const i = this.astronautas.length;
      a.userData = { r: 6 + i * 1.6, v: 0.18 + i * 0.05, f: i * 1.7, dir: i % 2 ? 1 : -1 };
      this.#pintarAstronauta(a, this.colores?.[i]);
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
    this.suelo.material.color.setHex(marte ? 0xe39468 : 0xc4c7d0);
    this.viaLactea.visible = !marte;
    this.#pintarPuntos();
    this.rocas.material.color.setHex(marte ? 0x8f4f33 : 0x8b8e99);
    this.hemi.color.setHex(marte ? 0xffc79a : 0x9aa8d8);
    this.sol.color.setHex(marte ? 0xffe2c4 : 0xfff1dc);
    for (const e of this.estrellas) e.visible = !marte; // el cielo de Marte de día es color caramelo
    this.tierra.visible = this.haloTierra.visible = !marte;
    this.escena.fog = marte ? new THREE.FogExp2(0xc08a62, 0.004) : null;
  }

  /** Cambia los nombres de las etiquetas (idioma). */
  nombres(dic) {
    Object.assign(NOMBRES, dic);
    if (this.ultimaConfig) this.#crearEtiquetas(this.ultimaConfig);
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
  /** Accesibilidad: sin cámara que gira sola ni balanceo de la cámara cinematográfica. */
  movimientoReducido(on) {
    this.quieto = on;
    if (on) this.controles.autoRotate = false;
    else if (this.modo === 'portada' && !this.cinematica) this.controles.autoRotate = true;
  }

  vista(modo) {
    if (this.cinematica) { this.cinematica = null; this.controles.enabled = true; }
    this.modo = modo;
    this.enfocado = false;
    this.controles.minDistance = 10;
    this.controles.autoRotate = modo === 'portada' && !this.quieto;
    const destino = { portada: [44, 26, 44], diseno: [30, 40, 34], mision: [32, 24, 30], resultado: [26, 18, 28] }[modo] || [40, 30, 40];
    this.#volar(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...destino));
    if (this.capaEtiquetas) this.capaEtiquetas.hidden = modo !== 'diseno';
    this.#cerrarFicha();
    if (this.capaPuntos) this.capaPuntos.hidden = !(modo === 'mision' || modo === 'diseno');
    if (modo === 'mision') this.#mostrarAyuda();
  }

  #animarSatelite(t) {
    const a = (t / 70) % 1 * Math.PI * 1.2 - 0.1; // cruza el cielo cada 70 s
    this.satelite.position.set(Math.cos(a) * 640 - 120, 180 + Math.sin(a) * 260, -420 + Math.sin(a * 0.7) * 120);
    this.satelite.rotation.set(t * 0.2, t * 0.3, 0);
    this.satelite.children[0].material.emissiveIntensity = (t % 1.4) < 0.12 ? 6 : 0.2;
  }

  #animarPatrulla(t, dt) {
    const r = 40, w = 0.045, ang = t * w;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r * 0.85;
    // Apoyado en el suelo de verdad: altura de la malla bajo las ruedas (no la fórmula, que puede quedar por encima)
    const suelo = (px, pz) => Math.max(alturaMalla(px, pz, this.calidad), 0.05);
    const rumbo = -ang - Math.PI / 2;
    const fx = Math.cos(rumbo), fz = -Math.sin(rumbo); // hacia adelante
    const lx = -fz, lz = fx;                            // hacia el costado
    const hD = suelo(x + fx * 1.3, z + fz * 1.3), hA = suelo(x - fx * 1.3, z - fz * 1.3);
    const hI = suelo(x + lx * 1, z + lz * 1), hR = suelo(x - lx * 1, z - lz * 1);
    const y = Math.min(hD, hA, hI, hR) * 0.4 + ((hD + hA + hI + hR) / 4) * 0.6;
    this.patrulla.position.set(x, y, z);
    this.patrulla.rotation.set(0, 0, 0);
    this.patrulla.rotation.y = rumbo;
    this.patrulla.rotateZ(Math.atan2(hD - hA, 2.6)); // cabecea con la pendiente
    this.patrulla.rotateX(Math.atan2(hR - hI, 2) * -1); // y se inclina de lado
    this.patrulla.children.forEach((c) => { if (c.geometry?.type === 'CylinderGeometry' && c.position.y === 0.5) c.rotation.z -= dt * 1.6; });
    // Polvo detrás de las ruedas
    const p = this.polvoRover.geometry.attributes.position, v = this.polvoRover.userData.vida;
    const u = this.polvoRover.userData;
    u.acum = (u.acum || 0) + dt;
    while (u.acum > 0.06) {
      u.acum -= 0.06;
      const i = u.i++ % v.length;
      p.setXYZ(i, x + (Math.random() - 0.5) * 1.2, y + 0.2, z + (Math.random() - 0.5) * 1.2);
      v[i] = 1;
    }
    for (let i = 0; i < v.length; i++) {
      if (v[i] <= 0) { p.setY(i, -50); continue; }
      v[i] -= dt * 0.6;
      p.setY(i, p.getY(i) + dt * 0.5);
    }
    p.needsUpdate = true;
  }

  #nubePolvo(x, z) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.3, 32), new THREE.MeshBasicMaterial({ color: 0xcfc8bd, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, SUELO_Y + 0.08, z);
    this.escena.add(m);
    (this.nubes3d ||= []).push({ mesh: m, t: 0 });
  }

  // ── Cámara cinematográfica (portada / landing) ──
  /** Activa el recorrido de cámara; p (0–1) es el avance del scroll de la landing. */
  cinematografia(p) {
    if (!this.cinematica) {
      this.cinematica = { p: 0, actual: 0 };
      this.controles.enabled = false;
      this.transicion = null;
      if (this.capaEtiquetas) this.capaEtiquetas.hidden = true;
      if (this.capaPuntos) this.capaPuntos.hidden = true;
      this.#cerrarFicha();
    }
    this.cinematica.p = Math.max(0, Math.min(1, p));
  }

  /** Vuelve a la cámara normal (el jugador la controla). */
  terminarCinematografia(modo = 'portada') {
    if (!this.cinematica) return;
    this.cinematica = null;
    this.controles.enabled = true;
    this.vista(modo);
  }

  #moverCinematica(dt) {
    const c = this.cinematica;
    c.actual += (c.p - c.actual) * (1 - Math.exp(-dt * 3)); // suaviza el scroll
    const t = this.reloj.elapsedTime;
    // Recorrido: la Tierra sobre el horizonte → la base desde lo alto → de cerca → la antena y el rover → vista final
    const pos = [[-60, 60, 230], [150, 110, 170], [52, 22, 58], [88, 18, 70], [-20, 70, 120]];
    const mira = [[-300, 75, -380], [0, 0, 0], [0, 3, 0], [PUNTOS.antena.x, 8, PUNTOS.antena.z], [0, 2, 0]];
    const curva = (lista) => new THREE.CatmullRomCurve3(lista.map((x) => new THREE.Vector3(...x)));
    this.curvaPos ||= curva(pos);
    this.curvaMira ||= curva(mira);
    const s = c.actual;
    this.camara.position.copy(this.curvaPos.getPoint(s));
    // Respiración leve de la cámara (se siente viva aunque no se haga scroll)
    if (!this.quieto) {
      this.camara.position.x += Math.sin(t * 0.25) * 2;
      this.camara.position.y += Math.sin(t * 0.33) * 1.2;
    }
    const objetivo = this.curvaMira.getPoint(s);
    this.controles.target.copy(objetivo);
    this.camara.lookAt(objetivo);
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

  /**
   * Calidad automática: mide los cuadros por segundo y, si el equipo no da abasto, baja un escalón
   * (1: sin posproceso, 2: menos resolución, 3: sin sombras). No sube de nuevo para no parpadear.
   */
  #vigilarRendimiento() {
    const ahora = performance.now();
    const r = this.rend ||= { desde: ahora + 4000, cuadros: 0, escalon: 0 }; // los primeros 4 s (carga) no cuentan
    if (ahora < r.desde || document.hidden) { r.cuadros = 0; r.inicio = ahora; return; }
    r.inicio ??= ahora;
    r.cuadros += 1;
    if (ahora - r.inicio < 3000) return;
    const fps = (r.cuadros * 1000) / (ahora - r.inicio);
    r.cuadros = 0; r.inicio = ahora; this.fps = Math.round(fps);
    if (fps >= 24 || r.escalon >= 3) return;
    r.escalon += 1;
    if (r.escalon === 1 && this.composer) { this.composer = null; if (this.destello) this.destello.visible = false; }
    else if (r.escalon <= 2) { r.escalon = 2; this.renderer.setPixelRatio(Math.min(1, window.devicePixelRatio) * 0.8); this.redimensionar(); }
    else { this.renderer.shadowMap.enabled = false; this.sol.castShadow = false; this.escena.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    this.calidadAuto = r.escalon;
    window.dispatchEvent(new CustomEvent('mundo-calidad', { detail: { escalon: r.escalon, fps: Math.round(fps) } }));
  }

  animar() {
    this.#vigilarRendimiento();
    const dt = Math.min(this.reloj.getDelta(), 0.05);
    const t = this.reloj.elapsedTime;
    const k = 1 - Math.exp(-dt * 2.5);
    for (const clave of Object.keys(this.objetivo)) this.actual[clave] += (this.objetivo[clave] - this.actual[clave]) * k;
    const a = this.actual;

    this.sol.intensity = a.sol;
    this.hemi.intensity = a.hemi;
    this.escena.environmentIntensity = 0.04 + Math.min(1, a.sol / 3.4) * 0.1;
    if (this.destello) this.destello.visible = this.planeta === 'luna' && a.sol > 1.5;
    if (this.cine) this.cine.uniforms.t.value = t % 10;
    this.nubes.rotation.y += dt * 0.012;
    this.#animarSatelite(t);
    this.#animarPatrulla(t, dt);
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
    const obstaculos = this.#obstaculos();
    for (const as of this.astronautas) {
      if (!as.visible) continue;
      const u = as.userData;
      if (u.destino) { // camina hacia el módulo que tocó el jugador
        const d = new THREE.Vector3(u.destino.x - as.position.x, 0, u.destino.z - as.position.z);
        const dist = d.length();
        if (dist > 0.15) {
          d.normalize().multiplyScalar(Math.min(dist, dt * 3.2));
          as.position.x += d.x; as.position.z += d.z;
          as.position.y = SUELO_Y + Math.abs(Math.sin(t * 9)) * 0.08;
          as.rotation.y = Math.atan2(d.x, d.z);
          caminar(as, t * 9, 0.6);
        } else if (caminar(as, 0, 0), (u.espera += dt) > 6) { // vuelve a su ronda desde donde está
          u.r = Math.max(4, Math.hypot(as.position.x, as.position.z));
          u.f = Math.atan2(as.position.z, as.position.x) - t * u.v * u.dir;
          u.destino = null;
        }
        continue;
      }
      const ang = u.f + t * u.v * u.dir;
      as.position.set(Math.cos(ang) * u.r, SUELO_Y + Math.abs(Math.sin(t * 4 + u.f)) * 0.06, Math.sin(ang) * u.r);
      caminar(as, t * 4 + u.f, 0.45);
      as.rotation.y = -ang + (u.dir > 0 ? Math.PI : 0);
    }

    for (const as of this.astronautas) if (as.visible) this.#esquivar(as, obstaculos); // rodean módulos y objetos

    if (this.grupoObjetos) for (const o of this.grupoObjetos.children) animarObjeto(o, t);

    // Módulos que aterrizan: caen, rebotan y levantan polvo
    for (const m of this.modulos) {
      const u = m.userData;
      if (u.entra === undefined || u.entra >= 1) continue;
      u.entra = Math.min(1, u.entra + dt * 1.8);
      const k = u.entra, c1 = 1.70158, c3 = c1 + 1;
      const rebote = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); // easeOutBack
      m.position.y = SUELO_Y + (1 - Math.min(1, k * 1.25)) * 9;
      m.scale.setScalar(Math.max(0.01, rebote));
      if (k >= 0.8 && !u.polvo) { u.polvo = true; this.#nubePolvo(m.position.x, m.position.z); }
      if (k >= 1) { m.scale.setScalar(1); m.position.y = SUELO_Y; }
    }
    if (this.nubes3d?.length) {
      for (const n of this.nubes3d) { n.t += dt; n.mesh.scale.setScalar(1 + n.t * 5); n.mesh.material.opacity = Math.max(0, 0.6 - n.t * 0.8); }
      this.nubes3d = this.nubes3d.filter((n) => { if (n.t > 0.8) { this.escena.remove(n.mesh); n.mesh.geometry.dispose(); n.mesh.material.dispose(); return false; } return true; });
    }

    // Anillo de resaltado
    if (this.anillo.material.opacity > 0) this.anillo.material.opacity = Math.max(0, this.anillo.material.opacity - dt * 0.7);

    // Transición de cámara
    if (this.transicion) {
      const tr = this.transicion;
      tr.t = Math.min(1, (this.reloj.elapsedTime - tr.inicio) * tr.vel); // tiempo real: llega igual aunque el equipo sea lento
      const s = tr.t * tr.t * (3 - 2 * tr.t);
      this.camara.position.lerpVectors(tr.desde, tr.hasta, s);
      this.controles.target.lerpVectors(tr.objDesde, tr.objHasta, s);
      if (tr.t >= 1) this.transicion = null;
    }
    this.#limitarExploracion();
    for (const b of this.exploracion.balizas) b.material.emissiveIntensity = (t * 0.9 + b.position.y) % 1 < 0.15 ? 4 : 0.4;
    this.exploracion.hielo.material.opacity = 0.55 + Math.sin(t * 3) * 0.35;
    // La sombra sigue a lo que mira la cámara
    this.sol.target.position.copy(this.controles.target);
    this.sol.position.copy(this.controles.target).addScaledVector(this.dirSol, 80);
    this.tierra.rotation.y += dt * 0.02;
    if (this.cinematica) this.#moverCinematica(dt);
    else this.controles.update(dt);

    // Etiquetas HTML sobre los módulos
    if (this.capaEtiquetas && !this.capaEtiquetas.hidden) {
      const w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
      for (const e of this.etiquetas) {
        v.copy(e.pos).project(this.camara);
        e.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
        e.el.style.opacity = v.z < 1 ? 1 : 0;
      }
    }

    if (this.capaPuntos && !this.capaPuntos.hidden) {
      const w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
      const vertical = h > w; // margen: no tapar el HUD de arriba, los botones del costado ni la barra de abajo
      const MX = vertical ? 0.5 : 0.86, MY = vertical ? 0.42 : 0.62;
      for (const pin of this.pines) {
        v.copy(pin.pos).project(this.camara);
        const detras = v.z > 1;
        let x = v.x, y = v.y;
        if (detras) { x = -x; y = -y; }
        const dentro = !detras && Math.abs(x) < MX && Math.abs(y) < MY;
        if (!dentro) { // marcador en el borde, apuntando hacia el lugar
          const k = Math.min(MX / Math.max(Math.abs(x), 1e-3), MY / Math.max(Math.abs(y), 1e-3));
          x *= k; y *= k;
          pin.flecha.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
          pin.dist.textContent = `${Math.round(Math.hypot(pin.pos.x - this.controles.target.x, pin.pos.z - this.controles.target.z))} m`;
        }
        pin.el.classList.toggle('borde', !dentro);
        pin.el.style.transform = `translate(-50%, ${dentro ? '-100%' : '-50%'}) translate(${((x + 1) / 2) * w}px, ${((1 - y) / 2) * h}px)`;
      }
    }

    if (this.composer) this.composer.render(); else this.renderer.render(this.escena, this.camara);
  }

  // ── Exploración ──
  #volar(objetivo, posicion, vel = 0.8) {
    this.transicion = { desde: this.camara.position.clone(), hasta: posicion, objDesde: this.controles.target.clone(), objHasta: objetivo, t: 0, vel, inicio: this.reloj.elapsedTime };
  }

  /** La cámara no sale del mapa ni se mete bajo el suelo. */
  #limitarExploracion() {
    const o = this.controles.target;
    const d = Math.hypot(o.x, o.z);
    if (d > RADIO_EXPLORAR) {
      const k = RADIO_EXPLORAR / d, dx = o.x * (k - 1), dz = o.z * (k - 1);
      o.x += dx; o.z += dz; this.camara.position.x += dx; this.camara.position.z += dz;
    }
    if (!this.transicion) {
      const suelo = Math.max(altura(o.x, o.z), 0) + 1;
      this.camara.position.y += (suelo - o.y) * 0.1;
      o.y += (suelo - o.y) * 0.1;
    }
    const minCam = altura(this.camara.position.x, this.camara.position.z) + 2.5;
    if (this.camara.position.y < minCam) this.camara.position.y = minCam;
  }

  /** Textos de los puntos de interés (traducidos): { id: { nombre, texto, textoMarte } } y textos de ayuda. */
  puntos(info, ayuda) {
    this.infoPuntos = info;
    this.textoAyuda = ayuda;
    this.#pintarPuntos();
  }

  #pintarPuntos() {
    if (!this.infoPuntos) return;
    if (!this.capaPuntos) {
      this.capaPuntos = document.createElement('div');
      this.capaPuntos.id = 'puntos';
      this.capaPuntos.hidden = true;
      this.canvas.after(this.capaPuntos);
      this.renderer.domElement.addEventListener('dblclick', (ev) => this.#irAlSuelo(ev));
    }
    this.capaPuntos.querySelectorAll('.pin').forEach((x) => x.remove());
    this.pines = Object.entries(this.infoPuntos).map(([id, info]) => {
      const el = document.createElement('button');
      el.className = 'pin';
      el.dataset.punto = id;
      el.innerHTML = `<span class="pin-icono" aria-hidden="true"><svg class="i"><use href="icons/sprite.svg#i-${info.icono || id}"></use></svg></span><span class="pin-nombre">${info.nombre} <small class="pin-dist"></small></span><span class="pin-flecha" aria-hidden="true"></span>`;
      el.setAttribute('aria-label', info.nombre);
      el.addEventListener('click', () => this.irA(id));
      this.capaPuntos.appendChild(el);
      return { el, flecha: el.querySelector('.pin-flecha'), dist: el.querySelector('.pin-dist'), pos: new THREE.Vector3(PUNTOS[id].x, alturaPunto(id), PUNTOS[id].z) };
    });
  }

  /** Vuela la cámara hasta un punto de interés y muestra su ficha. */
  irA(id) {
    const { x, z } = PUNTOS[id];
    const y = altura(x, z);
    const desde = new THREE.Vector3(x, y + 1, z).sub(this.camara.position).setY(0).normalize();
    const lejos = (id === 'hielo' ? 55 : 14) * (window.innerHeight > window.innerWidth ? 1.5 : 1);
    this.controles.minDistance = 2;
    this.enfocado = true;
    this.alVisitar?.(id);
    this.#volar(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(x - desde.x * lejos, y + lejos * 0.6, z - desde.z * lejos), 0.55);
    this.controles.autoRotate = false;
    const info = this.infoPuntos[id];
    this.#cerrarFicha();
    const f = document.createElement('div');
    f.className = 'ficha-punto';
    f.innerHTML = `<b>${info.nombre}</b><p>${this.planeta === 'marte' && info.textoMarte ? info.textoMarte : info.texto}</p><button class="fantasma chico"><svg class="i" aria-hidden="true"><use href="icons/sprite.svg#i-base"></use></svg> ${this.textoAyuda?.volver || 'Volver a la base'}</button>`;
    f.querySelector('button').addEventListener('click', () => this.vista(this.modo));
    this.capaPuntos.appendChild(f);
    this.ficha = f;
  }

  #cerrarFicha() { this.ficha?.remove(); this.ficha = null; }

  #irAlSuelo(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), this.camara);
    const [hit] = ray.intersectObject(this.suelo);
    if (!hit) return;
    const delta = hit.point.clone().sub(this.controles.target);
    this.#volar(hit.point.clone().setY(hit.point.y + 1), this.camara.position.clone().add(delta), 0.9);
  }

  #mostrarAyuda() {
    if (!this.textoAyuda || this.ayudaMostrada || !this.capaPuntos) return;
    this.ayudaMostrada = true;
    const a = document.createElement('div');
    a.className = 'ayuda-explorar';
    a.textContent = matchMedia('(pointer: coarse)').matches ? this.textoAyuda.tactil : this.textoAyuda.raton;
    this.capaPuntos.appendChild(a);
    setTimeout(() => a.classList.add('fuera'), 7000);
    setTimeout(() => a.remove(), 8000);
  }
}
