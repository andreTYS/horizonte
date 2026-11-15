// Genera precache.json: los recursos pesados que el service worker descarga al instalar el juego,
// para que funcione sin internet en el aula (modelos 3D, voces, sonidos, imágenes de la historia y de la marca).
// Uso: node tools/precache.mjs  (también lo comprueba npm test)
import fs from 'node:fs';
import path from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const carpetas = [
  ['assets/modelos', /\.(glb|json)$/],
  ['assets/voz/es', /\.(mp3|json)$/],
  ['assets/voz/en', /\.(mp3|json)$/],
  ['assets/sonidos', /\.mp3$/],
  ['assets/historia', /\.webp$/],
  ['assets/marca', /\.webp$/],
  ['assets/fuentes', /\.woff2$/],
];

export function listaPrecache() {
  return carpetas.flatMap(([dir, re]) => fs.readdirSync(path.join(raiz, dir)).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lista = listaPrecache();
  fs.writeFileSync(path.join(raiz, 'precache.json'), JSON.stringify(lista, null, 1) + '\n');
  const mb = lista.reduce((s, f) => s + fs.statSync(path.join(raiz, f)).size, 0) / 1e6;
  console.log(`precache.json: ${lista.length} archivos, ${mb.toFixed(1)} MB`);
}
