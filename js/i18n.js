// Idiomas de HORIZONTE: español (base) e inglés.
// La clave de cada texto es el propio texto en español; si falta la traducción, se muestra en español.

let idioma = (() => {
  try {
    const guardado = localStorage.getItem('horizonte.idioma');
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch { /* sin almacenamiento */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'es';
  return (nav || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
})();
const ponerLang = () => { if (typeof document !== 'undefined') document.documentElement.lang = idioma; };
ponerLang();

export const getIdioma = () => idioma;
export function setIdioma(nuevo) {
  idioma = nuevo === 'en' ? 'en' : 'es';
  ponerLang();
  try { localStorage.setItem('horizonte.idioma', idioma); } catch { /* sin almacenamiento */ }
}

/** Traduce un texto de la interfaz. Variables: t('Día {n}', { n: 3 }). */
export function t(es, vars = {}) {
  let s = idioma === 'en' ? (EN[es] ?? es) : es;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Traduce textos generados por el motor (análisis de fallas, sistemas apagados). */
export function tr(s) {
  if (idioma !== 'en' || typeof s !== 'string') return s;
  if (EN[s]) return EN[s];
  for (const [re, rep] of PATRONES) if (re.test(s)) return s.replace(re, rep);
  return s;
}
export const trLista = (lista) => lista.map((x) => tr(x));
export const trAnalisis = (a) => (idioma === 'en' ? { ...a, titulo: tr(a.titulo), cadena: a.cadena.map(tr), consejo: tr(a.consejo) } : a);

const EN = {
  // Portada
  'Ensaya el futuro de tu base': 'Rehearse the future of your base',
  'Diseña una base en la Luna, adelanta el tiempo y descubre si tu tripulación llega al día final. Si falla, <strong>rebobina</strong> y corrige.':
    'Design a base on the Moon, fast-forward time and find out if your crew makes it to the last day. If it fails, <strong>rewind</strong> and fix it.',
  'Misiones': 'Missions',
  'Misiones avanzadas': 'Advanced missions',
  'sin pistas': 'no hints',
  'Tu nombre y aula (opcional)': 'Your name and class (optional)',
  'Nombre': 'Name',
  'Código de aula': 'Class code',
  'p. ej. 3B-2026': 'e.g. 3B-2026',
  'Si tu docente te dio un código, escríbelo para que vea tu avance.': 'If your teacher gave you a code, type it so they can follow your progress.',
  'Datos NASA': 'NASA data',
  'Arrastra para girar la base · pellizca para acercar': 'Drag to rotate the base · pinch to zoom',
  '{n} astronautas · {d} días': '{n} astronauts · {d} days',
  '{n} de 3 estrellas': '{n} of 3 stars',
  'Sonido': 'Sound',
  'Idioma': 'Language',
  // Diseño
  'Volver a misiones': 'Back to missions',
  'Masa que lleva el cohete': 'Mass carried by the rocket',
  'Masa': 'Mass',
  'kWh/día con luz': 'kWh/day in sunlight',
  'días': 'days',
  'aguantas de noche (~15)': 'you last at night (~15)',
  'de agua': 'of water',
  'de comida': 'of food',
  'límite {n}': 'limit {n}',
  'Ver la pista de Nebula': "See Nebula's hint",
  '¡Entendido!': 'Got it!',
  'El cohete no puede despegar: quita masa.': 'The rocket cannot lift off: remove some mass.',
  'Hábitat': 'Habitat',
  'Paneles': 'Panels',
  'Baterías': 'Batteries',
  'Reactor': 'Reactor',
  'Reciclador': 'Recycler',
  'Invernadero': 'Greenhouse',
  'Extractor de hielo': 'Ice extractor',
  'Blindaje': 'Shielding',
  'Nivel de blindaje': 'Shielding level',
  'No': 'None', 'Medio': 'Medium', 'Alto': 'High',
  'Oxígeno': 'Oxygen', 'Agua': 'Water', 'Comida': 'Food',
  'kg de reserva': 'kg in reserve',
  'kg · también hace O₂': 'kg · also makes O₂',
  'kg': 'kg',
  'Quitar {x}': 'Remove {x}',
  'Añadir {x}': 'Add {x}',
  '{t} t · {k} kWh/día con luz': '{t} t · {k} kWh/day in sunlight',
  '{t} t · {k} kW día y noche': '{t} t · {k} kW day and night',
  '{t} t · recupera {p} % del agua': '{t} t · recovers {p} % of the water',
  '{t} t · {p} % de la comida': '{t} t · {p} % of the food',
  '{t} t · +{a} kg agua/día · {k} kWh': '{t} t · +{a} kg water/day · {k} kWh',
  '{t} t · {o} kg O₂/día del aire · {k} kWh': '{t} t · {o} kg O₂/day from the air · {k} kWh',
  'LANZAR': 'LAUNCH',
  // Misión
  'Cada <strong>Avanzar</strong> pasa un día. Si una barra llega a cero, la base falla. Toca un día pasado en la línea de tiempo para <strong>rebobinar</strong>.':
    'Each <strong>Advance</strong> moves one day forward. If a bar reaches zero, the base fails. Tap a past day on the timeline to <strong>rewind</strong>.',
  '¡Una llamarada! Las partículas llegan mañana. Activa el <strong>refugio</strong> antes de avanzar.':
    'A solar flare! The particles arrive tomorrow. Turn on the <strong>shelter</strong> before advancing.',
  'Viene una tormenta de polvo: los paneles casi no producirán. Ahorra energía: apaga el invernadero.':
    'A dust storm is coming: the panels will barely produce. Save energy: turn off the greenhouse.',
  'Hoy se apagó <strong>{x}</strong>. ¿Qué puedes cambiar?': 'Today <strong>{x}</strong> shut down. What can you change?',
  'Se puso el Sol: los paneles ya no producen. Solo cuentan las baterías y el reactor.': 'The Sun has set: the panels no longer produce. Only batteries and the reactor count now.',
  'kg O₂': 'kg O₂', 'kg agua': 'kg water', 'kg comida': 'kg food', 'salud': 'health', '/{n} ciencia': '/{n} science',
  'Día {n} de {t}': 'Day {n} of {t}',
  'Día {n}': 'Day {n}',
  'Día {n}, rebobinar aquí': 'Day {n}, rewind here',
  'Volviste al día {n}. Cambia tus decisiones y avanza.': 'You went back to day {n}. Change your decisions and advance.',
  'Se apagó: {x}': 'Shut down: {x}',
  'Rebobinados': 'Rewinds',
  'Volver al diseño de la base': 'Back to base design',
  'Decisiones para el día {n}': 'Decisions for day {n}',
  'Refugio': 'Shelter', 'Ración': 'Rations', 'Bitácora': 'Logbook',
  'Protege 90 % de la radiación de tormenta; ese día no hay ciencia': 'Blocks 90 % of storm radiation; no science that day',
  'Comen 20 % menos; baja la salud': 'Eat 20 % less; health drops',
  'Apágalo para ahorrar energía y agua': 'Turn it off to save energy and water',
  'Cerrar bitácora': 'Close logbook',
  'Aún no pasa ningún día.': 'No days have passed yet.',
  'Línea de tiempo: toca un día pasado para rebobinar': 'Timeline: tap a past day to rewind',
  'AVANZAR': 'ADVANCE', '1 día': '1 day', 'Avanzar 5 días': 'Advance 5 days',
  // Resultado
  'Misión cumplida': 'Mission accomplished',
  'Sobrevivieron': 'Survived', '{a} de {b}': '{a} of {b}', 'Días': 'Days', 'Ciencia': 'Science',
  'Siguiente: {x}': 'Next: {x}',
  'Prueba final y caso Artemis-7': 'Final test and Artemis-7 case',
  'Menú': 'Menu',
  'FALLA · DÍA {n}': 'FAILURE · DAY {n}',
  'Así ocurrió:': 'This is what happened:',
  'Rebobinar al día {n}': 'Rewind to day {n}',
  'Rediseñar la base': 'Redesign the base',
  'DATO NASA': 'NASA DATA', 'Fuente: {x}': 'Source: {x}',
  // Aprendizaje
  'Tu aprendizaje': 'Your learning',
  'Resumen →': 'Summary →',
  'Prueba inicial': 'Pre-test', 'Prueba final': 'Final test', 'Caso Artemis-7': 'Artemis-7 case',
  'Antes de jugar · 2 min': 'Before playing · 2 min',
  'Completa “{x}”': 'Complete “{x}”',
  'Lista para hacer': 'Ready to take',
  'Rúbrica 0–8 · después de la final': 'Rubric 0–8 · after the final test',
  'Repetir': 'Retake', 'Hacer': 'Start',
  'Comandante': 'Commander',
  'Ganancia de aprendizaje:': 'Learning gain:',
  'de lo que te faltaba aprender': 'of what you still had to learn',
  'Haz la prueba inicial y la final para ver tu ganancia.': 'Take the pre-test and the final test to see your gain.',
  'Rúbrica · Caso Artemis-7': 'Rubric · Artemis-7 case',
  '¡Aprendiste cómo se conectan los sistemas de una base! Eso es lo que hacen los ingenieros de la NASA.': 'You learned how the systems of a base are connected! That is what NASA engineers do.',
  'Cada falla que entiendes te acerca a ser comandante. ¡Vuelve a jugar!': 'Every failure you understand brings you closer to being a commander. Play again!',
  'Volver al menú': 'Back to menu',
  'Cerrar': 'Close',
  // Evaluación (pantallas)
  '{n} preguntas · 2 minutos': '{n} questions · 2 minutes',
  'Empezar': 'Start', 'Ahora no': 'Not now',
  '{t} · {i} de {n}': '{t} · {i} of {n}',
  'Correcta': 'Correct', 'Elegiste: {x}': 'You chose: {x}', 'Respuesta:': 'Answer:', 'Dato NASA: {x}': 'NASA data: {x}',
  'Continuar': 'Continue', 'Analizar la falla': 'Analyze the failure',
  'Ver la bitácora de Artemis-7': 'See the Artemis-7 logbook',
  'Criterio {i} de {n} · {x}': 'Criterion {i} of {n} · {x}',
  'Rúbrica · {x}': 'Rubric · {x}', 'Ver mi resumen': 'See my summary',
  // Fuentes
  'Fuentes': 'Sources', 'Datos NASA usados': 'NASA data used',
  'verificado': 'verified', 'por verificar': 'to be verified',
  'Cada número de la simulación tiene una fuente. Los valores de equilibrio del juego (masa de los paneles, energía del invernadero…) están aparte en <code>data/juego.json</code> y no se presentan como datos NASA.':
    'Every number in the simulation has a source. Game-balance values (panel mass, greenhouse energy…) are kept separately in <code>data/juego.json</code> and are not presented as NASA data.',
  // Sistemas que se apagan (vienen del motor)
  'soporte': 'life support', 'electrolizador': 'electrolyzer', 'reciclador': 'water recycler', 'invernadero': 'greenhouse',
  'extractor': 'ice extractor', 'moxie': 'MOXIE', 'reciclador (averiado)': 'water recycler (broken)', 'electrolizador (sin agua)': 'electrolyzer (no water)',
  // Análisis de fallas (vienen del motor)
  'Te quedaste sin agua para fabricar oxígeno': 'You ran out of water to make oxygen',
  'La noche lunar dejó tu base sin energía': 'The lunar night left your base without power',
  'La base consume más energía de la que produce': 'The base uses more energy than it produces',
  'La tormenta de polvo tapó tus paneles': 'The dust storm covered your panels',
  'Faltó oxígeno': 'Not enough oxygen',
  'Sin reciclador, el agua se acaba rápido': 'Without a recycler, water runs out fast',
  'El reciclador dejó de funcionar': 'The recycler stopped working',
  'Se acabó la comida': 'The food ran out',
  'La tormenta solar atrapó a la tripulación fuera del refugio': 'The solar storm caught the crew outside the shelter',
  'Demasiada radiación acumulada': 'Too much accumulated radiation',
  'La tripulación se debilitó por comer poco': 'The crew got weak from eating too little',
  'Sobreviviste, pero faltó ciencia': 'You survived, but there was not enough science',
  'El electrolizador no pudo partir agua para hacer O₂': 'The electrolyzer could not split water to make O₂',
  'El oxígeno se agotó': 'The oxygen ran out',
  'El soporte vital se apagó': 'Life support shut down',
  'Sin energía, el electrolizador dejó de fabricar oxígeno': 'Without power, the electrolyzer stopped making oxygen',
  'Sin energía, no se fabricó oxígeno': 'Without power, no oxygen was made',
  'Sin electrolizador no hay oxígeno nuevo': 'Without the electrolyzer there is no new oxygen',
  'El oxígeno de reserva no alcanzó': 'The oxygen reserve was not enough',
  'La base no tenía reciclador de agua': 'The base had no water recycler',
  'Cada día se perdía toda el agua usada': 'All used water was lost every day',
  'Sin reciclar, se pierde toda el agua usada': 'Without recycling, all used water is lost',
  'La comida de reserva no alcanzó': 'The food reserve was not enough',
  'La dosis superó el límite de la misión': 'The dose went over the mission limit',
  'La Luna no tiene atmósfera ni campo magnético': 'The Moon has no atmosphere or magnetic field',
  'Cada día suma dosis': 'Every day adds dose',
  'Se superó el límite de la misión': 'The mission limit was exceeded',
  'Muchos días seguidos con ración reducida': 'Many days in a row on reduced rations',
  'La salud cayó a cero': 'Health dropped to zero',
  'Los días en el refugio no suman ciencia': 'Days in the shelter add no science',
  'Lleva más agua o instala el reciclador: cada kilo de oxígeno cuesta 1,125 kg de agua.': 'Bring more water or install the recycler: every kilo of oxygen costs 1.125 kg of water.',
  'Lleva más agua o instala el reciclador: cada kilo de oxígeno cuesta 1,125 kg de agua. O usa el extractor: saca hielo del suelo lunar.': 'Bring more water or install the recycler: every kilo of oxygen costs 1.125 kg of water. Or use the extractor: it gets ice out of the lunar soil.',
  'Lleva más agua o instala el reciclador: cada kilo de oxígeno cuesta 1,125 kg de agua. En Marte, MOXIE fabrica oxígeno con el aire, sin gastar agua.': 'Bring more water or install the recycler: every kilo of oxygen costs 1.125 kg of water. On Mars, MOXIE makes oxygen from the air without using water.',
  'En Marte el Sol es débil y el polvo puede taparlo por días. Lleva baterías para aguantar la tormenta… o un reactor, que no depende del Sol.': 'On Mars the Sun is weak and dust can block it for days. Bring batteries to ride out the storm… or a reactor, which does not depend on the Sun.',
  'La noche lunar dura casi 15 días. Necesitas muchas baterías… o un reactor que funcione día y noche.': 'The lunar night lasts almost 15 days. You need many batteries… or a reactor that works day and night.',
  'Añade paneles o baterías, o apaga el invernadero en los días críticos.': 'Add panels or batteries, or turn off the greenhouse on critical days.',
  'Lleva más oxígeno de reserva.': 'Bring more oxygen in reserve.',
  'La ISS recupera el 98 % de su agua. Con reciclador, una misión larga necesita muy poca agua de reserva.': 'The ISS recovers 98 % of its water. With a recycler, a long mission needs very little reserve water.',
  'Lleva una reserva de agua para cuando el reciclador falle.': 'Bring a water reserve for when the recycler fails.',
  'Calcula: personas × días × comida diaria. El invernadero produce parte de la comida, pero gasta agua y energía.': 'Calculate: people × days × daily food. The greenhouse makes part of the food, but uses water and energy.',
  'Cuando haya alerta solar, activa el refugio para el día siguiente.': 'When there is a solar alert, turn on the shelter for the next day.',
  'Añade blindaje de regolito.': 'Add regolith shielding.',
  'Usa la ración reducida solo unos pocos días.': 'Use reduced rations for only a few days.',
  'Usa el refugio solo cuando sea necesario. El invernadero suma ciencia extra.': 'Use the shelter only when needed. The greenhouse adds extra science.',
};

const PATRONES = [
  [/^Día (\d+): se puso el Sol y los paneles dejaron de producir$/, 'Day $1: the Sun set and the panels stopped producing'],
  [/^Día (\d+): las baterías se vaciaron$/, 'Day $1: the batteries ran empty'],
  [/^Día (\d+): la energía no alcanzó$/, 'Day $1: there was not enough energy'],
  [/^Día (\d+): no quedaba agua suficiente$/, 'Day $1: there was not enough water left'],
  [/^Día (\d+): llegó la tormenta de polvo y los paneles recibieron solo un cuarto de la luz$/, 'Day $1: the dust storm arrived and the panels got only a quarter of the light'],
  [/^Día (\d+): despensa vacía$/, 'Day $1: empty pantry'],
  [/^Día (\d+): se acabó el agua$/, 'Day $1: the water ran out'],
  [/^Día (\d+): llegaron las partículas y la tripulación no estaba en el refugio$/, 'Day $1: the particles arrived and the crew was not in the shelter'],
  [/^Día (\d+): alerta de llamarada$/, 'Day $1: solar flare alert'],
  [/^Día (\d+): el reciclador se quedó sin energía$/, 'Day $1: the recycler ran out of power'],
  [/^Día (\d+): (.+)$/, 'Day $1: $2'],
  [/^Se apagó: (.+)$/, (_, x) => `Shut down: ${x.split(', ').map((y) => EN[y] || y).join(', ')}`],
  [/^(\d+) astronautas × (\d+) días$/, '$1 astronauts × $2 days'],
  [/^Ciencia lograda: (\d+) de (\d+)$/, 'Science achieved: $1 of $2'],
];
