# 01 — Existing game audit

Audited on branch `feat/cbd-phase1` (from `feat/offline-audio-okada` @ `5e731cd`), 2026-10-15, before any CBD code was written. Everything below was read from the code or observed by running it; nothing is inferred from file names alone.

## Architecture

| Area | What the code does | Where |
|---|---|---|
| Build | Vite 8, `base: './'`. One bundle (`dist/assets/index-*.js`, 836 kB / 266 kB gzip before this work; Vite warns about >500 kB). | `vite.config.mjs`, `package.json` |
| Rendering | Three.js **0.128.0**, bundled (not CDN). One `WebGLRenderer`, PCF soft shadows from one directional "sun", ACES tone mapping, linear fog 90–240 m, camera far plane 700 m. | `src/main.js` §Three.js setup |
| Code shape | `src/main.js` (~2,050 lines) owns the scene, flow, HUD, audio and input wiring. Pure rules live in small UMD modules (`window.PODA_*` in the browser, `module.exports` in Node tests): `RunRules`, `PlayerSystem`, `CollisionSystem`, `TrafficSystem`, `TrafficAI`, `PassengerSystem`, `MissionSystem`, `JumpSystem`, `CameraSystem`, `QualityManager`, `InputManager`. | `src/simulation`, `src/rendering`, `src/engine` |
| Scenery | A *plug-in* model: `window.PODA.districts[name].fill(chunk, kit)` fills 30 m scenery chunks; `landmark()` decorates a stop. Districts are visual archetypes keyed by stop name (`districts-west.js`, `districts-east.js`, `src/data/EasternDistricts.js`). | |
| Persistence | Best score and a local leaderboard in `localStorage` (`poda-scores-v2`). A Cloudflare Worker + D1 schema exists for online scores (`server/`), but the client comment says new vehicle/route scores stay local. | `src/main.js`, `server/` |
| Deploy | `npm run deploy` = build + `wrangler deploy`; CI runs `npm test`, `npm run build`, `wrangler deploy --dry-run`. | `.github/workflows/check.yml` |
| Offline | Service worker registered in production builds only. | `public/sw.js` |

## How a run actually works (observed and confirmed in code)

- **Endless runner in road space.** The player never moves forward. It sits at `z = 0`; `stepPlayer` returns a distance `d` each frame and everything else (chunks, traffic, coins, stops, debris) moves `+d` along z. Lateral motion is three lanes at `x = −3.4, 0, +3.4` (`LANE_W 3.4`, `ROAD_HALF 5.45`).
- **The road is one straight 200 m plane** whose texture offset scrolls; 8 recycled 30 m chunks carry scenery.
- **Steering is lane-based**: arrows/A-D/swipe step the lane; `x` eases toward the lane centre at the vehicle's `handling` rate. Gas/brake change speed; the target speed rises from 15 to 33 m/s over 6 km (×1.45 with gas, capped by the vehicle's `maxSpeed`).
- **Objective**: serve a fixed list of named stops (route), each 420–560 m apart (random), stopping in the kerb lane inside a yellow box below 3.5 m/s. Overshoots can be recovered by reversing.
- **Losing**: three knocks of "condition" (a second knock within 4 s costs two). Potholes slow you; other obstacles damage.
- **Score**: `RunRules.calculateScore` — deliveries, stops, perfect stops, distance, style multiplier, finish bonus, minus misses and collisions.
- **Obstacles**: `spawnRow` every 30–42 m at z = −200 (denser with distance); never in the kerb lane within 55 m of the *current* stop.
- **Camera**: `CameraSystem` eases to `(x+2, 4.5, 13.5)` behind and looks at `(lookX, 1.5, −16)`, with acceleration pull, FOV kick and shake.
- **Quality**: `QualityManager` lowers device-pixel ratio, then shadows, when frames exceed 1/45 s; profiles set fog/draw distance and crowd density for chunks.

## Baseline (before any CBD change)

| Check | Result |
|---|---|
| `npm test` | **41 / 41 pass** |
| `npm run build` | OK (bundle-size warning only) |
| `npm run smoke` (headless Chromium, 1280×800) | **23 / 23 pass, 0 page errors** — 230 draws · 109k triangles in play; benchmark scene 173 draws · 125k triangles |

Screenshots of the baseline title, driving, garage and leaderboard were captured by the smoke run (not committed; regenerate with `npm run smoke -- --shots=<dir>`).

## What makes it fun (observed)

Short, readable decisions: change lane, ride the gas, judge a stop. Constant forward motion, Krio call-outs, quick restarts. Anything CBD adds must keep those loops intact.

## Extension points and the chosen integration

The decisive finding: **all simulation is already in road space.** Collision is an axis-aligned test on `(x, z)` relative to the player; traffic, stops and coins only ever use `x` (lateral) and `z` (along). That means real curves do not need a new physics model — only a different *drawing* of road space.

The safest approach, and the one implemented, is therefore:

1. Leave every simulation system as it is.
2. Build the CBD as static geometry in real plan coordinates.
3. Immediately before each frame is drawn, map every road-space object (player, traffic, coins, stops, camera, sun) onto the surveyed centreline; restore their road-space values immediately after.

The only shared-system change is an optional `run.speedCap` in `PlayerSystem` (no cap → identical behaviour, covered by a test). Everything else is behind the `?cbd` URL flag.

## Files touched outside `src/cbd/`

| File | Change | Why |
|---|---|---|
| `src/main.js` | Flag, CBD construction at boot, render-time mapping, real leg lengths, kerb-lane rule at every CBD stop, corner spawn rule, turn hint, score label, read-only debug hook. Straight-road meshes grouped under one `street-static` node so they can be hidden. | Integration points; all guarded by `cbd` |
| `src/simulation/systems/PlayerSystem.js` | Optional `speedCap` | Corners need a speed envelope |
| `scripts/smoke.mjs` | CBD section | Regression gate |
| `package.json`, `.gitignore` | `cbd:*` scripts; `.cache/` | Tooling |

## Risks identified at audit time

- `main.js` is a large closure; mistakes there break everything → changes kept small, each guarded by `cbd`.
- Stop leg lengths were random; real streets need real distances → `distanceToStop`.
- The camera assumes a straight road → mapped per frame, not rewritten.
- Pre-existing: geometry count grows over the first few runs as pools fill (seen in baseline too, see doc 09).
