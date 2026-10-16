# 10 — Assumptions and confidence

## Verified (from data I fetched or code I ran)

- Loop alignment, junction positions and connectivity: OSM node-by-node walk; build fails on any gap or wrong-way one-way.
- One-way direction of Walpole Street, the westbound Wallace Johnson section and the roundabout: OSM tags.
- Footprint shapes and positions of 766 buildings and the 9 landmarks: OSM (base 2026-10-15).
- Positions of 303 trees: OSM.
- Drivable path deviation from OSM: median 0.11 m, worst 5.39 m (measured).
- Gameplay: full laps, stops, scoring, pause/restart, keyboard and touch input in headless Chromium; unit tests 54/54; smoke 30/30.
- City Hall is 15 storeys and a twin building on Wallace Johnson Street (Freetown City Council).
- The original Cotton Tree fell in May 2023; no replacement monument was found in sources up to 2025.

## Estimated (labelled in code and docs)

| Item | Estimate | Basis |
|---|---|---|
| Storeys of every ordinary building | 1–8, mostly 2–4 | No OSM levels tagged; judgement from street photography |
| Law Courts height, column count | 2 storeys, ~3.2 m column spacing | Photos (research notes), not measured |
| NASSIT House, Rokel bank storeys | 9, 6 | Photos, not counted |
| SLCB storeys | 12 | "About 12" in research notes |
| Cotton Tree spire heights | 7–12 m | Photo proportions |
| Side-street widths | 7–8.4 m | No width tags |
| Hills on the horizon | Silhouette only | Not elevation data |
| Corner radius | 13 m | Gameplay minimum, not kerb survey |

## Inferred (reasoned, not stated by a source)

- City Hall footprints = two unnamed ≈1,050 m² OSM buildings at the townhall node.
- National Museum footprint = unnamed OSM building containing the museum node.
- NASSIT House = the building containing the NASSIT node at the roundabout (OSM has a second "Nassit House" on Wallace Johnson Street).
- Market activity concentrated near Big Market on Wallace Johnson Street.

## Deliberate deviations from reality

- **Three 3.4 m lanes everywhere**, so handling and collisions match every other route. Real loop streets have no width tags; building-to-building corridors measure 12.6–45 m.
- **76 footprints moved back** a median 2.8 m (max 5.5 m) so they do not stand in that corridor.
- **Corners rounded to 13 m radius** (≤5.4 m from the junction node).
- **Flat ground** (no elevation source good enough).
- **Invented shop names**, no real brands.

## Unresolved questions needing local confirmation

1. Does Big Market have the two-storey arcaded form modelled, and what colour is it now?
2. What does City Hall's façade look like (colour, glazing)?
3. St George's Cathedral: tower position and form.
4. Which building do people call NASSIT House?
5. Is "PZ" understood to be at Siaka Stevens / Rawdon Street? (Not used as a stop name because this is unconfirmed.)
6. Are the stop names chosen (Rokel Commercial Bank, Wilberforce Street, City Hall, Big Market, Lightfoot Boston Street, Law Courts) what drivers and passengers would actually call those places?
7. Real traffic direction and lane use on Siaka Stevens and Wilberforce streets (OSM tags them two-way).
8. Is there a monument or new planting at the Cotton Tree site in 2026?

## Process notes

- During research, one Overpass request was sent with a User-Agent string that included the user's e-mail address. That was a mistake on my part; every later request, and the committed `fetch-osm.mjs`, uses a neutral User-Agent.
- No proprietary imagery, tiles or models were copied into the repository.
