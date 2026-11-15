# ASU STELLAR · Horizonte

> Train to run a base on the Moon and Mars.

An educational 3D game by team **Stellar Experience** (Moquegua, Peru) for the NASA Space Apps Challenge 2026 challenge
**Build a Junior Astronaut Mission Trainer**. For students aged 7–12. *Project for the NASA Space Apps Challenge — not affiliated with or endorsed by NASA.*

**▶ Play:** https://horizonte.moqueguasoft.com · mirror: https://andretys.github.io/horizonte/ · works on phones and offline (PWA), no sign-up, no ads.
**Teacher panel:** `/docente.html` (on the server version). **Language:** Spanish and English (ES/EN button).

## The idea

You are the Peruvian astronaut in command of an expedition. You design a base, **predict** what will fail, move time forward with the
**Chronoscope**, see the **cause → effect chain** of every failure with the **NASA fact** that explains it, and **rewind** to fix one
decision. There is never a game over: *mistakes are the lesson*.

## How it covers the challenge

| Challenge topic | Where it is played | Real case behind it |
|---|---|---|
| Power | Mission 1 · The long night (Moon): ~15 days without sunlight; batteries vs. a fission reactor | Lunar cycle, NASA Fission Surface Power (40 kW) |
| Life support | Mission 2 · Air and water (Moon): oxygen is made from water and energy; recycling water costs energy | The ISS recovers ~98 % of its water |
| Food | Mission 3 · First harvest (Mars): less sunlight, a greenhouse and a dust storm; MOXIE makes oxygen from CO₂ | The 2018 dust storm that ended Opportunity; MOXIE |
| Radiation shielding | Mission 4 · Solar storm (Mars): shielding vs. shelter | The May 2024 storm measured by Curiosity's RAD |
| Communication delay | Mission 4: the alert from Earth arrives late; there is no time to wait for an answer | Earth–Mars radio delay, ~4 to ~24 minutes |

What carries over: whatever you save in one mission arrives as a **reserve** in the next one. Three extra missions (no hints) add the
May 2024 lunar solar storm (NASA DONKI), lunar ice (LCROSS) and a chain of failures.

## Each mission loop

Design → **Predict** (what fails first?) → Fast-forward with the Chronoscope → See the cause → **Rewind** → **Tell it** (one sentence in your journal).

## Learning is measured

- Pre-test and post-test (5 questions each) → **normalized learning gain**.
- **Artemis-7 case**: a new scenario scored with a 0–8 rubric on Peru's MINEDU scale (AD, A, B, C). Winning a mission does not prove learning; explaining a new case does.
- Predictions (hit rate) and journal sentences go to the **teacher panel**, exportable to CSV.

## For the classroom

- **Classroom mode**: the teacher shares a link or QR; the game opens with the class code, silent at start, and the teacher can **pause the whole class** from the panel.
- **Accessibility**: screen-reader announcements, "Listen" button (Nebula reads the base status), full keyboard play (A, R, C, I, B, Z, E, ?), larger text, high contrast, less motion, vibration on alarms. **0 WCAG 2 A/AA violations** in axe-core audits.
- Voices for Nebula in Latin-American Spanish and US English; every alarm and voice line also appears as text.

## NASA data

Every real number has a source, a link and a badge in the game (*NASA figure*, *historical case with date*, *to be verified*, *game value*).
See [docs/NASA-DATA.md](docs/NASA-DATA.md). Game balance numbers are kept apart in `data/juego.json` and never presented as NASA data.

## Use of AI

Declared in [docs/USE-OF-AI.md](docs/USE-OF-AI.md).

## Technology

HTML, CSS and JavaScript modules (no framework, no build step) · Three.js 3D map with a 920 × 920 m terrain · Node 22 server with SQLite
(results, teacher panel, NASA DONKI proxy) · Docker + Traefik · deterministic simulation in `js/sim.js` with automated tests (`npm test`).

```bash
npm start   # game + API at http://localhost:8080 (Node ≥ 22.5)
npm test
```

## Credits

Sound effects: "Oculus Audio Pack 01" by Oculus VR, LLC (CC BY 4.0) · Voices: Piper TTS (MIT) with es_MX claude (Apache 2.0), Kokoro-82M af_heart (Apache 2.0)
· Icons: Lucide (ISC) · Fonts: Unbounded, Baloo 2, Noto Sans, Space Mono (SIL OFL) · Brand, characters and storyboard: ASU STELLAR brand manual 2026-01.

## Team Stellar Experience

Abel Fernando Sangama Oñate (Product Manager) · Juan Pablo Vivanco Vivanco (UX/UI) · Rosa Karen Fuertes Velasquez (UX Research) ·
André Tomás Yucra Silvestre (Development lead) · Luis Angel Choquepura Puma (Programmer) · Liliana Gabriela Fernandez Carrizales (Developer)
