# 08 — Implementation plan and status

Start here. This is the index for the CBD work and the honest status of each phase.

| Doc | Content |
|---|---|
| 01 | Existing game audit, baseline, integration strategy |
| 02 | Boundaries, playable route, exclusions |
| 03 | Data sources, projection, pipeline, licence |
| 04 | Road and junction inventory, path smoothing, measured deviations |
| 05 | Landmark inventory and confidence |
| 06 | References and the review pack (`img/`) |
| 07 | Gameplay architecture: route, mapping, camera, speed, fairness |
| 09 | Performance measurements and limits |
| 10 | Assumptions, estimates, open questions |

## How to run it

```
npm run dev                     # then open http://localhost:5173/?cbd
                                # add &stats for the fps/draw-call overlay
                                # ?cbd#demo runs the autopilot round the loop
npm test                        # unit tests incl. tests/cbd-route.test.cjs
npm run smoke                   # headless regression run incl. the CBD section
npm run cbd:fetch && npm run cbd:build   # refresh the OSM data
npm run cbd:views -- --url=http://localhost:5173/   # regenerate the review pack
npm run cbd:drive -- --url=http://localhost:5173/ --shots=out/   # autopilot lap log
```

## Code map

| File | Responsibility |
|---|---|
| `scripts/cbd/fetch-osm.mjs` | Overpass queries → `.cache/cbd-osm/` |
| `scripts/cbd/build-cbd.mjs` | Loop walk over OSM ways (connectivity and one-way checks), junctions, stubs, footprints, trees, coast → `src/cbd/data/cbd-data.json` |
| `src/cbd/geo.js` | WGS84 ↔ local metres |
| `src/cbd/RoadPath.js` | Polyline → filleted, arc-length-parametrised path; `frameAt`, `toWorld`, `nearest`, `turns` |
| `src/cbd/CbdRoute.js` | Stops, turn cues, speed envelope, spawn rules, footprint fitting (pure, tested) |
| `src/cbd/CbdWorld.js` | Static meshes: road, stubs, buildings, trees, lamps, vendors, sea |
| `src/cbd/landmarks.js` | Tier 1/2 landmark models |
| `src/cbd/CbdMode.js` | Integration: road space → real streets per frame, camera, panorama, attribution |
| `tests/cbd-route.test.cjs` | 13 tests: projection, data, connectivity, path tolerance, continuity, side, stops, speed envelope, simulated lap, PlayerSystem regression, spawn rules, cues, building corridor |

## Phase status

| Phase | Exit criterion (brief §14) | Status | Evidence |
|---|---|---|---|
| A — proof of concept | Curved real road drivable without steering/collision/camera/render failures; compared to map | **Done** | Full laps by autopilot and by keyboard/touch play; path within 0.11 m median of OSM (doc 04) |
| B — road network | Junction connectivity, orientation, curve continuity | **Done for the loop** | Build-time walk checks; continuity tests; 32 junction stubs. Not a drivable network (option B deferred) |
| C — landmarks | Defensible positions, recognisable in side-by-side comparison | **Partly done** | 9 landmarks at OSM positions. Side-by-side photo comparison **not done** (doc 05) |
| D — streetscape | Density, height variation, distinct street identities | **Partly done** | 766 footprints, civic vs market treatment, mapped trees. Heights estimated; shopfront variety limited to 8 designs |
| E — gameplay integration | Full session works without unrelated changes | **Done** | Smoke 30/30 incl. CBD; stops, scoring, restart, pause, audio, touch and keyboard exercised |
| F — optimisation | Meets budgets on tested hardware, or limits reported | **Partly done** | Draw-call/triangle/heap budgets met; fps on real devices not measured (doc 09) |
| G — verification | Geometric, gameplay, performance, regression testing | **Partly done** | Geometric, gameplay and regression tests pass; visual and local-review validation outstanding |

This is a **Phase 1 preview behind a flag**, not a finished reconstruction.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Building heights/façades look generic to locals | High | Recognition | Local review pack (doc 06); add `building:levels` to OSM, rebuild |
| Real-phone frame rate too low | Medium | Playability | Quality profiles now also cull CBD tiles; measure on device (doc 09) |
| OSM edits change way/node ids used by the loop | Low | Build fails | The build fails loudly; ids are listed in `build-cbd.mjs` |
| ODbL attribution removed in a UI refactor | Low | Licence breach | Attribution lives in `CbdMode.js`, next to the data it covers |
| `main.js` changes conflict with other work | Medium | Merge cost | All changes small and guarded by `cbd` |

## Prioritised remaining work

1. **Street-level references**: Mapillary sequences (CC BY-SA) or local photos for the ten review viewpoints; do the §15.2 comparison and fix the largest differences (Cathedral tower, City Hall façade, Big Market).
2. **Local review** with the pack in doc 06.
3. **Real-device performance** (doc 09).
4. **Heights**: tag `building:levels` in OSM for the loop frontages from photos, then rebuild.
5. **Elevation** from a survey-grade source, if one becomes available.
6. Decide whether CBD becomes a selectable route (it would then need the online score validator to accept `route: 'cbd'`).

## Future zones (East End, West End)

The CBD is a dataset plus a loop definition, not a scene file. A new zone would add:
1. its own `LOOP` walk (way ids + node ids) and bbox in a build script, emitting `src/<zone>/data/*.json`;
2. its own landmark list;
3. a `create<Zone>Mode` that reuses `RoadPath`, `CbdRoute` (rename to a generic route module at that point) and `CbdWorld`.

Joining zones (e.g. CBD → Eastern Police along Kissy Road) is a longer walk in the same format; the mapping technique does not care how long the loop is. Nothing for East or West End has been built.
