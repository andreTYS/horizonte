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
| 3 · Tormenta solar | Basada en la tormenta real de mayo de 2024: blindaje vs. refugio (sin pistas de Nebula) |

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
node tools/actualizar-donki.mjs 2024-05-01 2024-05-31
```

## Desarrollo

Sin frameworks ni compilación: HTML, CSS y JavaScript (módulos ES). Es una PWA instalable que funciona sin conexión.

```bash
npm start      # servidor local en http://localhost:5173
npm test       # pruebas del motor de simulación (node --test)
```

| Archivo | Qué hace |
|---|---|
| `js/sim.js` | Motor de simulación puro (sin DOM): recursos, energía, radiación, eventos y análisis de fallas |
| `js/main.js` | Pantallas, decisiones, línea de tiempo y rebobinado |
| `data/misiones.json` | Misiones, eventos, diseño sugerido y textos de Nebula |
| `tests/sim.test.js` | Comprueba que cada misión se puede ganar y que la falla se explica bien |

## Próximos pasos

- Prueba inicial / final y rúbrica 0–8 para medir aprendizaje.
- Misión en Marte (MOXIE, RAD de Curiosity).
- Arte original de Nebula y de la base.

## Equipo

Abel Fernando Sangama Oñate (Product Manager) · Juan Pablo Vivanco Vivanco (UX/UI) · Rosa Karen Fuertes Velasquez (UX Research) ·
André Tomás Yucra Silvestre (Líder de desarrollo) · Luis Angel Choquepura Puma (Programador) · Liliana Gabriela Fernandez Carrizales (Desarrolladora)
