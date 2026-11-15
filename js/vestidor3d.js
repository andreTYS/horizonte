// Probador 3D: el astronauta en grande, sobre un pedestal, girando despacio (se puede girar con el dedo).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { crearAstronauta, vestirAstronauta, caminar } from './astronauta3d.js';

export function crearVestidor(contenedorInicial) {
  let contenedor = contenedorInicial;
  const canvas = document.createElement('canvas');
  canvas.className = 'vestidor-3d';
  canvas.setAttribute('aria-hidden', 'true');
  contenedor.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.7;
  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camara.position.set(0, 1.25, 4.2);
  camara.lookAt(0, 1.0, 0);
  escena.add(new THREE.HemisphereLight(0xe6e9fb, 0x29335e, 1.4));
  const sol = new THREE.DirectionalLight(0xffffff, 2.4);
  sol.position.set(2.5, 4, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  const contra = new THREE.DirectionalLight(0x5cc8ee, 1.2);
  contra.position.set(-3, 2, -3);
  escena.add(sol, contra);

  // Pedestal con anillo de luz
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.18, 48), new THREE.MeshStandardMaterial({ color: 0x29335e, roughness: 0.5 }));
  pedestal.position.y = -0.09;
  pedestal.receiveShadow = true;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.025, 8, 64), new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xffc94a, emissiveIntensity: 1.2 }));
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.005;
  escena.add(pedestal, aro);

  const astro = crearAstronauta();
  astro.position.y = 0.7 * 0; // los pies quedan en y = 0
  escena.add(astro);

  let giro = 0.4, arrastrando = false, ultimoX = 0, velocidad = 0.35, viva = true, pose = 0;
  canvas.addEventListener('pointerdown', (e) => { arrastrando = true; ultimoX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!arrastrando) return; giro += (e.clientX - ultimoX) * 0.012; ultimoX = e.clientX; });
  canvas.addEventListener('pointerup', () => { arrastrando = false; });

  function tam() {
    const w = contenedor.clientWidth || 300, h = contenedor.clientHeight || 400;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  tam();
  const obs = new ResizeObserver(tam);
  obs.observe(contenedor);

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (!arrastrando) giro += dt * velocidad;
    astro.rotation.y = giro;
    pose += dt;
    caminar(astro, Math.sin(pose * 1.4) * 0.6, 0.15); // se balancea un poco, como respirando
    astro.position.y = Math.sin(pose * 2) * 0.01;
    renderer.render(escena, camara);
  });

  return {
    vestir(c) { if (viva) vestirAstronauta(astro, c); },
    /** Cuando la pantalla se redibuja, el lienzo pasa al contenedor nuevo */
    mover(nuevo) { obs.unobserve(contenedor); contenedor = nuevo; nuevo.prepend(canvas); obs.observe(nuevo); tam(); },
    /** Mira de frente un momento (al elegir algo) */
    mostrar() { giro = Math.round(giro / (Math.PI * 2)) * Math.PI * 2 + 0.25; },
    destruir() {
      viva = false;
      obs.disconnect();
      renderer.setAnimationLoop(null);
      escena.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.map) o.material.dispose(); });
      escena.environment?.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
