// Service worker: permite jugar sin conexión (en el aula no siempre hay internet).
const CACHE = 'horizonte-v3';
const ARCHIVOS = [
  './', 'index.html', 'css/estilos.css', 'js/main.js', 'js/sim.js', 'js/escena.js', 'js/api.js', 'js/evaluacion.js',
  'data/nasa.json', 'data/juego.json', 'data/misiones.json', 'data/evaluacion.json',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
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
