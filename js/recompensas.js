// Recompensas de ASU STELLAR · Horizonte (lógica pura, sin pantalla: se prueba con node --test).
// Los créditos estelares premian lo que queremos que el estudiante aprenda: predecir bien, entender sin rebobinar,
// atreverse sin pistas y volver a intentar después de un error. Con ellos se personaliza la tripulación y la base.

/** Tienda: colores del traje, franjas, visor, parches, accesorios y objetos para la base. precio 0 = viene de inicio. */
export const CATALOGO = [
  { id: 'traje-blanco', tipo: 'traje', nombre: 'Blanco NASA', color: 0xeef0f6, precio: 0 },
  { id: 'traje-celeste', tipo: 'traje', nombre: 'Celeste', color: 0x9fd8ff, precio: 30 },
  { id: 'traje-menta', tipo: 'traje', nombre: 'Menta', color: 0xa8f0cf, precio: 30 },
  { id: 'traje-lila', tipo: 'traje', nombre: 'Lila', color: 0xcdb6ff, precio: 40 },
  { id: 'traje-arena', tipo: 'traje', nombre: 'Arena marciana', color: 0xf0c49a, precio: 40 },
  { id: 'traje-rojo', tipo: 'traje', nombre: 'Rojo Perú', color: 0xe8383d, precio: 60 },
  { id: 'acento-naranja', tipo: 'acento', nombre: 'Naranja', color: 0xff8a2a, precio: 0 },
  { id: 'acento-cian', tipo: 'acento', nombre: 'Cian', color: 0x5cc8ee, precio: 20 },
  { id: 'acento-amarillo', tipo: 'acento', nombre: 'Amarillo solar', color: 0xffc94a, precio: 20 },
  { id: 'acento-magenta', tipo: 'acento', nombre: 'Magenta', color: 0xe77fb3, precio: 20 },
  { id: 'acento-rojo', tipo: 'acento', nombre: 'Rojo', color: 0xe8383d, precio: 20 },
  { id: 'visor-oro', tipo: 'visor', nombre: 'Oro', color: 0xd9a540, precio: 0 },
  { id: 'visor-plata', tipo: 'visor', nombre: 'Plata', color: 0xdfe6f0, precio: 25 },
  { id: 'visor-cian', tipo: 'visor', nombre: 'Aurora', color: 0x7fd8f2, precio: 35 },
  { id: 'visor-rosa', tipo: 'visor', nombre: 'Atardecer', color: 0xff7a7a, precio: 35 },
  { id: 'parche-peru', tipo: 'parche', nombre: 'Bandera del Perú', precio: 0 },
  { id: 'parche-moquegua', tipo: 'parche', nombre: 'Moquegua', precio: 20 },
  { id: 'parche-stellar', tipo: 'parche', nombre: 'Estrella STELLAR', precio: 30 },
  { id: 'parche-inti', tipo: 'parche', nombre: 'Inti, el Sol', precio: 35 },
  { id: 'parche-condor', tipo: 'parche', nombre: 'Cóndor andino', precio: 45 },
  { id: 'parche-llama', tipo: 'parche', nombre: 'Llama astronauta', precio: 45 },
  { id: 'acc-ninguno', tipo: 'accesorio', nombre: 'Sin accesorio', precio: 0 },
  { id: 'acc-bufanda', tipo: 'accesorio', nombre: 'Bufanda andina', precio: 40 },
  { id: 'acc-luces', tipo: 'accesorio', nombre: 'Luces del casco', precio: 40 },
  { id: 'acc-antena', tipo: 'accesorio', nombre: 'Antena de radio', precio: 50 },
  { id: 'acc-orejas', tipo: 'accesorio', nombre: 'Orejas de llama', precio: 60 },
  { id: 'acc-capitan', tipo: 'accesorio', nombre: 'Gorra de capitán', precio: 70 },
  { id: 'acc-jetpack', tipo: 'accesorio', nombre: 'Mochila cohete', precio: 100 },
  { id: 'obj-bandera', tipo: 'objeto', nombre: 'Bandera del Perú', precio: 0 },
  { id: 'obj-contenedores', tipo: 'objeto', nombre: 'Contenedores de carga', precio: 0 },
  { id: 'obj-torre', tipo: 'objeto', nombre: 'Torre meteorológica', precio: 0 },
  { id: 'obj-telescopio', tipo: 'objeto', nombre: 'Telescopio', precio: 50 },
  { id: 'obj-huerto', tipo: 'objeto', nombre: 'Huerto de papas andinas', precio: 60 },
  { id: 'obj-antena', tipo: 'objeto', nombre: 'Antena de espacio profundo', precio: 70 },
  { id: 'obj-dron', tipo: 'objeto', nombre: 'Dron explorador', precio: 80 },
  { id: 'obj-llama', tipo: 'objeto', nombre: 'Estatua de la llama', precio: 90 },
];

export const INICIALES = CATALOGO.filter((x) => x.precio === 0).map((x) => x.id);

/** Tripulación de inicio: nombres en quechua (Luna, Sol, Viento, Suerte). */
export const TRIPULACION_INICIAL = [
  { nombre: 'Killa', traje: 'traje-blanco', acento: 'acento-naranja', visor: 'visor-oro', parche: 'parche-peru', accesorio: 'acc-ninguno' },
  { nombre: 'Inti', traje: 'traje-blanco', acento: 'acento-naranja', visor: 'visor-oro', parche: 'parche-peru', accesorio: 'acc-ninguno' },
  { nombre: 'Wayra', traje: 'traje-blanco', acento: 'acento-naranja', visor: 'visor-oro', parche: 'parche-peru', accesorio: 'acc-ninguno' },
  { nombre: 'Sami', traje: 'traje-blanco', acento: 'acento-naranja', visor: 'visor-oro', parche: 'parche-peru', accesorio: 'acc-ninguno' },
];

export function estadoInicial() {
  return { creditos: 0, comprados: [...INICIALES], objetos: [...INICIALES.filter((id) => id.startsWith('obj-'))], insignias: [], visitados: [], fichas: [] };
}

/**
 * Créditos de una misión terminada.
 * @param {object} p { exito, estrellas, predijo, acerto, rebobinados, sinPistas, falloAntes }
 * @returns {{ total: number, desglose: {texto: string, creditos: number}[] }}
 */
export function calcularRecompensa(p) {
  const d = [];
  if (p.exito) {
    d.push({ texto: 'Misión cumplida', creditos: 20 });
    if (p.estrellas) d.push({ texto: 'Estrellas', n: p.estrellas, creditos: p.estrellas * 10 });
    if (p.rebobinados === 0) d.push({ texto: 'Sin rebobinar', creditos: 10 });
    if (p.sinPistas) d.push({ texto: 'Misión sin pistas', creditos: 15 });
    if (p.falloAntes) d.push({ texto: 'Lo lograste después de un error', creditos: 10 });
  } else {
    d.push({ texto: 'Intento registrado', creditos: 3 });
  }
  if (p.predijo && p.acerto) d.push({ texto: 'Predicción acertada', creditos: 15 });
  return { total: d.reduce((s, x) => s + x.creditos, 0), desglose: d };
}

/** Insignias: id, nombre, qué hay que hacer y la condición (sobre el progreso guardado). */
export const INSIGNIAS = [
  { id: 'primera', icono: 'cohete', nombre: 'Primer despegue', desc: 'Cumple tu primera misión.', cond: (e) => e.historial.some((x) => x.exito) },
  { id: 'profeta', icono: 'predecir', nombre: 'Buen pronóstico', desc: 'Acierta una predicción.', cond: (e) => e.historial.some((x) => x.prediccion && x.prediccion === (x.exito ? 'exito' : x.motivo)) },
  { id: 'certero', icono: 'predecir', nombre: 'Ojo de ingeniera', desc: 'Acierta 5 predicciones.', cond: (e) => e.historial.filter((x) => x.prediccion && x.prediccion === (x.exito ? 'exito' : x.motivo)).length >= 5 },
  { id: 'limpio', icono: 'estrella', nombre: 'Sin mirar atrás', desc: 'Cumple una misión sin rebobinar.', cond: (e) => e.historial.some((x) => x.exito && x.rebobinados === 0) },
  { id: 'leccion', icono: 'rebobinar', nombre: 'El error es la lección', desc: 'Falla una misión y luego cúmplela.', cond: (e) => e.historial.some((x, i) => x.exito && e.historial.slice(0, i).some((y) => y.mision === x.mision && !y.exito)) },
  { id: 'noche', icono: 'noche', nombre: 'Guardián de la noche', desc: 'Sobrevive a la noche lunar.', cond: (e) => Boolean(e.progreso.noche) },
  { id: 'cosecha', icono: 'invernadero', nombre: 'Primera cosecha', desc: 'Cumple la misión de la cosecha en Marte.', cond: (e) => Boolean(e.progreso.marte) },
  { id: 'escudo', icono: 'refugio', nombre: 'Escudo de la tripulación', desc: 'Protege a tu tripulación de la tormenta solar en Marte.', cond: (e) => Boolean(e.progreso.tormenta_marte) },
  { id: 'comandante', icono: 'final', nombre: 'Comandante', desc: 'Completa las 4 misiones de la expedición.', cond: (e) => ['noche', 'amanecer', 'marte', 'tormenta_marte'].every((id) => e.progreso[id]) },
  { id: 'explorador', icono: 'lugar', nombre: 'Explorador', desc: 'Visita los 4 lugares del mapa.', cond: (e) => e.visitados.length >= 4 },
  { id: 'cientifico', icono: 'datos', nombre: 'Científico curioso', desc: 'Abre 6 fichas de módulos u objetos.', cond: (e) => e.fichas.length >= 6 },
  { id: 'cronista', icono: 'lapiz', nombre: 'Cronista', desc: 'Escribe 3 frases en tu bitácora.', cond: (e) => Object.keys(e.notas).length >= 3 },
];

/** Devuelve los ids de insignias recién ganadas (las que cumplen la condición y aún no tenía). */
export function nuevasInsignias(estado, yaTiene) {
  return INSIGNIAS.filter((b) => !yaTiene.includes(b.id) && b.cond(estado)).map((b) => b.id);
}

/** Intenta comprar un artículo. Devuelve { ok, motivo } y modifica `rec` solo si se pudo. */
export function comprar(rec, id) {
  const item = CATALOGO.find((x) => x.id === id);
  if (!item) return { ok: false, motivo: 'no existe' };
  if (rec.comprados.includes(id)) return { ok: true };
  if (rec.creditos < item.precio) return { ok: false, motivo: 'faltan créditos' };
  rec.creditos -= item.precio;
  rec.comprados.push(id);
  if (item.tipo === 'objeto' && !rec.objetos.includes(id)) rec.objetos.push(id);
  return { ok: true };
}
