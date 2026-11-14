// Motor de simulación de HORIZONTE.
// Funciones puras: no tocan el DOM, así se pueden probar con `node --test`.

export const RECURSOS = ['energia', 'o2', 'agua', 'comida'];
export const SISTEMAS = ['electrolizador', 'reciclador', 'invernadero'];

const cifra = (nasa, clave) => nasa.cifras[clave].valor;
const clonar = (x) => JSON.parse(JSON.stringify(x));

export function configInicial(mision) {
  return { ...mision.sugerido };
}

/** Masa total de la base en toneladas. */
export function masa(config, juego, nasa) {
  const m = juego.modulos;
  let t = juego.habitat.masa_t;
  t += config.panel * m.panel.masa_t;
  t += config.bateria * m.bateria.masa_t;
  if (config.reactor) t += cifra(nasa, 'fsp_masa_t');
  if (config.reciclador) t += m.reciclador.masa_t;
  if (config.invernadero) t += m.invernadero.masa_t;
  if (config.extractor) t += m.extractor.masa_t;
  if (config.moxie) t += m.moxie.masa_t;
  t += m.blindaje.niveles[config.blindaje].masa_t;
  t += (config.o2 + config.agua + config.comida) / 1000;
  return Math.round(t * 100) / 100;
}

export function hayLuz(mision, dia, nasa) {
  if (mision.luz_permanente) return true;
  const ciclo = cifra(nasa, 'ciclo_lunar_dias');
  return (mision.fase_inicial + dia) % ciclo < ciclo / 2;
}

export function crearEstado(mision, config, juego) {
  return {
    dia: 0,
    config: clonar(config),
    energia: config.bateria * juego.modulos.bateria.capacidad_kwh,
    o2: config.o2,
    agua: config.agua,
    comida: config.comida,
    dosis: 0,
    salud: 100,
    ciencia: 0,
    panelesDanados: 0,
    averias: {},
    polvo: null, // { dias, factor } durante una tormenta de polvo en Marte
    falla: null,
    terminado: false,
  };
}

export function decisionesPorDefecto() {
  return { refugio: false, racion: false, invernadero: true };
}

/**
 * Avanza un día. Devuelve { estado, registro }.
 * `decision`: { refugio, racion, invernadero } elegido por el jugador para ese día.
 */
export function paso(estadoPrevio, mision, decision, nasa, juego) {
  const e = clonar(estadoPrevio);
  const c = e.config;
  const m = juego.modulos;
  const n = mision.tripulacion;
  const reg = { dia: e.dia, luz: hayLuz(mision, e.dia, nasa), eventos: [], apagados: [], decision: clonar(decision) };

  // 1. Eventos del día
  let dosisTormenta = 0;
  for (const ev of mision.eventos.filter((x) => x.dia === e.dia)) {
    reg.eventos.push(ev);
    if (ev.tipo === 'micrometeorito') e.panelesDanados = Math.min(c.panel, e.panelesDanados + ev.paneles);
    if (ev.tipo === 'averia_reciclador') e.averias.reciclador = ev.duracion;
    if (ev.tipo === 'tormenta_solar') dosisTormenta += ev.dosis_msv;
    if (ev.tipo === 'tormenta_polvo') e.polvo = { dias: ev.duracion, factor: ev.factor_solar };
  }
  reg.polvo = Boolean(e.polvo);

  // 2. Energía: producción y reparto por prioridad
  const panelesActivos = c.panel - e.panelesDanados;
  const solar = (mision.factor_solar ?? 1) * (e.polvo ? e.polvo.factor : 1); // Marte recibe menos luz; el polvo la tapa
  const produccion = (reg.luz ? panelesActivos * m.panel.kwh_dia_luz * solar : 0) + (c.reactor ? cifra(nasa, 'fsp_kw') * 24 : 0);
  const capacidad = c.bateria * m.bateria.capacidad_kwh;
  let disponible = produccion + e.energia;
  reg.produccion = produccion;

  const racion = decision.racion ? juego.racion.reducida : 1;
  const o2Necesario = n * cifra(nasa, 'o2_persona_dia');
  const o2Moxie = c.moxie ? Math.min(o2Necesario, m.moxie.o2_kg_dia) : 0; // MOXIE saca O₂ del CO₂ de Marte, sin agua
  const o2Electrolisis = o2Necesario - o2Moxie;
  const demandas = [
    { id: 'soporte', kwh: juego.habitat.kwh_dia_base + n * juego.habitat.kwh_dia_persona },
    { id: 'moxie', kwh: c.moxie ? m.moxie.kwh_dia : 0 },
    { id: 'electrolizador', kwh: o2Electrolisis * juego.habitat.kwh_por_kg_o2 },
    { id: 'reciclador', kwh: c.reciclador && !e.averias.reciclador ? m.reciclador.kwh_dia : 0 },
    { id: 'extractor', kwh: c.extractor ? m.extractor.kwh_dia : 0 },
    { id: 'invernadero', kwh: c.invernadero && decision.invernadero ? m.invernadero.kwh_dia : 0 },
  ];
  const activo = {};
  reg.demanda = 0;
  for (const d of demandas) {
    reg.demanda += d.kwh;
    if (d.kwh === 0) { activo[d.id] = false; continue; }
    if (disponible >= d.kwh) { disponible -= d.kwh; activo[d.id] = true; }
    else { activo[d.id] = false; reg.apagados.push(d.id); }
  }
  e.energia = Math.min(capacidad, disponible);
  if (c.reciclador && e.averias.reciclador) reg.apagados.push('reciclador (averiado)');

  // 3. Oxígeno: MOXIE aporta su parte (sin agua) y el electrolizador el resto (partiendo agua)
  let o2Producido = activo.moxie ? o2Moxie : 0;
  if (activo.electrolizador) {
    const aguaParaO2 = o2Electrolisis * cifra(nasa, 'agua_por_kg_o2');
    if (e.agua >= aguaParaO2) { o2Producido += o2Electrolisis; e.agua -= aguaParaO2; }
    else reg.apagados.push('electrolizador (sin agua)');
  }
  e.o2 += o2Producido - o2Necesario;

  // 4. Agua
  const aguaUsada = n * cifra(nasa, 'agua_persona_dia');
  e.agua -= activo.reciclador ? aguaUsada * (1 - cifra(nasa, 'recuperacion_agua')) : aguaUsada;
  if (activo.invernadero) e.agua -= m.invernadero.agua_kg_dia;
  if (activo.extractor) e.agua += m.extractor.agua_kg_dia; // hielo del regolito (LCROSS)

  // 5. Comida
  const comidaUsada = n * cifra(nasa, 'comida_persona_dia') * racion;
  const comidaInvernadero = activo.invernadero ? n * cifra(nasa, 'comida_persona_dia') * m.invernadero.fraccion_comida : 0;
  e.comida += comidaInvernadero - comidaUsada;
  e.salud = Math.min(100, e.salud + (decision.racion ? juego.racion.salud_dia : juego.racion.salud_recupera_dia));

  // 6. Radiación
  const blindaje = m.blindaje.niveles[c.blindaje].reduccion;
  let dosis = cifra(nasa, mision.dosis_dato || 'dosis_luna_msv_dia') * (1 - blindaje);
  if (dosisTormenta) dosis += dosisTormenta * (1 - blindaje) * (decision.refugio ? 1 - juego.refugio.reduccion_tormenta : 1);
  e.dosis += dosis;
  reg.dosisDia = dosis;

  // 7. Ciencia: en el refugio no se sale a explorar
  if (!decision.refugio) e.ciencia += juego.ciencia_dia + (activo.invernadero ? m.invernadero.ciencia_extra : 0);

  // 8. Averías que se reparan
  for (const k of Object.keys(e.averias)) if (--e.averias[k] <= 0) delete e.averias[k];
  if (e.polvo && --e.polvo.dias <= 0) e.polvo = null;

  // 9. ¿Falló algo?
  if (!activo.soporte) e.falla = 'energia';
  else if (e.o2 < 0) e.falla = 'o2';
  else if (e.agua < 0) e.falla = 'agua';
  else if (e.comida < 0) e.falla = 'comida';
  else if (e.dosis > mision.limite_dosis_msv) e.falla = 'radiacion';
  else if (e.salud <= 0) e.falla = 'salud';

  for (const r of ['o2', 'agua', 'comida']) e[r] = Math.round(e[r] * 100) / 100;
  e.energia = Math.round(e.energia);
  e.dosis = Math.round(e.dosis * 100) / 100;
  e.dia += 1;
  reg.estado = { energia: e.energia, o2: e.o2, agua: e.agua, comida: e.comida, dosis: e.dosis, salud: e.salud, ciencia: e.ciencia };
  if (e.falla || e.dia >= mision.dias) e.terminado = true;
  return { estado: e, registro: reg };
}

/** Resultado final de la misión. */
export function resultado(estado, mision) {
  if (estado.falla) return { exito: false, motivo: estado.falla };
  if (estado.ciencia < mision.objetivo_ciencia) return { exito: false, motivo: 'ciencia' };
  return { exito: true };
}

/**
 * Explica POR QUÉ falló la base mirando el historial: la cadena causa → efecto
 * y la cifra NASA que lo explica. Esto es lo que ve el jugador al rebobinar.
 */
export function analizarFalla(motivo, historial, estado, mision, nasa) {
  const c = estado.config;
  const primerApagado = (id) => historial.find((r) => r.apagados.some((a) => a.startsWith(id)));
  const primerNoche = historial.find((r) => !r.luz);

  if (motivo === 'energia' || motivo === 'o2') {
    const apagado = motivo === 'energia' ? historial[historial.length - 1] : primerApagado('electrolizador');
    if (apagado && apagado.apagados.includes('electrolizador (sin agua)')) {
      const mods = mision.modulos || [];
      const extra = mods.includes('extractor') && !c.extractor ? ' O usa el extractor: saca hielo del suelo lunar.'
        : mods.includes('moxie') && !c.moxie ? ' En Marte, MOXIE fabrica oxígeno con el aire, sin gastar agua.' : '';
      return {
        titulo: 'Te quedaste sin agua para fabricar oxígeno',
        cadena: [`Día ${apagado.dia + 1}: no quedaba agua suficiente`, 'El electrolizador no pudo partir agua para hacer O₂', 'El oxígeno se agotó'],
        dia: apagado.dia,
        datos: ['agua_por_kg_o2', 'o2_persona_dia', ...(mods.includes('extractor') ? ['lcross_hielo'] : []), ...(mods.includes('moxie') ? ['moxie_o2'] : [])],
        consejo: 'Lleva más agua o instala el reciclador: cada kilo de oxígeno cuesta 1,125 kg de agua.' + extra,
        redisenar: true,
      };
    }
    const conPolvo = historial.find((r) => r.polvo);
    if (apagado && conPolvo && !c.reactor) {
      return {
        titulo: 'La tormenta de polvo tapó tus paneles',
        cadena: [`Día ${conPolvo.dia + 1}: llegó la tormenta de polvo y los paneles recibieron solo un cuarto de la luz`, `Día ${apagado.dia + 1}: las baterías se vaciaron`, motivo === 'o2' ? 'Sin energía, no se fabricó oxígeno' : 'El soporte vital se apagó'],
        dia: apagado.dia, datos: ['polvo_marte_2018', 'luz_marte', 'fsp_kw'],
        consejo: 'En Marte el Sol es débil y el polvo puede taparlo por días. Lleva baterías para aguantar la tormenta… o un reactor, que no depende del Sol.',
        redisenar: true,
      };
    }
    if (apagado && !apagado.luz && !c.reactor) {
      return {
        titulo: 'La noche lunar dejó tu base sin energía',
        cadena: [`Día ${(primerNoche?.dia ?? apagado.dia) + 1}: se puso el Sol y los paneles dejaron de producir`, `Día ${apagado.dia + 1}: las baterías se vaciaron`, motivo === 'o2' ? 'Sin energía, el electrolizador dejó de fabricar oxígeno' : 'El soporte vital se apagó'],
        dia: apagado.dia, datos: ['ciclo_lunar_dias', 'fsp_kw', 'o2_persona_dia'],
        consejo: 'La noche lunar dura casi 15 días. Necesitas muchas baterías… o un reactor que funcione día y noche.',
        redisenar: true,
      };
    }
    if (apagado) {
      return {
        titulo: 'La base consume más energía de la que produce',
        cadena: [`Día ${apagado.dia + 1}: la energía no alcanzó`, `Se apagó: ${apagado.apagados.join(', ')}`, motivo === 'o2' ? 'Sin electrolizador no hay oxígeno nuevo' : 'El soporte vital se apagó'],
        dia: apagado.dia, datos: ['o2_persona_dia'],
        consejo: 'Añade paneles o baterías, o apaga el invernadero en los días críticos.',
      };
    }
    return {
      titulo: 'Faltó oxígeno', cadena: ['El oxígeno de reserva no alcanzó'], dia: estado.dia - 1,
      datos: ['o2_persona_dia'], consejo: 'Lleva más oxígeno de reserva.',
    };
  }
  if (motivo === 'agua') {
    const sinReciclar = primerApagado('reciclador');
    if (!c.reciclador) {
      return {
        titulo: 'Sin reciclador, el agua se acaba rápido',
        cadena: ['La base no tenía reciclador de agua', 'Cada día se perdía toda el agua usada', `Día ${estado.dia}: se acabó el agua`],
        dia: 0, datos: ['agua_persona_dia', 'recuperacion_agua'],
        consejo: 'La ISS recupera el 98 % de su agua. Con reciclador, una misión larga necesita muy poca agua de reserva.',
        redisenar: true,
      };
    }
    return {
      titulo: 'El reciclador dejó de funcionar',
      cadena: [`Día ${(sinReciclar?.dia ?? 0) + 1}: ${sinReciclar?.eventos.length ? sinReciclar.eventos.map((x) => x.texto).join(' ') : 'el reciclador se quedó sin energía'}`, 'Sin reciclar, se pierde toda el agua usada', `Día ${estado.dia}: se acabó el agua`],
      dia: sinReciclar?.dia ?? 0, datos: ['recuperacion_agua', 'agua_persona_dia'],
      consejo: 'Lleva una reserva de agua para cuando el reciclador falle.',
      redisenar: true,
    };
  }
  if (motivo === 'comida') {
    return {
      titulo: 'Se acabó la comida',
      cadena: [`${mision.tripulacion} astronautas × ${mision.dias} días`, 'La comida de reserva no alcanzó', `Día ${estado.dia}: despensa vacía`],
      dia: estado.dia - 1, datos: ['comida_persona_dia', 'veggie'],
      consejo: 'Calcula: personas × días × comida diaria. El invernadero produce parte de la comida, pero gasta agua y energía.',
      redisenar: true,
    };
  }
  if (motivo === 'radiacion') {
    const tormenta = historial.find((r) => r.eventos.some((x) => x.tipo === 'tormenta_solar') && !r.decision.refugio);
    if (tormenta) {
      return {
        titulo: 'La tormenta solar atrapó a la tripulación fuera del refugio',
        cadena: [`Día ${tormenta.dia}: alerta de llamarada`, `Día ${tormenta.dia + 1}: llegaron las partículas y la tripulación no estaba en el refugio`, 'La dosis superó el límite de la misión'],
        dia: tormenta.dia, datos: ['tormenta_mayo_2024', 'dosis_luna_msv_dia', 'limite_carrera_msv'],
        consejo: 'Cuando haya alerta solar, activa el refugio para el día siguiente.',
      };
    }
    return {
      titulo: 'Demasiada radiación acumulada',
      cadena: ['La Luna no tiene atmósfera ni campo magnético', 'Cada día suma dosis', 'Se superó el límite de la misión'],
      dia: estado.dia - 1, datos: ['dosis_luna_msv_dia', 'limite_carrera_msv'],
      consejo: 'Añade blindaje de regolito.',
    };
  }
  if (motivo === 'salud') {
    return {
      titulo: 'La tripulación se debilitó por comer poco',
      cadena: ['Muchos días seguidos con ración reducida', 'La salud cayó a cero'],
      dia: estado.dia - 1, datos: ['comida_persona_dia'], consejo: 'Usa la ración reducida solo unos pocos días.',
    };
  }
  return {
    titulo: 'Sobreviviste, pero faltó ciencia',
    cadena: [`Ciencia lograda: ${estado.ciencia} de ${mision.objetivo_ciencia}`, 'Los días en el refugio no suman ciencia'],
    dia: estado.dia - 1, datos: [], consejo: 'Usa el refugio solo cuando sea necesario. El invernadero suma ciencia extra.',
  };
}

/** Juega la misión entera con una función de decisiones (útil en pruebas). */
export function simular(mision, config, nasa, juego, decidir = () => decisionesPorDefecto()) {
  let e = crearEstado(mision, config, juego);
  const historial = [];
  while (!e.terminado) {
    const r = paso(e, mision, decidir(e.dia, e), nasa, juego);
    historial.push(r.registro);
    e = r.estado;
  }
  return { estado: e, historial, resultado: resultado(e, mision) };
}
