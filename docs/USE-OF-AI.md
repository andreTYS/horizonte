# Use of AI — ASU STELLAR · Horizonte

Team **Stellar Experience** (Moquegua, Peru) · NASA Space Apps Challenge 2026 · *Build a Junior Astronaut Mission Trainer*.

We used AI tools and we declare them here, as the Space Apps rules ask. People on the team chose the idea, the learning design,
the missions and the data, and reviewed everything that the tools produced.

| Where | Tool | What it did | Human review |
|---|---|---|---|
| Code | **Claude** (Anthropic), as a coding assistant | Helped write and refactor the JavaScript game, the 3D scene (Three.js), the Node server, tests and these documents | Gameplay, numbers and texts reviewed by the team; 33 automated tests (`npm test`) and browser checks |
| Voice of Nebula | **Piper TTS** (`es_MX-claude-high`, Apache 2.0) and **Kokoro-82M** (`af_heart`, Apache 2.0) | Text-to-speech for Nebula's lines in Spanish and English | Each audio file is transcribed back with Whisper (`tools/voz/verificar.py`) and compared with the text |
| Storyboard illustrations and character art | AI image generator *(tool to be confirmed by the team)* | The 16 storyboard frames ("Watch the story", landing page) and the four character images | Each image carries a visible watermark «Imagen generada con IA · AI-generated» (`tools/marca-agua.py`, originals kept in `tools/ia-originales/`) |
| Data | — | **No AI-generated data.** Every NASA figure comes from a cited NASA source (see [NASA-DATA.md](NASA-DATA.md)) | Figures marked "to be verified" until checked against the source |

What is **not** AI-generated: the game rules (`js/sim.js`), the NASA figures, the mission design and the learning assessment
(pre-test, post-test and the Artemis-7 rubric aligned with Peru's MINEDU scale), the brand manual and the characters' design brief.
