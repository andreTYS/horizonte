// Service worker: permite jugar sin conexión (en el aula no siempre hay internet).
const CACHE = 'horizonte-v30';
const ARCHIVOS = [
  './', 'index.html', 'css/estilos.css', 'js/main.js', 'js/sim.js', 'js/escena.js', 'js/api.js', 'js/evaluacion.js', 'js/mundo3d.js', 'js/terreno3d.js', 'js/modelos3d.js', 'js/plataforma3d.js', 'js/i18n.js', 'js/sonido.js', 'js/voz.js', 'js/landing.js', 'js/accesibilidad.js', 'js/recompensas.js', 'js/objetos3d.js', 'js/docente.js', 'vendor/qrcode/qrcode.mjs',
  'data/en/misiones.json', 'data/en/nasa.json', 'data/en/evaluacion.json',
  'vendor/three/three.module.min.js', 'vendor/three/addons/controls/OrbitControls.js', 'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three/addons/postprocessing/EffectComposer.js', 'vendor/three/addons/postprocessing/RenderPass.js',
  'vendor/three/addons/postprocessing/UnrealBloomPass.js', 'vendor/three/addons/postprocessing/OutputPass.js', 'vendor/three/addons/postprocessing/ShaderPass.js',
  'vendor/three/addons/postprocessing/MaskPass.js', 'vendor/three/addons/postprocessing/Pass.js', 'vendor/three/addons/shaders/CopyShader.js',
  'vendor/three/addons/shaders/LuminosityHighPassShader.js', 'vendor/three/addons/environments/RoomEnvironment.js', 'vendor/three/addons/objects/Lensflare.js', 'vendor/three/addons/shaders/OutputShader.js',
  'assets/fuentes/unbounded-latin-800-normal.woff2', 'assets/fuentes/baloo-2-latin-800-normal.woff2', 'assets/fuentes/noto-sans-latin-400-normal.woff2', 'assets/fuentes/noto-sans-latin-700-normal.woff2', 'assets/fuentes/space-mono-latin-700-normal.woff2',
  'assets/marca/logo-color.webp', 'assets/marca/nebula-cara.webp', 'assets/marca/astronauta-peruana.webp', 'assets/marca/llama-astronauta.webp',
  'data/historia.json', 'data/en/historia.json',
  'data/nasa.json', 'data/juego.json', 'data/misiones.json', 'data/evaluacion.json',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/sprite.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ARCHIVOS); // lo esencial: si falla, no se instala
    // Lo pesado (modelos 3D, voces, sonidos, imágenes): se guarda todo lo que se pueda, sin bloquear la instalación
    try {
      const lista = await (await fetch('precache.json', { cache: 'no-store' })).json();
      for (let i = 0; i < lista.length; i += 8) await Promise.all(lista.slice(i, i + 8).map((f) => c.add(f).catch(() => {})));
    } catch { /* sin lista: se guardará al usarlos */ }
    await self.skipWaiting();
  })());
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
      // Sin red: el enlace del docente (?aula=…&modo=aula) y ?demo=1 también deben abrir el juego
      .catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })),
  );
});
