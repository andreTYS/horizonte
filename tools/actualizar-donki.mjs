// Descarga eventos solares reales de NASA DONKI y los guarda en data/donki.json.
// Uso (desde tu máquina, con internet):  node tools/actualizar-donki.mjs 2024-05-01 2024-05-31 [API_KEY]
// La API key gratuita se pide en https://api.nasa.gov (DEMO_KEY sirve para pocas consultas).
import fs from 'node:fs';

const [inicio = '2024-05-01', fin = '2024-05-31', clave = process.env.NASA_API_KEY || 'DEMO_KEY'] = process.argv.slice(2);
const base = 'https://api.nasa.gov/DONKI';
const pedir = async (tipo) => {
  const r = await fetch(`${base}/${tipo}?startDate=${inicio}&endDate=${fin}&api_key=${clave}`);
  if (!r.ok) throw new Error(`${tipo}: HTTP ${r.status}`);
  return r.json();
};

const [flr, sep] = await Promise.all([pedir('FLR'), pedir('SEP')]);
const datos = {
  fuente: 'NASA DONKI – https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  periodo: { inicio, fin },
  descargado: new Date().toISOString(),
  llamaradas: flr.map((f) => ({ inicio: f.beginTime, pico: f.peakTime, clase: f.classType, region: f.activeRegionNum, url: f.link })),
  eventosParticulas: sep.map((s) => ({ hora: s.eventTime, url: s.link })),
};
fs.writeFileSync(new URL('../data/donki.json', import.meta.url), JSON.stringify(datos, null, 2) + '\n');
console.log(`Guardado data/donki.json: ${datos.llamaradas.length} llamaradas, ${datos.eventosParticulas.length} eventos de partículas.`);
