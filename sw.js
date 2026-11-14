// Service worker: permite jugar sin conexión (en el aula no siempre hay internet).
const CACHE = 'horizonte-v7';
const ARCHIVOS = [
  './', 'index.html', 'css/estilos.css', 'js/main.js', 'js/sim.js', 'js/escena.js', 'js/api.js', 'js/evaluacion.js', 'js/mundo3d.js', 'js/modelos3d.js', 'js/plataforma3d.js', 'js/i18n.js', 'js/sonido.js', 'js/voz.js',
  'data/en/misiones.json', 'data/en/nasa.json', 'data/en/evaluacion.json',
  'vendor/three/three.module.min.js', 'vendor/three/addons/controls/OrbitControls.js', 'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three/addons/postprocessing/EffectComposer.js', 'vendor/three/addons/postprocessing/RenderPass.js',
  'vendor/three/addons/postprocessing/UnrealBloomPass.js', 'vendor/three/addons/postprocessing/OutputPass.js', 'vendor/three/addons/postprocessing/ShaderPass.js',
  'vendor/three/addons/postprocessing/MaskPass.js', 'vendor/three/addons/postprocessing/Pass.js', 'vendor/three/addons/shaders/CopyShader.js',
  'vendor/three/addons/shaders/LuminosityHighPassShader.js', 'vendor/three/addons/shaders/OutputShader.js',
  'assets/fuentes/orbitron-latin-700-normal.woff2', 'assets/fuentes/orbitron-latin-900-normal.woff2', 'assets/fuentes/exo-2-latin-400-normal.woff2', 'assets/fuentes/exo-2-latin-600-normal.woff2',
  'data/nasa.json', 'data/juego.json', 'data/misiones.json', 'data/evaluacion.json',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/sprite.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero (para ver cambios al desarrollar), caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request)),
  );
});
