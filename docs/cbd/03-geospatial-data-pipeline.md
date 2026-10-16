# 03 — Geospatial data pipeline

```
Overpass API ──fetch-osm.mjs──▶ .cache/cbd-osm/*.json (raw, gitignored)
                                   │
                         build-cbd.mjs (no smoothing, no gameplay edits)
                                   ▼
                     src/cbd/data/cbd-data.json  (projected metres, ~100 kB)
                                   │
          RoadPath.js ── CbdRoute.js ── CbdWorld.js / landmarks.js ── CbdMode.js
          (geometry)    (rules)          (meshes)                      (integration)
```

Commands: `npm run cbd:fetch` then `npm run cbd:build`. The committed JSON is what the game ships; the raw cache is reproducible from the queries in `fetch-osm.mjs`.

## Sources actually used

| Data | Source | Date | Notes |
|---|---|---|---|
| Roads (`highway=*`, with node ids) | OSM via overpass-api.de | base 2026-10-15T14:33Z | bbox 8.4805,−13.2440 – 8.4935,−13.2240 |
| Building footprints | OSM | same | 15,570 in bbox; 766 kept (≤70 m from loop); 3 multipolygon relations skipped (more than one outer ring) |
| Trees, parks | OSM `natural=tree` etc. | base 2026-10-15T14:59Z | 3,159 tree nodes in bbox; 303 kept |
| Coastline | OSM `natural=coastline` | 2026-10-15 | 4 ways, chained |
| Landmark identities and positions | OSM names/tags (Supreme Court Building, St George's Cathedral, Big Market, NASSIT, City Hall `amenity=townhall`, …) | same | ids in doc 05 |

Not used, and why: Google Maps/Earth and Street View imagery (licence forbids extraction; I did not view them in this session), Mapillary (not accessed in this session), satellite footprints (OSM coverage was already dense here).

**Licence.** OSM data is ODbL 1.0. `cbd-data.json` is a derived database and must stay under ODbL with attribution; the CBD title's **How to play** dialog and the in-game pause menu's **More options** include linked OpenStreetMap credit. It is kept off the game view so it does not cover the road or HUD. `meta.licence` records the licence in the file.

## Coordinate transformation

1. Source CRS: WGS84 geographic (EPSG:4326), as OSM stores it.
2. Target: a local tangent plane in metres, origin at the OSM Cotton Tree node (8.487148 N, 13.235624 W). Scale factors are the WGS84 meridional and prime-vertical radii at that latitude: **110,598.5 m per degree of latitude, 110,108.5 m per degree of longitude** (`src/cbd/geo.js`).
3. Axes: x = east, z = **south** (Three.js is y-up and right-handed, so north is −z). Rotation of a road-space object onto the street uses yaw `atan2(−dx, −dz)` of the path tangent.
4. Precision: the whole CBD lies within ±600 m of the origin, so float32 vertex positions keep millimetre precision; no rebasing is needed.
5. Distortion: against UTM 28N the local plane's scale error over ±1 km is far below 0.1 % (<1 m), well inside OSM's own positional error (crowd-mapped, typically a few metres).

**A defect caught by the tests:** the first version used a spherical radius (6,378,137 m) for both axes, which overstates north–south distances by **0.65 %** at this latitude (≈4 m across the CBD). `tests/cbd-route.test.cjs` checks the per-degree scales against the ellipsoidal values and now fails if that regresses.

## Data structure (`cbd-data.json`)

| Key | Content |
|---|---|
| `meta` | source, licence, OSM base time, origin, projection, loop way ids |
| `route.points` / `route.nodes` | the loop's surveyed centreline in driving order, with the OSM node id of every point |
| `route.streets` | street name and the index of its first (junction) node |
| `junctions` | loop nodes shared with other named streets, with those names |
| `sideStreets` | 70 m of each side street's real alignment from the junction |
| `roundabout` | full ring nodes, centre and mean radius |
| `buildings` | footprint rings (Douglas–Peucker, 0.35 m tolerance), OSM id, levels/height/name/kind where tagged |
| `trees`, `parks` | mapped tree points; green polygons (none within reach here) |
| `coast` | coastline polylines for the backdrop |

Geographic data (this JSON) is kept separate from gameplay decisions (smoothing, corridor, speed limits — `RoadPath.js`, `CbdRoute.js`) and from rendering (`CbdWorld.js`, `landmarks.js`).

## Connectivity validation

`build-cbd.mjs` builds the loop as an explicit walk over OSM ways and node ids. It throws if:
- a way or node is missing from the extract;
- a step does not start on the node the previous step ended on (a gap, i.e. an invented connection);
- a one-way way is walked backwards;
- the loop does not close.

## Building footprints and height

- Position, orientation, width, depth, frontage: OSM footprint, unchanged unless it intrudes into the gameplay corridor (then moved straight back; see doc 04).
- **Height: estimated for every ordinary building.** None of the 766 CBD footprints carries `building:levels` or `height`. Storeys are drawn from a fixed distribution (mostly 2–4, some 5–8, more on large plots), deterministic per OSM id so the city is identical every run. This is a judgement, not a measurement (doc 10).
- Tagged heights would be used automatically if mappers add them; rerun `cbd:fetch` + `cbd:build`.

## Elevation

Not modelled; the CBD is flat in game. Freetown's streets slope down toward the water, but no elevation source with sub-metre accuracy at street scale was available (SRTM's ~30 m grid and metre-level vertical error would invent gradients rather than measure them). Listed as an open item in doc 10.
