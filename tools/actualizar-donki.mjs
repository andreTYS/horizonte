// Descarga eventos solares reales de NASA DONKI y los guarda en data/donki-<inicio>.json.
// Uso:  node tools/actualizar-donki.mjs 2024-05-01 2024-05-31
// Necesita una API key de https://api.nasa.gov en la variable NASA_API_KEY (DEMO_KEY sirve para pocas consultas).
import fs from 'node:fs';

const [inicio = '2024-05-01', fin = '2024-05-31'] = process.argv.slice(2);
const clave = process.env.NASA_API_KEY || 'DEMO_KEY';
const pedir = async (tipo) => {
  try {
    const r = await fetch(`https://api.nasa.gov/DONKI/${tipo}?startDate=${inicio}&endDate=${fin}`, { headers: { 'X-Api-Key': clave } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    console.warn(`Aviso: ${tipo} no disponible (${err.message}); se omite.`);
    return [];
  }
};

const [sep, gst, flr] = await Promise.all([pedir('SEP'), pedir('GST'), pedir('FLR')]);
const datos = {
  fuente: 'NASA DONKI – Space Weather Database Of Notifications, Knowledge, Information',
  url: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  periodo: { inicio, fin },
  descargado: new Date().toISOString().slice(0, 10),
  eventosParticulas: sep.map((s) => ({ hora: s.eventTime, url: s.link })),
  tormentasGeomagneticas: gst.map((g) => ({ inicio: g.startTime, kpMax: Math.max(...g.allKpIndex.map((k) => k.kpIndex)), url: g.link })),
  llamaradas: flr.map((f) => ({ pico: f.peakTime, clase: f.classType, url: f.link })),
};
const salida = new URL(`../data/donki-${inicio.slice(0, 7)}.json`, import.meta.url);
fs.writeFileSync(salida, JSON.stringify(datos, null, 2) + '\n');
console.log(`Guardado ${salida.pathname}: ${datos.eventosParticulas.length} SEP, ${datos.tormentasGeomagneticas.length} tormentas, ${datos.llamaradas.length} llamaradas.`);
