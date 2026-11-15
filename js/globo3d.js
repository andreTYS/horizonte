// Globo 3D de la Luna y de Marte con los lugares de las misiones.
// La textura se pinta en el navegador (sin descargar imágenes): mares, cráteres y relieves principales
// en sus coordenadas reales, de forma simplificada. Se gira con el dedo y cada marcador abre su misión.
import * as THREE from 'three';

const W = 2048, H = 1024;
const px = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
const escalaX = (lat) => 1 / Math.max(0.25, Math.cos((lat * Math.PI) / 180));

function mancha(x, lon, lat, rLon, rLat, color, alfa = 1) {
  const [cx, cy] = px(lon, lat);
  x.globalAlpha = alfa;
  x.fillStyle = color;
  x.beginPath();
  x.ellipse(cx, cy, ((rLon * W) / 360) * escalaX(lat), (rLat * H) / 180, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 1;
}
function borrosa(x, lon, lat, r, color, alfa) {
  // varias elipses superpuestas para bordes suaves e irregulares
  for (let i = 0; i < 7; i++) mancha(x, lon + (Math.random() - 0.5) * r * 0.6, lat + (Math.random() - 0.5) * r * 0.5, r * (0.55 + Math.random() * 0.45), r * (0.45 + Math.random() * 0.4), color, alfa / 3);
}
function crater(x, lon, lat, r, claro, oscuro) {
  const [cx, cy] = px(lon, lat), rx = ((r * W) / 360) * escalaX(lat), ry = (r * H) / 180;
  x.fillStyle = oscuro; x.globalAlpha = 0.35; x.beginPath(); x.ellipse(cx + rx * 0.12, cy + ry * 0.12, rx, ry, 0, 0, 7); x.fill();
  x.strokeStyle = claro; x.globalAlpha = 0.55; x.lineWidth = Math.max(1, ry * 0.18); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.9, Math.PI * 1.9); x.stroke();
  x.globalAlpha = 1;
}
function ruido(x, base, n, tonos) {
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    x.globalAlpha = 0.05 + Math.random() * 0.08;
    x.fillStyle = tonos[i % tonos.length];
    x.beginPath(); x.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 26, 0, 7); x.fill();
  }
  x.globalAlpha = 1;
}

function texturaLuna() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  ruido(x, '#bfc1cc', 2600, ['#d4d6df', '#a9acb9', '#c9cbd4']);
  // Mares (lon, lat, radio en grados)
  for (const [lon, lat, r] of [[-15.6, 32.8, 11], [17.5, 28, 7], [31.4, 8.5, 8], [51.3, -7.8, 6.5], [35.5, -15.2, 4], [59.1, 17, 5], [-50, 15, 13], [-62, 28, 10], [-17.3, -21.3, 7], [-39.6, -24.4, 4], [4, 13.3, 3.5], [-23, -10, 5], [1.4, 56, 5], [-20, 56, 5], [25, 56, 4]]) borrosa(x, lon, lat, r, '#6f7487', 1.8);
  // Cráteres al azar
  for (let i = 0; i < 520; i++) crater(x, Math.random() * 360 - 180, Math.asin(Math.random() * 2 - 1) * (180 / Math.PI), 0.4 + Math.random() ** 3 * 4, '#eef0f6', '#80849a');
  // Tycho con sus rayos y Copérnico
  const [tx, ty] = px(-11.2, -43.3);
  x.strokeStyle = '#f5f6ff'; x.lineWidth = 3;
  for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, l = 60 + Math.random() * 260; x.globalAlpha = 0.18; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + Math.cos(a) * l * 1.4, ty + Math.sin(a) * l * 0.7); x.stroke(); }
  x.globalAlpha = 1;
  crater(x, -11.2, -43.3, 2.6, '#ffffff', '#6f7487');
  crater(x, -20, 9.6, 2.8, '#ffffff', '#6f7487');
  return c;
}

function texturaMarte() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  ruido(x, '#c97a4f', 2600, ['#d98c5c', '#b8683f', '#e0a074']);
  for (const [lon, lat, r] of [[69, 8, 9], [-30, 45, 13], [-40, -25, 15], [0, -4, 7], [110, 45, 13], [145, -25, 15], [20, -20, 10], [-110, -30, 10]]) borrosa(x, lon, lat, r, '#7d3f27', 1.6);
  mancha(x, 70, -42, 13, 9, '#e8b48d', 0.8); // cuenca Hellas
  // Valles Marineris: un gran cañón oscuro
  x.strokeStyle = '#6b3220'; x.lineWidth = 9; x.globalAlpha = 0.85;
  x.beginPath(); let [a, b] = px(-95, -7); x.moveTo(a, b);
  for (const [lon, lat] of [[-85, -9], [-75, -10], [-65, -8], [-55, -10], [-45, -9]]) { [a, b] = px(lon, lat); x.lineTo(a, b); }
  x.stroke(); x.globalAlpha = 1;
  // Olympus Mons y los volcanes de Tharsis
  for (const [lon, lat, r] of [[-134, 18.6, 5], [-112.5, -0.8, 2.2], [-104.5, 12, 2.2], [-120.5, 9, 2.2]]) { mancha(x, lon, lat, r, r, '#e9b08a', 0.9); crater(x, lon, lat, r * 0.35, '#f3c7a5', '#7d3f27'); }
  for (let i = 0; i < 300; i++) crater(x, Math.random() * 360 - 180, Math.asin(Math.random() * 2 - 1) * (180 / Math.PI), 0.3 + Math.random() ** 3 * 3, '#e8b48d', '#8d4a2e');
  // Casquetes polares
  x.fillStyle = '#f5f6ff'; x.globalAlpha = 0.95;
  x.fillRect(0, 0, W, H * 0.045); x.fillRect(0, H * 0.965, W, H * 0.035);
  for (let i = 0; i < 40; i++) { mancha(x, Math.random() * 360 - 180, 83 + Math.random() * 4, 6, 1.5, '#f5f6ff', 0.6); mancha(x, Math.random() * 360 - 180, -84 - Math.random() * 3, 6, 1.4, '#f5f6ff', 0.6); }
  x.globalAlpha = 1;
  return c;
}

/** Dirección en la esfera para una latitud/longitud (misma convención que el mapa UV de three.js). */
function direccion(lat, lon) {
  const phi = ((lon + 180) / 360) * Math.PI * 2, th = ((90 - lat) * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
}

export function crearGlobo(contenedor, capaEtiquetas, { alElegir } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'globo-3d';
  canvas.setAttribute('aria-hidden', 'true');
  contenedor.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camara.position.set(0, 0, 7.2);
  const sol = new THREE.DirectionalLight(0xffffff, 2.6);
  sol.position.set(-4, 2, 5);
  escena.add(sol, new THREE.AmbientLight(0x8a91b8, 0.55));

  // Estrellas de fondo
  const pos = new Float32Array(900 * 3);
  for (let i = 0; i < pos.length; i += 3) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40); pos.set([v.x, v.y, v.z], i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  escena.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })));

  const globo = new THREE.Group();
  escena.add(globo);
  const texturas = {};
  const esfera = new THREE.Mesh(new THREE.SphereGeometry(2, 96, 64), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
  globo.add(esfera);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.08, 64, 32), new THREE.MeshBasicMaterial({ color: 0xc9cfee, transparent: true, opacity: 0.06, side: THREE.BackSide }));
  escena.add(halo);

  let marcadores = [], destino = null, rotY = 0, rotX = 0.15, arrastre = null, viva = true, autogiro = true;
  canvas.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY }; autogiro = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    rotY += (e.clientX - arrastre.x) * 0.008; rotX = Math.max(-1.2, Math.min(1.2, rotX + (e.clientY - arrastre.y) * 0.006));
    arrastre = { x: e.clientX, y: e.clientY }; destino = null;
  });
  canvas.addEventListener('pointerup', () => { arrastre = null; });

  function tam() {
    const w = contenedor.clientWidth || 300, h = contenedor.clientHeight || 300;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.position.z = w < h ? 9.5 : 7.2;
    camara.updateProjectionMatrix();
  }
  tam();
  const obs = new ResizeObserver(tam);
  obs.observe(contenedor);

  const reloj = new THREE.Clock(), v = new THREE.Vector3(), haciaCam = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (destino) { rotY += (destino.y - rotY) * Math.min(1, dt * 3); rotX += (destino.x - rotX) * Math.min(1, dt * 3); }
    else if (autogiro) rotY += dt * 0.12;
    globo.rotation.set(rotX, rotY, 0, 'XYZ');
    renderer.render(escena, camara);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const m of marcadores) {
      v.copy(m.dir).multiplyScalar(2.02).applyEuler(globo.rotation);
      haciaCam.copy(camara.position).sub(v).normalize();
      const visible = v.clone().normalize().dot(haciaCam) > 0.15;
      v.project(camara);
      m.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      m.el.classList.toggle('oculto', !visible);
    }
  });

  return {
    /** planeta: 'luna' | 'marte'; lista: [{ id, lat, lon, titulo, lugar, estrellas }] */
    mostrar(planeta, lista) {
      texturas[planeta] ||= Object.assign(new THREE.CanvasTexture(planeta === 'marte' ? texturaMarte() : texturaLuna()), { colorSpace: THREE.SRGBColorSpace, anisotropy: 4 });
      esfera.material.map = texturas[planeta];
      esfera.material.needsUpdate = true;
      halo.material.color.setHex(planeta === 'marte' ? 0xffb98a : 0xc9cfee);
      capaEtiquetas.innerHTML = '';
      marcadores = lista.map((m) => {
        const el = document.createElement('button');
        el.className = `marcador-globo ${m.estrellas ? 'hecha' : ''}`;
        el.innerHTML = `<span class="pin"></span><b>${m.titulo}</b><small>${m.lugar}</small>`;
        el.addEventListener('click', () => { this.enfocar(m.id); alElegir?.(m.id); });
        capaEtiquetas.appendChild(el);
        return { ...m, el, dir: direccion(m.lat, m.lon) };
      });
      if (marcadores[0]) this.enfocar(marcadores[0].id, false);
    },
    /** Gira el globo para dejar el lugar de frente */
    enfocar(id, suave = true) {
      const m = marcadores.find((x) => x.id === id);
      if (!m) return;
      autogiro = false;
      const d = m.dir;
      const y = Math.atan2(-d.x, d.z);
      const lat = Math.asin(d.y);
      // elegir el giro más corto
      const k = Math.round((rotY - y) / (Math.PI * 2));
      destino = { y: y + k * Math.PI * 2, x: Math.max(-1.2, Math.min(1.2, lat)) };
      if (!suave) { rotY = destino.y; rotX = destino.x; }
      marcadores.forEach((x) => x.el.classList.toggle('activo', x.id === id));
    },
    destruir() {
      viva = false;
      obs.disconnect();
      renderer.setAnimationLoop(null);
      Object.values(texturas).forEach((tx) => tx.dispose());
      escena.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
      capaEtiquetas.innerHTML = '';
    },
    get vivo() { return viva; },
  };
}
