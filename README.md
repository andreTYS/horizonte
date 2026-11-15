# ASU STELLAR · Horizonte

> Entrena para dirigir una base en la Luna y Marte.

**English:** [README.en.md](README.en.md) · [NASA data](docs/NASA-DATA.md) · [Use of AI](docs/USE-OF-AI.md)

Juego educativo del equipo **Stellar Experience** (Moquegua, Perú) para el reto
**Build a Junior Astronaut Mission Trainer** del NASA Space Apps Challenge 2026.

**▶ Jugar:** https://andretys.github.io/horizonte/ (en el celular: menú → *Agregar a pantalla de inicio*)

> Eres el astronauta peruano al mando de la expedición: diseñas la base, **predices** qué fallará, adelantas el tiempo con el **Cronoscopio**, ves **la causa** de cada falla y **rebobinas** para corregirla.

**ASU STELLAR** es la marca del producto (manual de marca 2026-01 y storyboard v2 del Product Owner, [asu-stellar.vercel.app](https://asu-stellar.vercel.app/)). **Horizonte** es este juego: el motor de simulación, el mapa 3D y las misiones.

## Cómo jugar

1. **Diseña la base**: paneles, baterías, reactor, reciclador, invernadero, blindaje y suministros, sin pasarte de la masa que lleva el cohete. El panel *¿Alcanza?* te ayuda a calcular.
2. **Adelanta el tiempo** día a día y toma decisiones: refugio, ración reducida, invernadero.
3. Si la base falla, HORIZONTE muestra **la cadena causa → efecto** y el **dato NASA** que la explica.
4. **Rebobina** a cualquier día pasado (toca la línea de tiempo) o rediseña la base. Menos rebobinados = más estrellas.

**Campaña · de la Luna a Marte** (lo que sobra de cada misión pasa como reserva a la siguiente):

| Misión | Qué enseña | Caso real |
|---|---|---|
| 1 · La noche larga (Luna) | Energía: la noche lunar dura ~15 días; baterías vs. reactor de fisión | Ciclo lunar, Fission Surface Power |
| 2 · Aire y agua (Luna) | Soporte vital: el oxígeno se fabrica con agua y energía; reciclar agua | La ISS recupera ~98 % del agua |
| 3 · Primera cosecha (Marte) | Alimentos y energía: menos luz, invernadero, tormenta de polvo, MOXIE | Tormenta de 2018 que apagó a Opportunity |
| 4 · Tormenta solar (Marte) | Radiación y retraso de comunicaciones: la alerta llega tarde, tú decides el refugio (sin pistas; abre la prueba final) | Evento del 20 de mayo de 2024 medido por Curiosity |

**Misiones extra** (sin pistas): Tormenta solar en la Luna (mayo 2024, DONKI), Hielo en la sombra (LCROSS), Todo sale mal.

**Ciclo de cada misión** (de ASU STELLAR): explora y decide → **predice** → adelanta con el Cronoscopio → mira la causa → rebobina → **cuéntalo** en la bitácora.

**Personajes:** Nebula es el gato piloto (voz y pistas); la astronauta peruana guía con preguntas (paso *Predice*); la llama presenta las fichas de ciencia y los logros.

## Modo demo (para el video)

`?demo=1` reproduce siempre la misma historia (~50 s): landing → misión 1 → predice → falla en la noche lunar → causa → rediseño con reactor → éxito.
No guarda progreso ni envía resultados. `&ritmo=1.5` lo hace más lento; `Esc` lo detiene.

## Accesibilidad

- **Panel de accesibilidad** (botón con la figura o tecla `?`): texto más grande, alto contraste, menos movimiento, vibración en las alarmas y lectura del estado cada día.
- **Lector de pantalla** (NVDA, TalkBack, VoiceOver): cada día se anuncia qué pasó; las alarmas interrumpen. Los recursos del HUD tienen nombre completo.
- **Escuchar** (botón con la oreja o tecla `E`): Nebula lee en voz alta el estado de la base.
- **Jugar con teclado**: `A` avanzar, `5` ×5, `R` refugio, `C` ración, `I` invernadero, `B` bitácora, `Z` rebobinar un día, `Esc` cerrar. El foco no se pierde al avanzar.
- Las alarmas siempre tienen texto (y vibran en el celular); la voz de Nebula siempre tiene su globo escrito. Sin violaciones WCAG 2 A/AA en la auditoría automática de axe-core (landing, menú, diseño, Predice, misión, panel).

## Recompensas, tripulación y base

- **Créditos estelares** al terminar cada misión: misión cumplida, estrellas, sin rebobinar, sin pistas, lograrlo después de un error y **predicción acertada** (también cuando la misión falla). Las reglas están en `js/recompensas.js` (con pruebas).
- **12 insignias** (Buen pronóstico, El error es la lección, Guardián de la noche, Explorador, Científico curioso…), +10 créditos cada una.
- **Tripulación personalizable** (Killa, Inti, Wayra, Sami): nombre, color del traje, franjas y visor; los colores nuevos se compran con créditos y se ven en el 3D.
- **Objetos de la base** (`js/objetos3d.js`): bandera del Perú, contenedores, torre meteorológica, y por créditos telescopio, huerto de papas andinas, antena de espacio profundo, dron explorador y estatua de la llama.
- **Primer plano**: al tocar un módulo, un objeto o un lugar del mapa, la cámara se acerca y se abre su ficha (qué hace, cuánto cuesta y su dato de NASA).

## Informe del comandante

Desde *Tu aprendizaje* → **Informe del comandante**: misiones con estrellas, intentos, predicciones acertadas, prueba inicial → final, ganancia,
rúbrica Artemis-7 y las frases de la bitácora, con firma del docente. Si completó las 4 misiones de la campaña se convierte en **certificado**.
Botón *Imprimir o guardar en PDF* (hoja A4 en blanco, lista para imprimir).

## Sin internet

Al abrir el juego una vez, se descargan también los modelos 3D, las voces, los sonidos y las imágenes (`precache.json`, ~8 MB): después funciona
sin conexión, incluso abriendo el enlace del aula. Tras cambiar voces o imágenes: `node tools/precache.mjs` (las pruebas avisan si falta).

## Para docentes: panel y modo aula

En `docente.html` cada docente **crea su clase y elige su propia clave** (como en Kahoot; si no da código se genera uno como `LUNA-4821`) o prueba una **clase de demostración** sin clave. La clave `DOCENTE_TOKEN` del servidor queda solo como acceso de administración. El panel muestra por clase:

- **Enlace y código QR** para estudiantes (`?aula=CODIGO&modo=aula`): el juego se abre con el aula puesta y **sin sonido ni voz** al inicio. Con *ritmo tranquilo* (`&ritmo=tranquilo`) se quita el botón ×5.
- **Pausar el aula**: los estudiantes en modo aula ven en unos 8 s una pantalla de pausa con tu mensaje; su partida no se pierde.
- **Aprendizaje** (prueba inicial/final, ganancia, rúbrica), **predicciones** (% de aciertos del paso *Predice*), **bitácora** (las frases de *Cuéntalo*), dónde fallan más y todas las partidas.
- **Exportar a CSV** (partidas y bitácoras), listo para Excel.

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
| `js/mundo3d.js` | Mapa 3D: cielo, luces día/noche, sombras, bloom, tormenta, escudo, astronautas, cámara para explorar |
| `js/viaje3d.js` | Viaje en 3D antes de cada misión: plataforma en la Tierra, despegue, ruta Tierra→Luna/Marte y aterrizaje en el puesto de avanzada |
| `js/astronauta3d.js` · `js/vestidor3d.js` | Astronauta 3D detallado (traje, visor, parche, accesorios, camina) y probador grande para personalizarlo |
| `js/globo3d.js` | Globo 3D de la Luna y de Marte con los lugares reales de cada misión |
| `js/terreno3d.js` | Terreno de 920 × 920 m: relieve, cordillera, cráteres, texturas generadas, huellas de rover y puntos de interés |
| `js/modelos3d.js` | Modelos 3D de cada módulo (exportables a `.glb` para Blender) |
| `js/escena.js` | Escena isométrica SVG de respaldo (equipos sin WebGL) |
| `tools/blender/modelos.py` | Script de Blender: modela hábitat, reactor y panel, exporta `.glb` y renderiza previas |
| `tools/visor.html` | Visor 3D: prueba estados y exporta modelos a `.glb` |
| `js/main.js` | Pantallas, HUD, decisiones, línea de tiempo y rebobinado |
| `js/i18n.js` | Español / inglés: textos de la interfaz y traducción del análisis de fallas (datos en `data/en/`) |
| `js/sonido.js` | Efectos reales (`assets/sonidos/`) + música de fondo generada con Web Audio (acordes suaves y caja musical, cambia de día, de noche y en tormenta) + tormentas y despegue |
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
- Voz de Nebula en español latino: [Piper TTS](https://github.com/rhasspy/piper) (MIT) con la voz `es_MX-claude-high` (Apache 2.0, fonética latinoamericana es-419).
- Voz de Nebula en inglés americano: [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache 2.0), voz `af_heart`, ejecutada con [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache 2.0).
- Íconos: [Lucide](https://lucide.dev) (ISC).
- Logo, personajes e ilustraciones del storyboard: manual de marca ASU STELLAR 2026-01 y storyboard v2 del equipo (ilustraciones generadas con IA). Tipografías Unbounded, Baloo 2, Noto Sans y Space Mono (SIL OFL).

Para regenerar la voz tras cambiar textos de Nebula:

```bash
node tools/voz/textos.mjs > textos.json
python tools/voz/generar.py textos.json --piper venv/bin/piper --es modelos/vits-piper-es_MX-claude-high/es_MX-claude-high.onnx --kokoro modelos/kokoro-multi-lang-v1_0
python tools/voz/verificar.py --whisper modelos/sherpa-onnx-whisper-small   # control: Whisper transcribe cada audio
```

## Equipo

Abel Fernando Sangama Oñate (Product Manager) · Juan Pablo Vivanco Vivanco (UX/UI) · Rosa Karen Fuertes Velasquez (UX Research) ·
André Tomás Yucra Silvestre (Líder de desarrollo) · Luis Angel Choquepura Puma (Programador) · Liliana Gabriela Fernandez Carrizales (Desarrolladora)
