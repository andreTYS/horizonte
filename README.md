# HORIZONTE · Ensaya el futuro de tu base

Juego educativo del equipo **Stellar Experience** (Moquegua, Perú) para el reto
**Build a Junior Astronaut Mission Trainer** del NASA Space Apps Challenge 2026.

**▶ Jugar:** https://andretys.github.io/horizonte/ (en el celular: menú → *Agregar a pantalla de inicio*)

> El estudiante dirige una base en la Luna, ve fallar su base, **entiende por qué** y **vuelve atrás en el tiempo** para corregirla.

## Cómo jugar

1. **Diseña la base**: paneles, baterías, reactor, reciclador, invernadero, blindaje y suministros, sin pasarte de la masa que lleva el cohete. El panel *¿Alcanza?* te ayuda a calcular.
2. **Adelanta el tiempo** día a día y toma decisiones: refugio, ración reducida, invernadero.
3. Si la base falla, HORIZONTE muestra **la cadena causa → efecto** y el **dato NASA** que la explica.
4. **Rebobina** a cualquier día pasado (toca la línea de tiempo) o rediseña la base. Menos rebobinados = más estrellas.

| Misión | Qué enseña |
|---|---|
| 1 · Primer amanecer | Equilibrio básico: energía → oxígeno → agua (tutorial guiado por Nebula) |
| 2 · La larga noche | La noche lunar dura ~15 días: baterías vs. reactor de fisión |
| 3 · Tormenta solar | Basada en la tormenta real de mayo de 2024: blindaje vs. refugio (sin pistas; abre la prueba final) |
| 4 · Hielo en la sombra | Sacar agua del hielo lunar (LCROSS) con el extractor |
| 5 · Todo sale mal | Micrometeorito, noche, tormenta y avería seguidos |
| 6 · Polvo en Marte | Menos luz solar, tormenta de polvo (como la que apagó a Opportunity) y MOXIE |

## Datos NASA

Todas las cifras reales están en [`data/nasa.json`](data/nasa.json), cada una con su fuente y enlace, y se muestran
dentro del juego (pantalla *Datos NASA usados* y al explicar cada falla). Los valores de **equilibrio del juego**
(masa de un panel, energía del invernadero, etc.) están aparte en [`data/juego.json`](data/juego.json): no se
presentan como datos NASA.

Fuentes principales: NASA BVAD (consumos de la tripulación), ECLSS de la ISS (98 % de recuperación de agua),
Fission Surface Power (40 kW), NASA Moon Facts (ciclo lunar), NASA HRP (límite de radiación), Curiosity RAD,
NASA DONKI (tormenta solar de mayo 2024), Veggie.

Cifras marcadas `"verificado": false` deben confirmarse en la fuente antes de la presentación.

Para traer eventos solares reales de DONKI (requiere internet):

```bash
NASA_API_KEY=tu_clave node tools/actualizar-donki.mjs 2024-05-01 2024-05-31
```

## Desarrollo

Sin frameworks ni compilación: HTML, CSS y JavaScript (módulos ES). Es una PWA instalable que funciona sin conexión.
El mapa de la base es 3D en tiempo real con **Three.js** (servido desde `vendor/`, sin CDN). Los modelos se pueden reemplazar por `.glb` hechos en Blender: ver [`assets/modelos/LEEME.md`](assets/modelos/LEEME.md). Sin WebGL, el juego usa la escena SVG de respaldo.

```bash
npm start      # juego + API en http://localhost:8080 (Node ≥ 22.5)
npm test       # pruebas del motor y del servidor (node --test)
```

| Archivo | Qué hace |
|---|---|
| `js/sim.js` | Motor de simulación puro (sin DOM): recursos, energía, radiación, eventos y análisis de fallas |
| `js/mundo3d.js` | Mapa 3D: terreno lunar, cielo, luces día/noche, sombras, bloom, tormenta, escudo, astronautas |
| `js/modelos3d.js` | Modelos 3D de cada módulo (exportables a `.glb` para Blender) |
| `js/escena.js` | Escena isométrica SVG de respaldo (equipos sin WebGL) |
| `tools/blender/modelos.py` | Script de Blender: modela hábitat, reactor y panel, exporta `.glb` y renderiza previas |
| `tools/visor.html` | Visor 3D: prueba estados y exporta modelos a `.glb` |
| `js/main.js` | Pantallas, HUD, decisiones, línea de tiempo y rebobinado |
| `js/i18n.js` | Español / inglés: textos de la interfaz y traducción del análisis de fallas (datos en `data/en/`) |
| `js/sonido.js` | Efectos reales (`assets/sonidos/`) + capas generadas con Web Audio (ambiente, tormentas, despegue) |
| `js/voz.js` | Voz de Nebula: audios pregenerados (`assets/voz/`) y voz del navegador como respaldo |
| `tools/voz/` | Genera la voz de Nebula con Piper TTS (`textos.mjs` lista las frases, `generar.py` las sintetiza) |
| `js/evaluacion.js` | Prueba inicial y final, caso Artemis-7 con rúbrica 0–8 (escala MINEDU) |
| `js/api.js` | Envía resultados al servidor si existe (en GitHub Pages el juego funciona sin él) |
| `server/server.mjs` | Servidor del VPS: estáticos, partidas (SQLite), panel docente, proxy NASA DONKI |
| `docente.html` | Panel docente: resultados por aula |
| `data/misiones.json` | Misiones, eventos, diseño sugerido y textos de Nebula |
| `docs/DISENO.md` | Documento de diseño: reglas exactas, arte, arquitectura |

## Despliegue

- **Demo:** GitHub Pages, automático en cada push a `main`.
- **Producción (VPS):** Docker detrás de Traefik (el reverse proxy del VPS). Guía paso a paso: [`deploy/VPS.md`](deploy/VPS.md).

## Próximos pasos

- Misión en Marte (MOXIE, RAD de Curiosity).
- Arte original de Nebula y de la base.

## Créditos de audio e íconos

- Efectos de sonido: **“Oculus Audio Pack 01”** de Oculus VR, LLC (Meta), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — ver [`assets/sonidos/ATRIBUCION-oculus-audio-pack.md`](assets/sonidos/ATRIBUCION-oculus-audio-pack.md).
- Voz de Nebula: [Piper TTS](https://github.com/rhasspy/piper) (MIT). Voz en español `mls_10246` (Multilingual LibriSpeech, CC BY 4.0); voz en inglés `amy` (mimic3-voices, licencia por confirmar).
- Íconos: [Lucide](https://lucide.dev) (ISC).

Para regenerar la voz tras cambiar textos de Nebula:

```bash
node tools/voz/textos.mjs > textos.json
python tools/voz/generar.py textos.json --piper venv/bin/piper --es voces/es-mls_10246-low.onnx --en voces/en-us-amy-low.onnx
```

## Equipo

Abel Fernando Sangama Oñate (Product Manager) · Juan Pablo Vivanco Vivanco (UX/UI) · Rosa Karen Fuertes Velasquez (UX Research) ·
André Tomás Yucra Silvestre (Líder de desarrollo) · Luis Angel Choquepura Puma (Programador) · Liliana Gabriela Fernandez Carrizales (Desarrolladora)
