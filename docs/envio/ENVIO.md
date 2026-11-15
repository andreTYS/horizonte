# Envío a NASA Space Apps 2026 — lista final

**Fecha límite: domingo 15 de noviembre de 2026, 11:59 p. m. (hora de Moquegua).** Fuente: Judging & Awards Guide (13/11/2026).

## Requisitos para pasar al juicio mundial (verificar antes de enviar)

- [ ] Los 6 integrantes registrados en el evento local **Moquegua** (ninguno en lista de espera) y visibles en la pestaña *Members* del equipo. Máximo 6: estamos en el límite.
- [ ] Reto oficial elegido: **Build a Junior Astronaut Mission Trainer**.
- [ ] Todos los campos obligatorios de la página del proyecto llenos, **en inglés**.
- [ ] Demo: **video de 30 s** (`docs/envio/horizonte-demo-30s.mp4`, con subtítulos en inglés) **o** diapositivas (máximo 7, incluyendo título). Tenemos ambos.
- [ ] Campo **References**: pegar la lista de abajo (todo recurso externo, aunque sea libre).
- [ ] Declarar el uso de IA y **nombrar la herramienta de imágenes** (falta confirmarla: ver `docs/USE-OF-AI.md`).
- [ ] Marcar las dos casillas (reglas/términos y "trabajo original + referencias completas").
- [ ] Pulsar **Submit** en la pestaña *Project* (no basta con guardar).

## Cómo nos califican (1 a 5 en cada criterio, mismo peso)

| Criterio | Qué miran | Nuestra evidencia |
|---|---|---|
| Impacto | Tamaño del problema y a cuántos ayuda | Gratis, sin internet, celulares de gama baja, panel docente; piloto en colegios de Moquegua |
| Creatividad | Idea original o mejora clara | Rebobinar el tiempo, predecir antes de lanzar, fallar con la cadena de causas |
| Validez | Base científica, que funcione y sea fácil de usar | Simulación determinista con 39 pruebas, QA de la campaña completa, accesibilidad WCAG AA |
| Relevancia | Responde al reto y usa datos NASA como núcleo | 20 cifras con fuente, tormenta solar real de mayo 2024, DONKI |
| Presentación | Historia clara en la demo y en el proyecto | Video de 30 s, 7 diapositivas, demo en vivo |

## Premios mundiales a los que apuntamos

Los nominados se anuncian el 3/12/2026, los finalistas el 17/12/2026 y los ganadores el 26/01/2027 (celebración virtual).
De las 10 categorías, las nuestras: **Local Impact**, **Most Inspirational**, **Best Storytelling** y **Best Use of Data**.

---

## References (paste into the submission form)

**NASA data and science sources**
- NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV2: https://ntrs.nasa.gov/search?q=Life%20Support%20Baseline%20Values%20and%20Assumptions%20Document
- NASA BVAD, NASA/TP-2015-218570/REV1, Table 4-20 (planetary base): https://ntrs.nasa.gov/citations/20180001338
- NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV1, Table 3-33: https://ntrs.nasa.gov/citations/20180001338
- NASA – NASA Achieves Water Recovery Milestone on International Space Station (2023): https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/
- Electrolysis stoichiometry; the ISS Oxygen Generation Assembly uses this process: https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/
- NASA Glenn – Fission Surface Power Project: https://www.nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration/
- NASA Science – Moon Facts: https://science.nasa.gov/moon/facts/
- NASA JPL – Data From NASA's Rover's Voyage to Mars Aids Planning (Curiosity RAD, 1.8 mSv/day in deep space): https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/
- Hassler et al. 2014, Science – Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover: https://www.science.org/doi/10.1126/science.1244797
- NASA Human Research Program – Space Radiation (NASA-STD-3001): https://www.nasa.gov/hrp/radiation/
- NASA DONKI – SEP and GST events of May 2024 (downloaded with the api.nasa.gov API): https://kauai.ccmc.gsfc.nasa.gov/DONKI/
- NASA NSSDC – Moon Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- NASA Science – Veggie: https://science.nasa.gov/mission/veggie/
- Colaprete et al. 2010, Science – Detection of Water in the LCROSS Ejecta Plume: https://science.nasa.gov/mission/lcross/
- NASA – NASA's Oxygen-Generating Experiment MOXIE Completes Mars Mission: https://www.nasa.gov/solar-system/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/
- NASA – Opportunity rover mission summary: https://science.nasa.gov/mission/mer-opportunity/
- NASA NSSDC – Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- NASA JPL – NASA Watches Mars Light Up During Epic Solar Storm (2024): https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/
- NASA – Apollo 11 mission overview: https://www.nasa.gov/mission/apollo-11/
- NASA Science – Mars 2020 Perseverance rover: https://science.nasa.gov/mission/mars-2020-perseverance/
- NASA – Space Communications: 7 Things You Need to Know: https://www.nasa.gov/missions/tech-demonstration/space-communications-7-things-you-need-to-know/

**Software and libraries**
- Three.js r170 (MIT): https://threejs.org
- qrcode-generator 2.0.4 by Kazuhiko Arase (MIT): https://github.com/kazuhikoarase/qrcode-generator
- Node.js 22 with built-in SQLite (MIT): https://nodejs.org
- Lucide icons (ISC): https://lucide.dev
- Fonts: Unbounded, Baloo 2, Noto Sans, Space Mono (SIL Open Font License), via Fontsource: https://fontsource.org
- Sound effects: "Oculus Audio Pack 01" by Oculus VR, LLC (CC BY 4.0)

**Voices (text-to-speech, generated offline)**
- Piper TTS (MIT) with the es_MX "claude" high voice (Apache 2.0): https://github.com/rhasspy/piper
- Kokoro-82M, voice af_heart (Apache 2.0): https://huggingface.co/hexgrad/Kokoro-82M
- sherpa-onnx (Apache 2.0) to run the models, and Whisper small (MIT) to check each audio file: https://github.com/k2-fsa/sherpa-onnx

**AI assistance (see docs/USE-OF-AI.md)**
- Claude (Anthropic) as a coding assistant.
- [IMAGE TOOL — the team must name it] for the storyboard frames and character art.

**Brand**
- ASU STELLAR brand manual (2026-01), characters and storyboard by Team Stellar Experience: https://asu-stellar.vercel.app
