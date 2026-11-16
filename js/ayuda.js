// Guía con la llama: explica cada parte de la pantalla, una por una.
// Cada elemento lleva además un «?» numerado: el niño puede tocar el que quiera y saltar directo a él.
// Lo usan el juego (botón «?» en todas las pantallas) y el panel docente (asistente).

/**
 * @param {Array<[string, string]>} pasos  [selector, texto]; los que no están en pantalla se omiten
 * @param {object} o  { textos: {saltar, siguiente, anterior, listo, titulo}, hablar(texto), imagen, alCerrar() }
 */
export function guiaPantalla(pasos, o = {}) {
  document.getElementById('recorrido')?.remove();
  const tx = { saltar: 'Cerrar', siguiente: 'Siguiente', anterior: 'Anterior', listo: '¡Listo!', titulo: '¿Qué es cada cosa?', pregunta: '¿Qué es esto?', ...o.textos };
  const lista = pasos.filter(([sel]) => visible(document.querySelector(sel)));
  if (!lista.length) return null;
  let i = 0;
  const capa = document.createElement('div');
  capa.id = 'recorrido';
  capa.innerHTML = `<div class="recorrido-foco"></div><div class="recorrido-pines"></div>
    <div class="recorrido-globo" role="dialog" aria-live="polite" aria-label="${tx.titulo}">
    <img src="${o.imagen || 'assets/marca/llama-astronauta.webp'}" alt="" width="72" height="72"><div><p id="recorridoTexto"></p>
    <div class="fila"><button class="fantasma chico" id="recorridoSalir">${tx.saltar}</button>
    <span class="recorrido-n" id="recorridoN"></span>
    <span class="fila-der"><button class="fantasma chico" id="recorridoAnt" aria-label="${tx.anterior}">◀</button><button class="primario chico" id="recorridoSig">${tx.siguiente} ▶</button></span></div></div></div>`;
  document.body.appendChild(capa);
  const foco = capa.querySelector('.recorrido-foco'), globo = capa.querySelector('.recorrido-globo'), pines = capa.querySelector('.recorrido-pines');
  const cerrar = () => { capa.remove(); window.removeEventListener('resize', mostrar); document.removeEventListener('keydown', tecla); o.alCerrar?.(); };

  function ponerPines() {
    pines.innerHTML = lista.map(([sel], k) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      if (!r) return '';
      const x = Math.min(innerWidth - 30, Math.max(4, r.right - 14)), y = Math.min(innerHeight - 30, Math.max(4, r.top - 10));
      return `<button class="pin-ayuda ${k === i ? 'activo' : ''}" style="left:${x}px;top:${y}px" data-k="${k}" aria-label="${tx.pregunta} ${k + 1}">?</button>`;
    }).join('');
    pines.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { i = +b.dataset.k; mostrar(); }));
  }

  function mostrar() {
    const [sel, txt] = lista[i];
    const el = document.querySelector(sel);
    if (!el) return cerrar();
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    Object.assign(foco.style, { left: `${r.left - 8}px`, top: `${r.top - 8}px`, width: `${r.width + 16}px`, height: `${Math.min(r.height, innerHeight * 0.6) + 16}px` });
    capa.querySelector('#recorridoTexto').textContent = txt;
    capa.querySelector('#recorridoN').textContent = `${i + 1} / ${lista.length}`;
    capa.querySelector('#recorridoSig').textContent = i === lista.length - 1 ? tx.listo : `${tx.siguiente} ▶`;
    capa.querySelector('#recorridoAnt').disabled = i === 0;
    // el globo va donde haya espacio: debajo o encima del elemento, sin salirse de la pantalla
    const alto = globo.offsetHeight || 180;
    const abajo = r.bottom + alto + 20 < innerHeight;
    const arriba = r.top - alto - 20 > 0;
    globo.style.top = `${abajo ? r.bottom + 14 : arriba ? r.top - alto - 14 : Math.max(10, innerHeight - alto - 10)}px`;
    globo.style.left = `${Math.max(10, Math.min(innerWidth - Math.min(420, innerWidth - 20) - 10, r.left))}px`;
    ponerPines();
    o.hablar?.(txt);
    capa.querySelector('#recorridoSig').focus({ preventScroll: true });
  }
  const tecla = (e) => {
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowRight' && i < lista.length - 1) { i += 1; mostrar(); }
    if (e.key === 'ArrowLeft' && i > 0) { i -= 1; mostrar(); }
  };
  capa.querySelector('#recorridoSig').addEventListener('click', () => { i += 1; if (i >= lista.length) cerrar(); else mostrar(); });
  capa.querySelector('#recorridoAnt').addEventListener('click', () => { if (i > 0) { i -= 1; mostrar(); } });
  capa.querySelector('#recorridoSalir').addEventListener('click', cerrar);
  window.addEventListener('resize', mostrar);
  document.addEventListener('keydown', tecla);
  mostrar();
  return { cerrar };
}

function visible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}
