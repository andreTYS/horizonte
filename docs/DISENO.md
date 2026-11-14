# HORIZONTE · Documento de diseño del juego (GDD)

Versión 0.3 · 14 nov 2026 · Stellar Experience
Este documento es la **fuente de verdad** del juego: si el código y este documento no coinciden, se corrige uno de los dos.

---

## 1. Visión

**En una frase:** el estudiante dirige una base en la Luna, ve fallar su base, entiende por qué y vuelve atrás en el tiempo para corregirla.

**Reto NASA:** *Build a Junior Astronaut Mission Trainer*: un juego para que estudiantes equilibren energía, comida, blindaje contra radiación y soporte vital en una base lunar o marciana.

**Pilares de diseño** (toda decisión se evalúa contra estos cuatro):

| Pilar | Qué significa en la práctica |
|---|---|
| **1. Todo está conectado** | Ningún sistema funciona solo: la energía produce oxígeno, el oxígeno gasta agua, el invernadero gasta agua y energía. El jugador aprende *pensamiento sistémico*. |
| **2. Fallar enseña** | La falla no es un "Game Over": es el momento de aprendizaje. Siempre se explica la cadena causa → efecto. |
| **3. Rebobinar, no reiniciar** | El jugador vuelve al momento exacto en que se equivocó, no al principio. La simulación es determinista: misma decisión = mismo resultado. |
| **4. Datos reales con fuente** | Cada número real viene de la NASA y se puede ver su fuente dentro del juego. Los valores de equilibrio se declaran como tales. |

## 2. Público objetivo

| Aspecto | Definición | Consecuencia de diseño |
|---|---|---|
| Edad | 11–16 años (1.º a 5.º de secundaria) | Lenguaje simple, sin violencia, estética amable pero no infantil |
| Contexto | Clase de Ciencia y Tecnología, colegios de Moquegua | Sesiones de **10–15 min** por misión; el docente puede proyectar |
| Dispositivo | Celular Android de gama media, también PC del aula | Vertical primero, botones ≥ 48 px, sin 3D pesado, < 2 MB |
| Conexión | Intermitente | PWA que funciona sin internet después de la primera carga |
| Idioma | Español | Todo el texto en español; cifras con coma decimal |
| Experiencia previa | Juegan en el celular; no conocen juegos de estrategia complejos | Tutorial guiado (Nebula) en las primeras misiones |

## 3. Bucle de juego

```
 ┌────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
 │ 1. DISEÑAR │──▶│ 2. SIMULAR  │──▶│ 3. ENTENDER  │──▶│ 4. REBOBINAR │
 │ la base    │   │ día a día y │   │ por qué falló│   │ y corregir   │
 │ (masa)     │   │ decidir     │   │ (dato NASA)  │   │              │
 └────────────┘   └─────────────┘   └──────────────┘   └──────┬───────┘
       ▲                                                       │
       └──────────────── o rediseñar la base ◀─────────────────┘
```

- **Bucle corto (segundos):** avanzar un día → mirar barras → decidir (refugio, ración, invernadero).
- **Bucle medio (minutos):** completar una misión, con 0–3 rebobinados.
- **Bucle largo (sesión):** desbloquear misiones más difíciles y conseguir 3 estrellas.

## 4. Mecánicas (reglas exactas)

Implementadas en `js/sim.js`. Valores reales en `data/nasa.json`; valores de equilibrio en `data/juego.json`.

### 4.1 Fase de diseño

El jugador elige, sin superar el **presupuesto de masa** de la misión (t):

| Elemento | Masa | Efecto |
|---|---|---|
| Hábitat (fijo) | 2 t | Soporte vital: 100 kWh/día + 15 kWh/día por persona |
| Panel solar (0–20) | 0,4 t c/u | +120 kWh/día **solo con luz** |
| Batería (0–20) | 0,5 t c/u | Guarda 400 kWh |
| Reactor de fisión (0–1) | **6 t** (NASA) | **+40 kW × 24 h = 960 kWh/día**, de día y de noche (NASA FSP) |
| Reciclador de agua (sí/no) | 1 t | Recupera **98 %** del agua usada (NASA ISS). Gasta 40 kWh/día |
| Invernadero (sí/no) | 2 t | Produce 40 % de la comida del equipo, +1 ciencia/día. Gasta 150 kWh/día y 4 kg de agua/día |
| Blindaje (nivel 0/1/2) | 0 / 1,5 / 3 t | Reduce la radiación 0 / 35 / 60 % |
| Suministros O₂, agua, comida | kg ÷ 1000 | Reservas iniciales |

No se puede lanzar si la masa total supera el presupuesto.

### 4.2 Simulación de un día (en este orden)

1. **Eventos** del día (micrometeorito, avería, alerta o tormenta solar).
2. **Energía:** `producción = paneles_activos × 120 × (¿hay luz?) + reactor × 960`.
   `disponible = producción + batería`. Se reparte **por prioridad**:
   1. Soporte vital → si no alcanza: **FALLA (energía)**
   2. Electrolizador: `kg O₂ necesarios × 10 kWh`
   3. Reciclador (si existe y no está averiado)
   4. Invernadero (si existe y está encendido)

   Lo que sobra se guarda en baterías hasta su capacidad. Lo que no alcanza **se apaga** ese día.
3. **Oxígeno:** consumo = `tripulación × 0,82 kg` (NASA BVAD). Si el electrolizador funciona y hay agua, fabrica ese O₂ gastando `1,125 kg de agua por kg de O₂` (electrólisis).
4. **Agua:** uso = `tripulación × 3,5 kg`. Con reciclador se pierde solo el 2 %; sin él, el 100 %. El invernadero gasta 4 kg más.
5. **Comida:** consumo = `tripulación × 1,5 kg × ración` (ración reducida = 0,8). El invernadero aporta el 40 % del consumo normal.
6. **Salud:** −8/día con ración reducida, +4/día con ración normal (máx. 100).
7. **Radiación:** `1,37 mSv × (1 − blindaje)` por día (dato lunar), más la dosis de tormenta `× (1 − blindaje) × (refugio ? 0,1 : 1)`.
8. **Ciencia:** +1 por día fuera del refugio (+1 extra si el invernadero funcionó).
9. **Comprobación de falla**, en este orden: energía → O₂ < 0 → agua < 0 → comida < 0 → dosis > límite → salud ≤ 0.

### 4.3 Decisiones diarias

| Decisión | Beneficio | Costo |
|---|---|---|
| **Refugio** | −90 % de la dosis de tormenta | Ese día no suma ciencia |
| **Ración reducida** | −20 % de comida | −8 de salud por día |
| **Invernadero on/off** | Apagado ahorra 150 kWh y 4 kg de agua | Apagado no produce comida ni ciencia extra |

### 4.4 Condiciones de victoria y derrota

- **Victoria:** llegar al último día sin falla **y** con `ciencia ≥ objetivo`.
- **Derrota:** cualquier falla del paso 9, o terminar con ciencia insuficiente.

### 4.5 Rebobinado

- La simulación guarda el estado al inicio de cada día. Tocar un día pasado en la línea de tiempo restaura ese estado y conserva las decisiones de ese día para que el jugador las cambie.
- **Rediseñar** vuelve a la fase de diseño con la configuración anterior.
- Ambos cuentan como rebobinado.
- **Estrellas:** 0 rebobinados = ★★★, 1–2 = ★★, 3 o más = ★.

### 4.6 Análisis de falla (el corazón pedagógico)

Al fallar, `analizarFalla()` recorre el historial y construye una **cadena causa → efecto** de 2–3 pasos, elige las **cifras NASA** que la explican y da un **consejo**. También indica si conviene **rebobinar** (error de decisión, como no ir al refugio) o **rediseñar** (error de diseño, como no tener energía para la noche).

## 5. Misiones y progresión

| # | Misión | Lugar | Tripulación · días | Masa | Concepto que enseña | Cómo se gana |
|---|---|---|---|---|---|---|
| 1 | Primer amanecer | Polo sur (luz permanente) | 2 · 7 | 8 t | Energía → O₂ → agua | El diseño sugerido gana (tutorial) |
| 2 | La larga noche | Mar de la Tranquilidad | 4 · 30 | 13 t | Noche lunar de ~15 días | Reactor **o** muchas baterías, más agua para el electrolizador |
| 3 | Tormenta solar | Cráter Shackleton | 4 · 20 | 11 t | Radiación: blindaje vs. refugio | Refugio en los días de tormenta **o** blindaje 2. Eventos con fechas reales de DONKI, mayo 2024 |
| 4* | Marte: el polvo | Jezero | 4 · 30 | — | Tormentas de polvo, MOXIE, RAD | Por diseñar |

\* Después de la hackatón.

**Nebula** da pistas en las misiones 1–2. En la misión final no da pistas: el estudiante decide solo, y eso sirve como evaluación.

## 6. Medición del aprendizaje

- **Prueba inicial y final** (5 preguntas, 2 min) sobre relaciones entre sistemas, por ejemplo: "¿qué pasa con el oxígeno si se acaba la energía?".
- **Escenario nuevo:** la misión final sin pistas.
- **Rúbrica individual 0–8:** identifica la causa (0–2), propone una corrección (0–2), justifica con un dato (0–2) y anticipa efectos secundarios (0–2).

## 7. Dirección de arte

### 7.1 Decisión

**Estilo:** *ilustración vectorial plana en vista isométrica 2D*, con paleta luminosa sobre un fondo espacial oscuro.

| Opción considerada | Veredicto |
|---|---|
| RTS en tiempo real tipo StarCraft o Warcraft (oscuro, detallado, combate) | ❌ Requiere reflejos y combate, no es determinista (rompe el rebobinado), es pesado en celulares y no encaja con el público |
| Pixel art retro | ⚠️ Bonito, pero lento de producir bien en 48 h y lee mal los datos pequeños |
| 3D low-poly | ❌ Pesado para celulares de gama media, requiere motor 3D |
| **Isométrico vectorial plano** | ✅ Legible en pantallas pequeñas, liviano (SVG), rápido de producir, estética "ciencia amable" como las infografías de divulgación |

**Qué tomamos de los juegos de estrategia** (solo la *gramática de interfaz*, no su estética ni su contenido):
- **Barra de recursos arriba**, siempre visible.
- **Vista de la base al centro**, donde se ven los módulos construidos.
- **Panel de construcción y acción abajo**, al alcance del pulgar.
- **Línea de tiempo** en lugar de minimapa: es nuestro diferencial, el rebobinado.

El arte es **100 % original**; no se copian personajes, unidades ni assets de ningún juego existente.

### 7.2 Paleta

| Uso | Color |
|---|---|
| Fondo espacio | `#0b1026` |
| Superficie / tarjetas | `#1a2350` |
| Acento principal (acción, Sol) | `#ffb547` |
| Acento secundario (datos, info) | `#6fd3ff` |
| Bien / Alerta / Peligro | `#4ade80` / `#fbbf24` / `#f87171` |
| Regolito lunar | `#9aa0b4` → `#5b6178` |

### 7.3 Elementos visuales a producir

1. **Escena isométrica de la base:** suelo lunar, hábitat, paneles, baterías, reactor, reciclador, invernadero y blindaje. Cada módulo aparece al construirlo.
2. **Ciclo día/noche:** el cielo y la iluminación cambian; los paneles se apagan visualmente de noche.
3. **Estados de alarma:** módulo apagado con parpadeo rojo; tormenta solar con partículas cayendo; refugio activo con un escudo sobre el hábitat.
4. **Nebula:** gata robot con 4 expresiones (normal, alerta, feliz, pensando).
5. **Íconos de recursos:** energía, O₂, agua, comida, radiación, salud, ciencia, todos con el mismo trazo.

### 7.4 Interfaz (celular vertical)

```
┌─────────────────────────────┐
│ ⚡400 🫁12 💧52 🥫83 ☢️6/60  │ ← barra de recursos
│ Día 8/20 ☀️        ⏪ 1       │
├─────────────────────────────┤
│                             │
│     ESCENA ISOMÉTRICA       │ ← la base y el cielo
│      DE LA BASE             │
│                             │
├─────────────────────────────┤
│ 1 2 3 4 5 6 7 [8] 9 10 …    │ ← línea de tiempo (rebobinar)
├─────────────────────────────┤
│ 🐱 Nebula: ¡Llamarada!...   │ ← aviso o pista
├─────────────────────────────┤
│ [Refugio] [Ración] [Inver.] │ ← decisiones
│ [   Avanzar 1 día ▶   ] [⏩]│ ← acción principal
└─────────────────────────────┘
```

## 8. Arquitectura técnica

| Capa | Tecnología | Por qué |
|---|---|---|
| Simulación | `js/sim.js`, JavaScript puro, sin DOM | Determinista y probado con `node --test`; no se toca al cambiar el arte |
| Datos | `data/*.json` | Editables sin programar; separan dato NASA y equilibrio |
| Escena | **SVG isométrico** generado por código | Liviano, nítido en cualquier pantalla, sin motor externo |
| Interfaz | HTML + CSS | Accesible (lector de pantalla, teclado) y fácil de mantener |
| Offline | Service worker (PWA) | Funciona en el aula sin internet |
| Datos NASA en vivo | `tools/actualizar-donki.mjs` (API key de api.nasa.gov) | Se ejecuta al preparar datos, no en el navegador del alumno: así la key no queda expuesta |
| Hosting | GitHub Pages (demo) → **VPS** (producción) | Ver §9 |

## 9. Despliegue en VPS (producción)

- **Fase 1 (hackatón):** sitio estático en GitHub Pages, ya publicado.
- **Fase 2 (piloto en colegios):** VPS Hostinger con **Docker detrás de Traefik** (HTTPS con Let's Encrypt) sirviendo los archivos estáticos, más una API pequeña (Node) para:
  - guardar partidas y bitácoras por estudiante (SQLite al inicio; MySQL si crece);
  - el panel docente: resultados de la prueba inicial y final y de la rúbrica;
  - un proxy de la API de la NASA, con la key solo en el servidor.

Requisitos mínimos del VPS: 1 vCPU, 1 GB RAM, Ubuntu 24.04, dominio apuntando a la IP.

## 10. Hoja de ruta

| Prioridad | Tarea | Estado |
|---|---|---|
| P0 | Motor, 3 misiones, rebobinado, análisis de falla | ✅ |
| P0 | Publicación (GitHub Pages) | ✅ |
| P0 | Datos DONKI reales en la misión 3 | ✅ |
| P1 | Escena isométrica de la base (§7.3) | ✅ |
| P1 | Nueva interfaz de la misión (§7.4) | ✅ |
| P1 | Prueba inicial y final y rúbrica (§6) | ⏳ |
| P2 | Arte de Nebula (4 expresiones) | ⏳ |
| P2 | Servidor VPS: Docker + Traefik, partidas, panel docente, proxy NASA | ✅ (falta el VPS real) |
| P3 | Misión 4: Marte | ⏳ |
