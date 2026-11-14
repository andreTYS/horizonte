// Lista todo lo que dice Nebula (en español e inglés) para generar su voz con Piper.
// Uso: node tools/voz/textos.mjs > /tmp/textos.json
import fs from 'node:fs';
import * as S from '../../js/sim.js';
import { t, trAnalisis, setIdioma } from '../../js/i18n.js';

const leer = (f) => JSON.parse(fs.readFileSync(new URL(`../../data/${f}`, import.meta.url)));
const nasa = leer('nasa.json'), juego = leer('juego.json'), misiones = leer('misiones.json'), mEn = leer('en/misiones.json');

/** Igual que en js/voz.js: sin etiquetas HTML y con espacios simples. */
export const normalizar = (html) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const PISTAS = [
  'Viene una tormenta de polvo: los paneles casi no producirán. Ahorra energía: apaga el invernadero.',
  '¡Una llamarada! Las partículas llegan mañana. Activa el <strong>refugio</strong> antes de avanzar.',
  'Cada <strong>Avanzar</strong> pasa un día. Si una barra llega a cero, la base falla. En el <strong>Cronoscopio</strong> toca un día pasado para <strong>rebobinar</strong>.',
  'Se puso el Sol: los paneles ya no producen. Solo cuentan las baterías y el reactor.',
  '¡Aprendiste cómo se conectan los sistemas de una base! Eso es lo que hacen los ingenieros de la NASA.',
  'Cada falla que entiendes te acerca a ser comandante. ¡Vuelve a jugar!',
];

/** Todas las frases de Nebula: { es: [...], en: [...] } (ya normalizadas). */
export function textos() {
const salida = { es: new Set(), en: new Set() };
for (const m of misiones) {
  salida.es.add(normalizar(`${m.nebula.briefing}<br><br>${m.nebula.construir}`));
  salida.es.add(normalizar(m.nebula.exito));
  const e = mEn[m.id].nebula;
  salida.en.add(normalizar(`${e.briefing}<br><br>${e.construir}`));
  salida.en.add(normalizar(e.exito));
}
for (const idioma of ['es', 'en']) {
  setIdioma(idioma);
  for (const p of PISTAS) salida[idioma].add(normalizar(t(p)));
  // Consejos de todas las fallas posibles
  for (const m of misiones) {
    for (const cfg of [m.sugerido, { ...m.sugerido, reciclador: false }, { ...m.sugerido, comida: 20 }, { ...m.sugerido, o2: 0, agua: 0 }]) {
      for (const dec of [() => S.decisionesPorDefecto(), () => ({ ...S.decisionesPorDefecto(), racion: true }), () => ({ ...S.decisionesPorDefecto(), refugio: true })]) {
        const r = S.simular(m, cfg, nasa, juego, dec);
        if (!r.resultado.exito) salida[idioma].add(normalizar(trAnalisis(S.analizarFalla(r.resultado.motivo, r.historial, r.estado, m, nasa)).consejo));
      }
    }
  }
}
setIdioma('es');
return { es: [...salida.es], en: [...salida.en] };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(textos(), null, 2));
