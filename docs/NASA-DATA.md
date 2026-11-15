# NASA data used in ASU STELLAR · Horizonte

Every real number in the game lives in [`data/nasa.json`](../data/nasa.json) with its source and link, and is shown inside the game
(*NASA data* screen, the science cards that explain each failure, and badges on every figure).

Each number is labelled with where it comes from:

- **NASA figure** – a value taken from a NASA source.
- **Historical case** – a real event with its date (for example the May 2024 solar storm). It is archive data, never presented as "live".
- **To be verified** – figures we still need to double-check against the source before the final presentation.
- **Game value** – numbers made up to keep the game playable in a few minutes (panel mass, greenhouse energy…). They live separately in
  [`data/juego.json`](../data/juego.json) and are never presented as NASA data.

## Figures

| Key | What it says | How the game uses it | Type | Verified | Source |
|---|---|---|---|---|---|
| `o2_persona_dia` | An astronaut breathes about 0.82 kg of oxygen per day. | Oxygen consumed per astronaut per day | NASA figure | Yes | [NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV2](https://ntrs.nasa.gov/search?q=Life%20Support%20Baseline%20Values%20and%20Assumptions%20Document) |
| `agua_persona_dia` | At a planetary base, NASA estimates about 3.4 kg of water per astronaut per day: 2 for drinking, 0.5 to prepare food, 0.4 for hygiene and 0.5 for the toilet. | Water used per astronaut per day | NASA figure | Yes | [NASA BVAD, NASA/TP-2015-218570/REV1, tabla 4-20 (base planetaria)](https://ntrs.nasa.gov/citations/20180001338) |
| `comida_persona_dia` | Each astronaut eats about 1.5 kg of food per day (1.51 kg without packaging, according to NASA). | Food per astronaut per day | NASA figure | Yes | [NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570/REV1, tabla 3-33](https://ntrs.nasa.gov/citations/20180001338) |
| `recuperacion_agua` | The International Space Station recovers 98 % of the water the crew uses. | Water recycler efficiency | NASA figure | Yes | [NASA – NASA Achieves Water Recovery Milestone on International Space Station (2023)](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/) |
| `agua_por_kg_o2` | To make 1 kg of oxygen by splitting water (2H₂O → 2H₂ + O₂), 1.125 kg of water is used. | Water split to make oxygen (electrolysis) | NASA figure | Yes | [Estequiometría de la electrólisis; el Oxygen Generation Assembly de la ISS usa este proceso](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/) |
| `fsp_kw` | NASA's Fission Surface Power reactor is designed to deliver 40 kW continuously, day and night. | Reactor power (day and night) | NASA figure | Yes | [NASA Glenn – Fission Surface Power Project](https://www.nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration/) |
| `fsp_masa_t` | NASA asked for the surface reactor to weigh less than 6 tonnes. | Reactor mass on the rocket | NASA figure | Yes | [NASA Glenn – Fission Surface Power Project](https://www.nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration/) |
| `ciclo_lunar_dias` | A full day on the Moon (sunrise to sunrise) lasts about 29.5 Earth days: almost 15 days of light and almost 15 of night. | Lunar day/night cycle (when panels stop) | NASA figure | Yes | [NASA Science – Moon Facts](https://science.nasa.gov/moon/facts/) |
| `dosis_luna_msv_dia` | In deep space, the RAD instrument on NASA's Curiosity rover measured about 1.8 mSv of cosmic radiation per day. On the Moon's surface the Moon blocks half of the sky, so you get about half: roughly 0.9 mSv per day without protection. | Daily radiation dose on the Moon | NASA figure (halved: game estimate) | Yes | [NASA JPL – Data From NASA's Rover's Voyage to Mars Aids Planning](https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/) |
| `dosis_marte_msv_dia` | Curiosity's RAD instrument measured about 0.64 mSv per day on the surface of Mars. | Daily radiation dose on Mars | NASA figure | Yes | [Hassler et al. 2014, Science – Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover](https://www.science.org/doi/10.1126/science.1244797) |
| `limite_carrera_msv` | NASA limits the radiation an astronaut can receive over their whole career to 600 mSv. | Radiation limit used to explain failures | NASA figure | Yes | [NASA Human Research Program – Space Radiation (NASA-STD-3001)](https://www.nasa.gov/hrp/radiation/) |
| `tormenta_mayo_2024` | Between May 9 and 13, 2024, NASA recorded 14 solar particle events and a Kp 9 geomagnetic storm, the strongest in 20 years. On the Moon there is no atmosphere or magnetic field for protection: the crew must go to the shelter. | Solar storm events (extra mission, Moon) | Historical case (2024-05-10) | Yes | [NASA DONKI – eventos SEP y GST de mayo 2024 (descargados con la API de api.nasa.gov)](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) |
| `gravedad_luna` | The Moon's gravity is 1.62 m/s², one sixth of Earth's. | Fact card | NASA figure | Yes | [NASA NSSDC – Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| `veggie` | On the ISS, the Veggie system has already grown lettuce, radishes and peppers that astronauts ate. | Greenhouse fact card | NASA figure | Yes | [NASA Science – Veggie](https://science.nasa.gov/mission/veggie/) |
| `lcross_hielo` | In 2009 NASA's LCROSS mission impacted Cabeus crater, at the lunar south pole, and measured that its soil contains about 5.6 % water ice. | Ice extractor mission | Historical case (2009-10-09) | Yes | [Colaprete et al. 2010, Science – Detection of Water in the LCROSS Ejecta Plume](https://science.nasa.gov/mission/lcross/) |
| `moxie_o2` | MOXIE, aboard the Perseverance rover, made oxygen from Martian CO₂: up to 12 g per hour and 122 g in total. A plant for astronauts would need to be hundreds of times larger. | MOXIE module (Mars) | Historical case (2021–2023) | Yes | [NASA – NASA's Oxygen-Generating Experiment MOXIE Completes Mars Mission](https://www.nasa.gov/solar-system/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/) |
| `polvo_marte_2018` | In 2018 a dust storm covered all of Mars for weeks and blocked the Sun so much that the Opportunity rover, which ran on solar panels, lost power forever. | Dust storm event (Mission 3) | Historical case (2018-06) | Yes | [NASA – Opportunity rover mission summary](https://science.nasa.gov/mission/mer-opportunity/) |
| `luz_marte` | Mars is 1.5 times farther from the Sun than Earth, so it gets less than half the sunlight: panels produce much less. | Solar panel output on Mars | NASA figure | Yes | [NASA NSSDC – Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| `tormenta_marte_mayo_2024` | In May 2024 a solar storm reached Mars. The Curiosity rover's RAD instrument measured the biggest radiation surge since it landed in 2012: for an astronaut standing next to it, it would have been like about 30 chest X-rays. | Solar storm event (Mission 4, Mars) | Historical case (2024-05-20) | Yes | [NASA JPL – NASA Watches Mars Light Up During Epic Solar Storm (2024)](https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/) |
| `viaje_apolo11` | Apollo 11 launched from Earth on July 16, 1969 and landed on the Moon on July 20: about 4 days of travel. | Journey from Earth to the Moon (launch sequence) | Historical case | Yes | [NASA – Apollo 11 mission overview](https://www.nasa.gov/mission/apollo-11/) |
| `viaje_perseverance` | The Perseverance rover launched on July 30, 2020 and landed in Mars' Jezero crater on February 18, 2021: almost 7 months of travel. | Journey from Earth to Mars (launch sequence) | Historical case | Yes | [NASA Science – Mars 2020 Perseverance rover](https://science.nasa.gov/mission/mars-2020-perseverance/) |
| `retraso_tierra_marte` | A radio signal takes about 4 minutes between Earth and Mars when they are closest, and about 24 minutes when they are farthest apart. | Radio delay in Mission 4 | NASA figure | Yes | [NASA – Space Communications: 7 Things You Need to Know](https://www.nasa.gov/missions/tech-demonstration/space-communications-7-things-you-need-to-know/) |

## Live NASA API

The VPS server can download solar events from **NASA DONKI** through `api.nasa.gov` (`/api/donki`, cached 24 h). The missions themselves use
saved DONKI events from May 2024 so that every class plays the same, reproducible story.

## Not NASA

- Mission names, characters (ASU STELLAR brand manual) and the Artemis-7 assessment case are fictional teaching material.
- The project is **not affiliated with or endorsed by NASA**. It is a *project for the NASA Space Apps Challenge 2026*.
