# 09 — Performance

## Test environment and its limits

- Machine: Intel Core i9-9880H MacBook (16 threads), macOS 14, **headless Chromium** (Playwright's Chrome for Testing), 1280×800 and a 412×860 @2× phone viewport.
- **No real phone was tested.** The phone viewport checks layout and input, not phone GPU performance.
- **Headless frame rates on this machine are not trustworthy.** Repeated identical runs of the *unmodified* game measured anywhere from 1.4 fps to 34 fps mean, and frame rate collapses to 1–5 fps for tens of seconds at random (observed in both modes). Frame-rate numbers below are therefore reported as observations, not as passes or failures. Draw calls, triangles, geometry and heap counts are deterministic enough to compare and are the evidence used.

## Measurements

| Scene | Draw calls | Triangles | Notes |
|---|---|---|---|
| Original game, play (smoke) | 156–261 | 71k–134k | varies with district and traffic |
| Original game, `?benchmark` | 169–173 | 123k–125k | before 173 / 124,840; after 171 / 125,426 (variance from unseeded `pick`) |
| CBD, play (smoke run) | 159–169 | 88k–97k | |
| CBD, full autopilot lap | 39–231 | 40k–137k | lowest on corners (tiles culled), highest looking down Wallace Johnson St |
| CBD, static viewpoints | 26–127 | 42k–122k | |

The CBD stays inside the original game's draw-call and triangle envelope. That is achieved by:
- merging all static geometry per material into **100 m tiles** (frustum- and shadow-culled as units; tiles are also hidden beyond the quality profile's draw distance);
- instancing the 303 trees (2 draw calls) and reusing the coin `InstancedMesh`;
- façades as two shared textures (window bay and an 8-cell shopfront atlas), colour by vertex.

### Frame rate (observational)

| Run | Mean fps |
|---|---|
| Original game, 20 s drive, back-to-back pair | 26.6 |
| CBD, same conditions, same pair | 25.8 |
| CBD smoke run | 26–60 |

### Memory (six consecutive 25 s CBD runs, forced GC)

| Run | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| GPU geometries | 189 | 239 | 252 | 261 | 255 | 247 |
| Textures | 27 | 33 | 35 | 35 | 33 | 33 |
| JS heap (MB) | 47 | 50 | 50 | 51 | 50 | 50 |

Geometry plateaus once traffic pools fill (the original game shows the same pattern: 117 → 220 → 186 over six runs, heap 28–37 MB). The CBD adds about 15–20 MB of heap (dataset and merged geometry) and stays flat. No unbounded growth was observed.

### Load and bundle

- Bundle: 836 kB → 969 kB raw (266 → 314 kB gzip), i.e. +133 kB / +48 kB gzip for the CBD code and its ≈100 kB dataset.
- CBD construction at boot: route build ≈12 ms and footprint fitting ≈11 ms in Node; mesh building was not separately timed in the browser.
- The CBD code and data are in the main bundle; if CBD becomes default, a dynamic `import()` behind the flag would keep them out of the non-CBD path.

## Provisional budgets

| Budget | Target | Status |
|---|---|---|
| Draw calls in play | ≤ original game's peak (~260) | met in all observed frames (max 231) |
| Triangles in play | ≤ 150k | met (max 137k observed) |
| Heap growth across runs | flat after pools fill | met (≈50 MB) |
| 60 fps desktop / 30 fps mid-range Android | — | **not verified**: needs real devices |

## What to measure next

1. A mid-range Android (e.g. 3–4 GB RAM) on Chrome with `?cbd&stats` — the stats overlay shows fps, draws, triangles and pixel ratio.
2. The same with `?cbd` and the quality profile set to Low.
3. A desktop browser with a real GPU.
