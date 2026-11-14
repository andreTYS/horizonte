# Modelos de Blender para HORIZONTE

**Activos ahora** (los 8, hechos en Blender con `tools/blender/modelos.py`): `habitat`, `reactor`, `panel`, `bateria`, `reciclador`, `invernadero`, `lander`, `astronauta` (`.glb`).
Para regenerarlos o cambiarlos desde el código (también funciona dentro del contenedor de Blender del VPS):

```bash
blender -b --python tools/blender/modelos.py -- --glb assets/modelos --previas /tmp/previas
```

Opciones: `--solo habitat,reactor` para hacer solo algunos; `--previas` renderiza imágenes PNG con Cycles para revisarlos.

El juego dibuja cada módulo con modelos hechos por código (`js/modelos3d.js`).
Para reemplazar uno por un modelo hecho en Blender:

1. Parte de los modelos actuales que ya están exportados en `fuente/` (`habitat.glb`, `reactor.glb`, …): ábrelos en Blender con **File → Import → glTF 2.0**. También puedes exportarlos de nuevo con `tools/visor.html` (`npm run estatico` y abre `/tools/visor.html`).
2. En Blender: escala real en metros, el modelo apoyado en el suelo (Z = 0) y centrado en el origen.
3. Exporta con **File → Export → glTF 2.0 (.glb)**: formato *glTF Binary*, incluir materiales, aplicar modificadores.
4. Copia el archivo a esta carpeta y regístralo en `manifest.json`:

```json
{ "habitat": "habitat.glb", "reactor": "reactor.glb" }
```

Tipos disponibles: `habitat`, `panel`, `bateria`, `reactor`, `reciclador`, `invernadero`, `lander`, `astronauta`.

Para que el juego pueda animar partes, ponles estos nombres a los objetos en Blender:
`carga` (barra de la batería), `luz` (luces del invernadero), `baliza` (luz roja de la antena), y el material `ventana` (ventanas que brillan de noche).

Mantén cada modelo por debajo de ~1 MB para que cargue rápido en celulares.
