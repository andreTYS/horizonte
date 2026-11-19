// Landing de ASU STELLAR · Horizonte: la primera pantalla. El mapa 3D de fondo hace un recorrido
// de cámara que avanza con el scroll (la Tierra sobre el horizonte → la base → la antena → Marte).
// El estilo sigue el del sitio del proyecto (asu-stellar.vercel.app): noche violeta, títulos Unbounded,
// rótulos Space Mono, botones con relieve y paneles con borde de luz.
import { t, getIdioma } from './i18n.js';
import { abrirPanel } from './accesibilidad.js';

const I = (nombre) => `<svg class="i" aria-hidden="true"><use href="icons/sprite.svg#i-${nombre}"></use></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinNumero = (titulo) => titulo.replace(/^(Misión \d|Mission \d|Extra) · /, '').replace(/^(Episodio|Episode) 0 · /, '');

// Iconos propios de la portada: trazo grueso y redondeado con un relleno suave (class="t") del mismo color.
const ICONOS = {
  cohete: '<path class="t" d="M12 2.5c3 2.2 4.8 5.6 4.8 9.4V16H7.2v-4.1c0-3.8 1.8-7.2 4.8-9.4z"/><circle cx="12" cy="9.5" r="1.9"/><path d="M7.2 12.5 4 15.6v3.2l3.2-1.4M16.8 12.5l3.2 3.1v3.2l-3.2-1.4M10 19c0 1.4 2 3 2 3s2-1.6 2-3"/>',
  historia: '<path class="t" d="M12 6.2C10 4.8 7 4.3 4 4.8v13c3-.5 6 0 8 1.4 2-1.4 5-1.9 8-1.4v-13c-3-.5-6 0-8 1.4z"/><path d="M12 6.2v13"/>',
  accesibilidad: '<circle class="t" cx="12" cy="12" r="9.5"/><circle cx="12" cy="6.8" r="1.3" fill="currentColor"/><path d="m7 9.6 5 1.2 5-1.2M12 10.8v3.6m0 0-2.6 4.2m2.6-4.2 2.6 4.2"/>',
  docente: '<path class="t" d="m2 9 10-5 10 5-10 5z"/><path d="M6 11.2V16c2.4 2.2 9.600 2.2 12 0v-4.8M22 9v5.5"/>',
  disenar: '<path class="t" d="M6 18v-4a6 6 0 0 1 12 0v4z"/><path d="M3.500 18h17M10.300 18v-2.700a1.700 1.700 0 0 1 3.400 0V18M12 8V4.500m0 0 2.500 1.200"/>',
  predecir: '<path class="t" d="M12 3a6 6 0 0 0-4 10.500c.700.700 1 1.500 1 2.500h6c0-1 .300-1.800 1-2.500A6 6 0 0 0 12 3z"/><path d="M9.500 19h5M10.500 21.500h3M12 7.500v3.500m0 0-1.500-1.500M12 11l1.500-1.500"/>',
  adelantar: '<circle class="t" cx="12" cy="12" r="9"/><path d="M12 7v5l3.200 2M3 12a9 9 0 0 1 9-9M19.800 7.500A9 9 0 0 1 12 21"/><path d="m16.500 3.800 3.400 3.600-4.700 1"/>',
  causa: '<circle class="t" cx="10.500" cy="10.500" r="6.500"/><path d="m20.500 20.500-5.200-5.200M7 10.800h1.600l1.100-2.300 1.700 4.400 1-2.100H14"/>',
  rebobinar: '<path class="t" d="M12.500 5v14L3.500 12z"/><path d="M21 5.500v13L13 12z"/>',
  contar: '<rect class="t" x="5" y="3" width="14" height="18" rx="2.500"/><path d="M9 3v18M12 8h4M12 12h4M12 16h2.500"/>',
  prueba: '<rect class="t" x="5" y="4.500" width="14" height="17" rx="2.500"/><path d="M9 4.500V3.500a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M8.700 13.200l2.300 2.300 4.300-4.600"/>',
  rubrica: '<circle class="t" cx="12" cy="9" r="5.500"/><path d="m9 13.800-1.500 7.200 4.500-2.500 4.500 2.500-1.500-7.200M12 6.500l.900 1.700 1.800.300-1.300 1.300.300 1.900-1.700-.900-1.700.900.300-1.900-1.300-1.300 1.800-.300z"/>',
  aula: '<circle class="t" cx="9" cy="8" r="3.300"/><path d="M2.800 20c0-3.400 2.800-6.200 6.200-6.200s6.200 2.800 6.200 6.200M17 5.200a3 3 0 0 1 0 5.800M17.800 14.200c2.200.700 3.700 2.900 3.700 5.300"/>',
  tabla: '<rect class="t" x="3" y="4" width="18" height="16" rx="2.500"/><path d="M3 9.500h18M3 14.700h18M9.500 4v16"/>',
  flecha: '<path d="M5 12h14m0 0-5.500-5.500M19 12l-5.500 5.500"/>',
};
const ico = (nombre) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre]}</svg>`;

/**
 * @param {object} o
 *   app: contenedor #app · mundo: Mundo 3D (o null) · misiones, nasa: datos ya en el idioma actual
 *   alJugar(), alHistoria(), alCambiarIdioma(): acciones
 */
export function mostrarLanding({ app, mundo, misiones, nasa, alJugar, alHistoria, alCambiarIdioma }) {
  document.body.dataset.pantalla = 'landing';
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('menos-movimiento');
  const campana = misiones.filter((m) => !m.avanzada);
  // Misma numeración que el mapa: 00 = entrenamiento, 01–04 = campaña. Imagen, color y dato NASA van por misión, no por posición.
  const porMision = {
    cero: { num: '00', cuadro: '01', color: '#5BE3B0', caso: t('Noche lunar de ~15 días: paneles y baterías') },
    noche: { num: '01', cuadro: '03', color: '#FFD600', caso: t('Ciclo lunar y reactor Fission Surface Power') },
    amanecer: { num: '02', cuadro: '07', color: '#00D9F2', caso: t('La ISS recupera ~98 % del agua') },
    marte: { num: '03', cuadro: '11', color: '#FF7900', caso: t('Tormenta de polvo de 2018 y Opportunity') },
    tormenta_marte: { num: '04', cuadro: '13', color: '#E66BF0', caso: t('Tormenta solar del 20 de mayo de 2024, medida por Curiosity') },
  };
  const cifras = Object.keys(nasa.cifras).length;
  const pasos = [
    ['disenar', '#FFD600', t('Diseña'), t('Paneles, baterías, reactor, reciclador… sin pasarte de la masa del cohete.')],
    ['predecir', '#00D9F2', t('Predice'), t('¿Qué fallará primero? Decídelo antes de lanzar.')],
    ['adelantar', '#FF9A3D', t('Adelanta'), t('El Cronoscopio simula día por día: noche lunar, tormentas, averías.')],
    ['causa', '#E66BF0', t('Mira la causa'), t('Si algo falla, ves la cadena causa → efecto y el dato de NASA que lo explica.')],
    ['rebobinar', '#5BE3B0', t('Rebobina'), t('Vuelve a un día pasado y cambia una decisión. Nunca hay game over.')],
    ['contar', '#CDB8FF', t('Cuéntalo'), t('Escribe en tu bitácora qué cambiaste. Explicar es aprender.')],
  ];
  const tripulacion = [
    ['astronauta', t('Astronauta peruano'), t('Eres tú: comandas la expedición.')],
    ['astronauta-peruana', t('Astronauta peruana'), t('Guía de misión: enseña con preguntas.')],
    ['gato-piloto', t('Nebula, el gato piloto'), t('Te da pistas y te lleva de la Luna a Marte.')],
    ['llama-astronauta', t('Llama astronauta'), t('Presenta las fichas de ciencia y tus logros.')],
  ];
  const docentes = [
    ['prueba', t('Prueba inicial y final para medir cuánto aprendieron (ganancia normalizada).')],
    ['rubrica', t('Caso Artemis-7 con rúbrica 0–8 y escala del MINEDU (AD, A, B, C).')],
    ['aula', t('Modo aula: enlace o QR, inicio sin sonido y pausa de todo el salón desde tu panel.')],
    ['tabla', t('Ves las predicciones y la bitácora de cada estudiante, y lo exportas a Excel.')],
  ];
  const secciones = [
    ['sJuego', t('Cómo se juega')],
    ['sMisiones', t('Misiones')],
    ['sTripulacion', t('Tripulación')],
    ['sCiencia', t('Ciencia')],
    ['sDocentes', t('Docentes')],
  ];
  // Todas las secciones abren igual: rótulo, título y una línea que dice qué hay dentro.
  const cabecera = (id, lema, titulo, intro) => `
      <header class="seccion-cabecera">
        <p class="lema">${lema}</p>
        <h2 id="${id}T">${titulo}</h2>
        <p class="seccion-intro">${intro}</p>
      </header>`;
  const cinta = pasos.map(([, , titulo]) => `<span>${titulo}</span><span>✦</span>`).join('');
  const paradas = [[150, 17], [228, 8], [300, 5], [372, 8], [450, 17]];

  app.innerHTML = `
  <div class="landing" id="landing">
    <a class="saltar" href="#lContenido">${t('Saltar al contenido')}</a>
    <nav class="landing-nav" aria-label="${t('Portada')}">
      <button class="landing-marca" id="lInicio" aria-label="ASU STELLAR · ${t('Inicio')}"><img src="assets/marca/logo-blanco.png" alt="" width="900" height="600"></button>
      <ul class="landing-indice">${secciones.map(([id, nombre]) => `<li><button class="indice-enlace" data-ir="${id}">${nombre}</button></li>`).join('')}</ul>
      <div class="landing-nav-acciones">
        <button class="boton-idioma" id="lIdioma" aria-label="${t('Idioma')}"><span class="${getIdioma() === 'es' ? 'activo' : ''}">ES</span><span class="${getIdioma() === 'en' ? 'activo' : ''}">EN</span></button>
        <button class="boton-icono" id="lAcc" aria-label="${t('Accesibilidad')}" aria-haspopup="dialog">${ico('accesibilidad')}</button>
        <a class="boton-enlace" href="docente.html" aria-label="${t('Panel docente')}" title="${t('Panel docente')}">${ico('docente')} <span>${t('Soy docente')}</span></a>
      </div>
      <span class="landing-progreso" id="lProgreso" aria-hidden="true"></span>
    </nav>

    <section class="landing-hero" id="lContenido" tabindex="-1" aria-labelledby="lTitulo">
      <div class="hero-logo"><span class="hero-aura" aria-hidden="true"></span><img src="assets/marca/logo-color.webp" alt="ASU STELLAR" width="1200" height="800"><span class="hero-brillo" aria-hidden="true"></span></div>
      <div class="hero-col">
        <p class="hero-estado"><span class="vivo">${t('Señal activa')}</span><span>Horizonte</span><span>${t('Juego 3D · 7 a 12 años')}</span></p>
        <h1 class="hero-titulo" id="lTitulo"><span class="l1">${t('De la Luna')}</span> <span class="l2">${t('a Marte')}</span></h1>
        <p class="hero-texto"><b>${t('Entrena para dirigir una base en la Luna y Marte')}.</b> ${t('Diseña tu base, mira qué falla y por qué, y rebobina para corregirlo. Con datos reales de NASA.')}</p>
        <div class="hero-acciones">
          <button class="primario grande" id="lJugar">${ico('cohete')} ${t('Jugar ahora')}</button>
          <button class="secundario grande" id="lHistoria">${ico('historia')} ${t('Ver la historia')}</button>
        </div>
        <ul class="hero-datos" aria-label="${t('La expedición')}">
          <li><b>4</b><span>${t('Misiones')}</span></li>
          <li><b>${cifras}</b><span>${t('Datos NASA')}</span></li>
          <li><b>7–12</b><span>${t('Años')}</span></li>
          <li><b>0</b><span>Game over</span></li>
        </ul>
        <svg class="hero-ruta" viewBox="0 0 600 78" role="img" aria-label="${t('Ruta de la expedición: de la Luna a Marte en cinco paradas')}">
          <defs><radialGradient id="rLuna" cx=".35" cy=".35"><stop offset="0" stop-color="#E9E4FF"/><stop offset="1" stop-color="#7C72A8"/></radialGradient><radialGradient id="rMarte" cx=".35" cy=".35"><stop offset="0" stop-color="#FFB27A"/><stop offset="1" stop-color="#B8431B"/></radialGradient></defs>
          <path id="rCamino" d="M34 44 C 170 -8, 430 -8, 566 44" fill="none" stroke="#00D9F2" stroke-width="2" stroke-dasharray="6 8" opacity=".75"/>
          <circle cx="34" cy="44" r="17" fill="url(#rLuna)"/><circle cx="566" cy="44" r="19" fill="url(#rMarte)"/>
          ${paradas.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="7.5" fill="#160C2B" stroke="${['#5BE3B0', '#FFD600', '#00D9F2', '#FF7900', '#E66BF0'][i]}" stroke-width="3"/>`).join('')}
          ${reducido ? '' : '<circle r="5" fill="#fff"><animateMotion dur="7s" repeatCount="indefinite"><mpath href="#rCamino"/></animateMotion><animate attributeName="opacity" values="0;1;1;0" dur="7s" repeatCount="indefinite"/></circle>'}
          <text x="34" y="76" text-anchor="middle">${t('Luna')}</text><text x="566" y="76" text-anchor="middle">${t('Marte')}</text>
        </svg>
        <p class="hero-nota">${t('Gratis · Sin registro · Funciona sin conexión')}</p>
      </div>
    </section>

    <div class="cinta" aria-hidden="true"><div class="cinta-pista">${cinta}${cinta}${cinta}${cinta}</div></div>

    <section class="landing-seccion revelar" id="sJuego" aria-labelledby="sJuegoT">
      ${cabecera('sJuego', t('Así se juega'), t('El error es la lección'), t('Seis pasos que se repiten en cada misión. Si algo sale mal no pierdes: miras la causa y corriges.'))}
      <ol class="pasos">${pasos.map(([ic, color, ti, tx], i) => `<li class="luz revelar" style="--d:${i * 60}ms;--c:${color}"><span class="paso-ico">${ico(ic)}</span><div><span class="paso-num">${t('Paso')} ${String(i + 1).padStart(2, '0')}</span><b>${ti}</b><p>${tx}</p></div></li>`).join('')}</ol>
    </section>

    <section class="landing-seccion revelar" id="sMisiones" aria-labelledby="sMisionesT">
      ${cabecera('sMisiones', t('La expedición'), t('Un entrenamiento y cuatro misiones, de la Luna a Marte'), t('Empiezas en la Luna con una base pequeña y terminas en Marte. Cada misión usa un dato real de NASA.'))}
      <ol class="misiones-landing" tabindex="0" aria-label="${t('Misiones')}">${campana.map((m, i) => {
        const d = porMision[m.id] || { num: String(i).padStart(2, '0'), cuadro: '01', color: '#00D9F2', caso: '' };
        const enMarte = m.planeta === 'marte';
        return `
        <li class="mision-landing luz revelar" style="--d:${i * 70}ms;--c:${d.color}">
          <div class="mision-foto"><img src="assets/historia/cuadro-${d.cuadro}.webp" alt="" loading="lazy" width="627" height="627"></div>
          <div class="mision-cuerpo">
            <p class="mision-donde"><span class="mision-num">${m.id === 'cero' ? t('Entrenamiento') : t('Misión')} ${d.num}</span><span class="mision-mundo">${enMarte ? t('Marte') : t('Luna')}</span></p>
            <h3>${esc(sinNumero(m.titulo))}</h3>
            <small>${esc(m.lugar)}</small>
            <p>${esc(m.resumen)}</p>
            ${d.caso ? `<p class="caso"><b>${t('Dato NASA')}</b> ${d.caso}</p>` : ''}
          </div>
        </li>`;
      }).join('')}</ol>
      <p class="pista-carrusel" aria-hidden="true">${t('Desliza hacia el lado para ver las cinco')} ${ico('flecha')}</p>
    </section>

    <section class="landing-seccion revelar" id="sTripulacion" aria-labelledby="sTripulacionT">
      ${cabecera('sTripulacion', t('La tripulación'), t('Una aventura espacial con identidad peruana'), t('Cuatro compañeros te acompañan en toda la expedición.'))}
      <div class="tripulacion">${tripulacion.map(([img, nombre, txt], i) => `
        <figure class="luz revelar" style="--d:${i * 70}ms"><img src="assets/marca/${img}.webp" alt="" loading="lazy" style="--f:${i * 0.7}s"><figcaption><b>${nombre}</b><span>${txt}</span></figcaption></figure>`).join('')}</div>
    </section>

    <section class="landing-seccion revelar" id="sCiencia" aria-labelledby="sCienciaT">
      ${cabecera('sCiencia', t('Ciencia real'), t('Cada número tiene fuente y fecha'), t('Lo que ves en el juego sale de misiones y mediciones reales.'))}
      <div class="contadores">
        <div><b data-contar="${cifras}">0</b><span>${t('datos de NASA con fuente')}</span></div>
        <div><b data-contar="4">0</b><span>${t('misiones de campaña')}</span></div>
        <div><b data-contar="2">0</b><span>${t('mundos: la Luna y Marte')}</span></div>
        <div><b data-contar="0">0</b><span>${t('game over: siempre puedes rebobinar')}</span></div>
      </div>
      <p class="fuentes-titulo">${t('Fuentes que usa el juego')}</p>
      <ul class="chips-fuentes">${['NASA DONKI', 'Curiosity RAD', 'ISS ECLSS', 'LCROSS', 'MOXIE · Perseverance', 'Fission Surface Power', 'NASA BVAD', 'Veggie'].map((x) => `<li>${x}</li>`).join('')}</ul>
    </section>

    <section class="landing-seccion revelar" id="sDocentes" aria-labelledby="sDocentesT">
      ${cabecera('sDocentes', t('Para docentes'), t('Hecho para el aula'), t('Mide el aprendizaje y acompaña a tu clase desde un solo panel.'))}
      <ul class="docentes-lista">${docentes.map(([ic, txt]) => `<li class="luz"><span class="paso-ico">${ico(ic)}</span><span>${txt}</span></li>`).join('')}</ul>
      <div class="seccion-accion"><a class="boton-enlace grande" href="docente.html">${ico('docente')} ${t('Abrir el panel docente')}</a></div>
    </section>

    <section class="landing-final revelar" aria-labelledby="lFinalT">
      <img src="assets/marca/logo-color.webp" alt="" loading="lazy" width="1200" height="800">
      <h2 id="lFinalT">${t('¿Listo para la expedición?')}</h2>
      <p>${t('Funciona en el celular y sin conexión. Gratis, sin registro y sin publicidad.')}</p>
      <button class="primario grande" id="lJugar2">${ico('cohete')} ${t('Jugar ahora')}</button>
    </section>
    <footer class="landing-pie">Stellar Experience · Moquegua, Perú · ${t('Proyecto para NASA Space Apps Challenge 2026')}</footer>
  </div>`;

  const raiz = app.querySelector('#landing');
  const progreso = app.querySelector('#lProgreso');
  const enlaces = [...app.querySelectorAll('.indice-enlace')];
  const destinos = enlaces.map((b) => app.querySelector('#' + b.dataset.ir));

  // El scroll mueve la cámara 3D, la barra de avance y marca la sección en la que estás
  const alDesplazar = () => {
    const max = raiz.scrollHeight - raiz.clientHeight;
    const p = max > 0 ? raiz.scrollTop / max : 0;
    mundo?.cinematografia(p);
    mundo?.actualizar({ planeta: p > 0.82 ? 'marte' : 'luna', luz: true, tormenta: false, polvo: false, refugio: false });
    raiz.classList.toggle('desplazada', raiz.scrollTop > 40);
    progreso.style.transform = `scaleX(${p.toFixed(4)})`;
    let activa = '';
    for (const sec of destinos) if (sec.getBoundingClientRect().top < innerHeight * 0.45) activa = sec.id;
    for (const b of enlaces) {
      if (b.dataset.ir === activa) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
  };
  raiz.addEventListener('scroll', alDesplazar, { passive: true });
  alDesplazar();

  // Índice de la cabecera, logo (volver arriba) y enlace para saltar al contenido
  const irA = (el) => {
    const y = el ? el.getBoundingClientRect().top + raiz.scrollTop - 84 : 0;
    raiz.scrollTo({ top: Math.max(0, y), behavior: reducido ? 'auto' : 'smooth' });
  };
  app.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => irA(app.querySelector('#' + b.dataset.ir))));
  app.querySelector('#lInicio').addEventListener('click', () => irA(null));
  app.querySelector('.saltar').addEventListener('click', (ev) => { ev.preventDefault(); app.querySelector('#lContenido').focus(); });

  // Las tarjetas se iluminan donde pasa el puntero
  raiz.addEventListener('pointermove', (ev) => {
    const el = ev.target.closest?.('.luz');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    el.style.setProperty('--my', `${ev.clientY - r.top}px`);
  }, { passive: true });

  // Aparecer al entrar en pantalla + contadores
  const contar = (el) => {
    const fin = +el.dataset.contar, t0 = performance.now(), dur = reducido ? 0 : 1200;
    const paso = (ahora) => {
      const k = dur ? Math.min(1, (ahora - t0) / dur) : 1;
      el.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('visible');
      e.target.querySelectorAll('[data-contar]').forEach(contar);
      obs.unobserve(e.target);
    }
  }, { root: raiz, threshold: 0.12 });
  raiz.querySelectorAll('.revelar').forEach((el) => obs.observe(el));

  const jugar = () => { obs.disconnect(); mundo?.terminarCinematografia('portada'); alJugar(); };
  app.querySelector('#lJugar').addEventListener('click', jugar);
  app.querySelector('#lJugar2').addEventListener('click', jugar);
  app.querySelector('#lHistoria').addEventListener('click', () => { mundo?.terminarCinematografia('portada'); alHistoria(); });
  app.querySelector('#lIdioma').addEventListener('click', alCambiarIdioma);
  app.querySelector('#lAcc').addEventListener('click', () => abrirPanel({ mundo, I }));
}
