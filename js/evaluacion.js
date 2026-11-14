// Prueba inicial, prueba final y caso Artemis-7 (rúbrica 0–8).
// Las funciones de puntaje son puras (se prueban con node --test); las de pantalla reciben el contenedor.

/** Puntaje de una prueba de opción múltiple: 1 punto por respuesta correcta. */
export function puntuarPrueba(prueba, respuestas) {
  const detalle = prueba.preguntas.map((p, i) => ({ concepto: p.concepto, elegida: respuestas[i] ?? null, correcta: respuestas[i] === p.correcta }));
  return { puntaje: detalle.filter((d) => d.correcta).length, maximo: prueba.preguntas.length, detalle };
}

/** Nivel según la escala del MINEDU (AD, A, B, C). */
export function nivel(puntaje, niveles) {
  return niveles.find((n) => puntaje >= n.min);
}

/** Puntaje de la rúbrica: cada criterio vale lo que vale la opción elegida (0, 1 o 2). */
export function puntuarRubrica(caso, respuestas, niveles) {
  const criterios = caso.criterios.map((c, i) => {
    const op = c.opciones[respuestas[i]];
    return { id: c.id, nombre: c.nombre, puntos: op ? op.puntos : 0, elegida: respuestas[i] ?? null };
  });
  const puntaje = criterios.reduce((s, c) => s + c.puntos, 0);
  return { puntaje, maximo: caso.criterios.length * 2, criterios, nivel: nivel(puntaje, niveles) };
}

/** Ganancia de aprendizaje normalizada (Hake): cuánto se avanzó de lo que se podía avanzar. */
export function ganancia(inicial, final, maximo) {
  if (inicial == null || final == null) return null;
  if (inicial >= maximo) return final >= maximo ? 0 : null;
  return Math.round(((final - inicial) / (maximo - inicial)) * 100) / 100;
}

// ───────────────────────── Pantallas ─────────────────────────

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETRAS = 'ABCD';

function progreso(i, n) {
  return `<div class="progreso-eval" aria-label="Pregunta ${i + 1} de ${n}">${Array.from({ length: n }, (_, k) => `<span class="${k < i ? 'hecho' : k === i ? 'actual' : ''}"></span>`).join('')}</div>`;
}

/**
 * Muestra una prueba pregunta por pregunta.
 * @param {HTMLElement} $app
 * @param {object} prueba     de data/evaluacion.json (inicial o final)
 * @param {object} opciones   { conRespuestas, nasa, alTerminar(resultado), alSaltar? }
 *   conRespuestas: al final muestra puntaje y respuestas correctas (prueba final); la inicial no enseña nada.
 */
export function mostrarPrueba($app, prueba, { conRespuestas, nasa, alTerminar, alSaltar }) {
  const respuestas = [];
  const n = prueba.preguntas.length;

  function intro() {
    window.scrollTo(0, 0);
    $app.innerHTML = `
      <section class="tarjeta eval-intro">
        <p class="lema">${esc(prueba.titulo)}</p>
        <h2>${n} preguntas · 2 minutos</h2>
        <p class="suave">${esc(prueba.intro)}</p>
      </section>
      <div class="fila">
        <button class="primario" id="empezar">Empezar</button>
        ${alSaltar ? '<button class="fantasma" id="saltar">Ahora no</button>' : ''}
      </div>`;
    $app.querySelector('#empezar').addEventListener('click', () => pregunta(0));
    if (alSaltar) $app.querySelector('#saltar').addEventListener('click', alSaltar);
  }

  function pregunta(i) {
    window.scrollTo(0, 0);
    const p = prueba.preguntas[i];
    $app.innerHTML = `
      ${progreso(i, n)}
      <p class="lema">${esc(prueba.titulo)} · ${i + 1} de ${n}</p>
      <h2 class="pregunta">${esc(p.texto)}</h2>
      <div class="opciones">${p.opciones.map((o, k) => `<button class="opcion" data-op="${k}"><span class="letra">${LETRAS[k]}</span>${esc(o)}</button>`).join('')}</div>`;
    $app.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      respuestas[i] = +b.dataset.op;
      if (i + 1 < n) pregunta(i + 1); else fin();
    }));
  }

  function fin() {
    const r = { ...puntuarPrueba(prueba, respuestas), respuestas: [...respuestas] };
    if (!conRespuestas) return alTerminar(r);
    window.scrollTo(0, 0);
    const items = prueba.preguntas.map((p, i) => {
      const ok = r.detalle[i].correcta;
      const c = nasa?.cifras[p.dato];
      return `<div class="tarjeta revision ${ok ? 'bien' : 'mal'}">
        <p class="chico">${ok ? '✅ Correcta' : '❌ Elegiste: ' + esc(p.opciones[respuestas[i]] ?? '—')}</p>
        <h3>${esc(p.texto)}</h3>
        <p><b>Respuesta:</b> ${esc(p.opciones[p.correcta])}</p>
        ${p.explicacion ? `<p class="suave">${esc(p.explicacion)}</p>` : ''}
        ${c ? `<a class="chico" href="${esc(c.url)}" target="_blank" rel="noopener">Dato NASA: ${esc(c.fuente)}</a>` : ''}
      </div>`;
    }).join('');
    $app.innerHTML = `
      <section class="tarjeta centrado"><p class="lema">${esc(prueba.titulo)}</p>
        <div class="nivel-res"><b>${r.puntaje}</b><span>/ ${r.maximo}</span></div></section>
      ${items}
      <div class="fila"><button class="primario" id="seguir">Continuar</button></div>`;
    $app.querySelector('#seguir').addEventListener('click', () => alTerminar(r));
  }

  intro();
}

/**
 * Caso Artemis-7: escenario nuevo + rúbrica 0–8.
 * @param {object} opciones { niveles, alTerminar(resultado) }
 */
export function mostrarCaso($app, caso, { niveles, alTerminar }) {
  const respuestas = [];
  const n = caso.criterios.length;

  const cabecera = `
    <section class="tarjeta caso">
      <p class="lema">${esc(caso.titulo)}</p>
      <p>${esc(caso.descripcion)}</p>
      <ol class="bitacora-caso">${caso.bitacora.map((b) => `<li>${esc(b)}</li>`).join('')}</ol>
    </section>`;

  function intro() {
    window.scrollTo(0, 0);
    $app.innerHTML = `${cabecera}
      <p class="suave">${esc(caso.intro)}</p>
      <div class="fila"><button class="primario" id="empezar">Analizar la falla</button></div>`;
    $app.querySelector('#empezar').addEventListener('click', () => criterio(0));
  }

  function criterio(i) {
    window.scrollTo(0, 0);
    const c = caso.criterios[i];
    $app.innerHTML = `
      ${progreso(i, n)}
      <details class="tarjeta"><summary>📜 Ver la bitácora de Artemis-7</summary><ol class="bitacora-caso">${caso.bitacora.map((b) => `<li>${esc(b)}</li>`).join('')}</ol></details>
      <p class="lema">Criterio ${i + 1} de ${n} · ${esc(c.nombre)}</p>
      <h2 class="pregunta">${esc(c.texto)}</h2>
      <div class="opciones">${c.opciones.map((o, k) => `<button class="opcion" data-op="${k}"><span class="letra">${LETRAS[k]}</span>${esc(o.texto)}</button>`).join('')}</div>`;
    $app.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      respuestas[i] = +b.dataset.op;
      if (i + 1 < n) criterio(i + 1); else fin();
    }));
  }

  function fin() {
    const r = puntuarRubrica(caso, respuestas, niveles);
    window.scrollTo(0, 0);
    const filas = caso.criterios.map((c, i) => {
      const op = c.opciones[respuestas[i]];
      return `<div class="criterio-res"><div class="entre"><b>${esc(c.nombre)}</b><span class="puntos p${op.puntos}">${op.puntos}/2</span></div>
        <p class="chico">${esc(op.texto)}</p><p class="chico suave">${esc(op.porque)}</p></div>`;
    }).join('');
    $app.innerHTML = `
      <section class="tarjeta centrado">
        <p class="lema">Rúbrica · ${esc(caso.titulo)}</p>
        <div class="nivel-res nivel-${r.nivel.codigo}"><b>${r.puntaje}</b><span>/ ${r.maximo}</span></div>
        <p><span class="pastilla">${r.nivel.codigo} · ${esc(r.nivel.nombre)}</span></p>
      </section>
      <section class="tarjeta">${filas}</section>
      <div class="fila"><button class="primario" id="listo">Ver mi resumen</button></div>`;
    $app.querySelector('#listo').addEventListener('click', () => alTerminar({ ...r, respuestas: [...respuestas] }));
  }

  intro();
}
