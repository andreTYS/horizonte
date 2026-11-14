// Landing de ASU STELLAR · Horizonte: la primera pantalla. El mapa 3D de fondo hace un recorrido
// de cámara que avanza con el scroll (la Tierra sobre el horizonte → la base → la antena → Marte).
import { t, getIdioma } from './i18n.js';

const I = (nombre) => `<svg class="i" aria-hidden="true"><use href="icons/sprite.svg#i-${nombre}"></use></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinNumero = (titulo) => titulo.replace(/^(Misión \d|Mission \d|Extra) · /, '');

/**
 * @param {object} o
 *   app: contenedor #app · mundo: Mundo 3D (o null) · misiones, nasa: datos ya en el idioma actual
 *   alJugar(), alHistoria(), alCambiarIdioma(): acciones
 */
export function mostrarLanding({ app, mundo, misiones, nasa, alJugar, alHistoria, alCambiarIdioma }) {
  document.body.dataset.pantalla = 'landing';
  const campana = misiones.filter((m) => !m.avanzada);
  const cuadros = ['03', '07', '11', '13'];
  const casos = [t('Ciclo lunar y reactor Fission Surface Power'), t('La ISS recupera ~98 % del agua'), t('Tormenta de polvo de 2018 y Opportunity'), t('Tormenta solar del 20 de mayo de 2024, medida por Curiosity')];
  const cifras = Object.keys(nasa.cifras).length;
  const pasos = [
    ['ajustes', t('Diseña'), t('Paneles, baterías, reactor, reciclador… sin pasarte de la masa del cohete.')],
    ['predecir', t('Predice'), t('¿Qué fallará primero? Decídelo antes de lanzar.')],
    ['cronoscopio', t('Adelanta'), t('El Cronoscopio simula día por día: noche lunar, tormentas, averías.')],
    ['alerta', t('Mira la causa'), t('Si algo falla, ves la cadena causa → efecto y el dato de NASA que lo explica.')],
    ['rebobinar', t('Rebobina'), t('Vuelve a un día pasado y cambia una decisión. Nunca hay game over.')],
    ['lapiz', t('Cuéntalo'), t('Escribe en tu bitácora qué cambiaste. Explicar es aprender.')],
  ];
  const tripulacion = [
    ['astronauta', t('Astronauta peruano'), t('Eres tú: comandas la expedición.')],
    ['astronauta-peruana', t('Astronauta peruana'), t('Guía de misión: enseña con preguntas.')],
    ['gato-piloto', t('Nebula, el gato piloto'), t('Te da pistas y te lleva de la Luna a Marte.')],
    ['llama-astronauta', t('Llama astronauta'), t('Presenta las fichas de ciencia y tus logros.')],
  ];

  app.innerHTML = `
  <div class="landing" id="landing">
    <nav class="landing-nav">
      <img src="assets/marca/logo-color.webp" alt="ASU STELLAR" class="landing-nav-logo" width="1200" height="800">
      <div class="landing-nav-acciones">
        <button class="boton-idioma" id="lIdioma" aria-label="${t('Idioma')}"><span class="${getIdioma() === 'es' ? 'activo' : ''}">ES</span><span class="${getIdioma() === 'en' ? 'activo' : ''}">EN</span></button>
        <a class="boton-enlace fantasma" href="docente.html">${I('aula')} <span>${t('Soy docente')}</span></a>
      </div>
    </nav>

    <section class="landing-hero">
      <div class="hero-logo" id="heroLogo"><img src="assets/marca/logo-color.webp" alt="ASU STELLAR" width="1200" height="800"><span class="hero-brillo" aria-hidden="true"></span></div>
      <p class="hero-sub-logo">Horizonte</p>
      <h1 class="hero-titulo">${t('Entrena para dirigir una base en la Luna y Marte')}</h1>
      <p class="hero-texto">${t('Un juego 3D para estudiantes de 7 a 12 años. Diseña tu base, predice qué fallará, adelanta el tiempo y, si algo sale mal, mira la causa y rebobina. Con datos reales de NASA.')}</p>
      <div class="hero-acciones">
        <button class="primario grande" id="lJugar">${I('cohete')} ${t('Jugar ahora')}</button>
        <button class="secundario" id="lHistoria">${I('historia')} ${t('Ver la historia')}</button>
      </div>
      <div class="hero-scroll" aria-hidden="true"><span></span>${t('Desliza para explorar')}</div>
    </section>

    <section class="landing-seccion revelar">
      <p class="lema">${t('Así se juega')}</p>
      <h2>${t('El error es la lección')}</h2>
      <ol class="pasos">${pasos.map(([ic, ti, tx], i) => `<li class="revelar" style="--d:${i * 80}ms"><span class="paso-ico">${I(ic)}</span><b>${ti}</b><p>${tx}</p></li>`).join('')}</ol>
    </section>

    <section class="landing-seccion revelar">
      <p class="lema">${t('La expedición')}</p>
      <h2>${t('Cuatro misiones, de la Luna a Marte')}</h2>
      <div class="misiones-landing">${campana.map((m, i) => `
        <article class="mision-landing revelar ${m.planeta === 'marte' ? 'marte' : ''}" style="--d:${i * 100}ms">
          <img src="assets/historia/cuadro-${cuadros[i] || '01'}.webp" alt="" loading="lazy" width="627" height="627">
          <div><span class="num">0${i + 1}</span><b>${esc(sinNumero(m.titulo))}</b><small>${esc(m.lugar)}</small><p>${esc(m.resumen)}</p>
          <span class="caso">${I('datos')} ${casos[i] || ''}</span></div>
        </article>`).join('')}</div>
    </section>

    <section class="landing-seccion revelar">
      <p class="lema">${t('La tripulación')}</p>
      <h2>${t('Una aventura espacial con identidad peruana')}</h2>
      <div class="tripulacion">${tripulacion.map(([img, nombre, txt], i) => `
        <figure class="revelar" style="--d:${i * 90}ms"><img src="assets/marca/${img}.webp" alt="" loading="lazy" style="--f:${i * 0.7}s"><figcaption><b>${nombre}</b><span>${txt}</span></figcaption></figure>`).join('')}</div>
    </section>

    <section class="landing-seccion revelar">
      <p class="lema">${t('Ciencia real')}</p>
      <h2>${t('Cada número tiene fuente y fecha')}</h2>
      <div class="contadores">
        <div><b data-contar="${cifras}">0</b><span>${t('datos de NASA con fuente')}</span></div>
        <div><b data-contar="4">0</b><span>${t('misiones de campaña')}</span></div>
        <div><b data-contar="2">0</b><span>${t('mundos: la Luna y Marte')}</span></div>
        <div><b data-contar="0">0</b><span>${t('game over: siempre puedes rebobinar')}</span></div>
      </div>
      <div class="chips-fuentes">${['NASA DONKI', 'Curiosity RAD', 'ISS ECLSS', 'LCROSS', 'MOXIE · Perseverance', 'Fission Surface Power', 'NASA BVAD', 'Veggie'].map((x) => `<span>${x}</span>`).join('')}</div>
    </section>

    <section class="landing-seccion revelar">
      <p class="lema">${t('Para docentes')}</p>
      <h2>${t('Hecho para el aula')}</h2>
      <ul class="docentes-lista">
        <li>${I('prueba')} ${t('Prueba inicial y final para medir cuánto aprendieron (ganancia normalizada).')}</li>
        <li>${I('caso')} ${t('Caso Artemis-7 con rúbrica 0–8 y escala del MINEDU (AD, A, B, C).')}</li>
        <li>${I('aula')} ${t('Modo aula: enlace o QR, inicio sin sonido y pausa de todo el salón desde tu panel.')}</li>
        <li>${I('lapiz')} ${t('Ves las predicciones y la bitácora de cada estudiante, y lo exportas a Excel.')}</li>
      </ul>
      <a class="secundario boton-enlace" href="docente.html">${I('aula')} ${t('Abrir el panel docente')}</a>
    </section>

    <section class="landing-final revelar">
      <h2>${t('¿Listo para la expedición?')}</h2>
      <button class="primario grande" id="lJugar2">${I('cohete')} ${t('Jugar ahora')}</button>
      <p class="chico suave">${t('Funciona en el celular y sin conexión. Gratis, sin registro y sin publicidad.')}</p>
      <p class="chico suave pie">Stellar Experience · Moquegua, Perú · ${t('Proyecto para NASA Space Apps Challenge 2026')}</p>
    </section>
  </div>`;

  const raiz = app.querySelector('#landing');
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // El scroll mueve la cámara 3D
  const alDesplazar = () => {
    const max = raiz.scrollHeight - raiz.clientHeight;
    const p = max > 0 ? raiz.scrollTop / max : 0;
    mundo?.cinematografia(p);
    mundo?.actualizar({ planeta: p > 0.82 ? 'marte' : 'luna', luz: true, tormenta: false, polvo: false, refugio: false });
    raiz.classList.toggle('desplazada', raiz.scrollTop > 40);
  };
  raiz.addEventListener('scroll', alDesplazar, { passive: true });
  alDesplazar();

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
  }, { root: raiz, threshold: 0.15 });
  raiz.querySelectorAll('.revelar').forEach((el) => obs.observe(el));

  // El logo sigue un poco al puntero (efecto 3D)
  const logo = app.querySelector('#heroLogo');
  if (!reducido) {
    raiz.addEventListener('pointermove', (ev) => {
      const x = ev.clientX / innerWidth - 0.5, y = ev.clientY / innerHeight - 0.5;
      logo.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) translateZ(0)`;
    }, { passive: true });
  }

  const jugar = () => { obs.disconnect(); mundo?.terminarCinematografia('portada'); alJugar(); };
  app.querySelector('#lJugar').addEventListener('click', jugar);
  app.querySelector('#lJugar2').addEventListener('click', jugar);
  app.querySelector('#lHistoria').addEventListener('click', () => { mundo?.terminarCinematografia('portada'); alHistoria(); });
  app.querySelector('#lIdioma').addEventListener('click', alCambiarIdioma);
}
