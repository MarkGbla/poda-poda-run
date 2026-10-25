# Day and night environment

## Investigation and reference

Reviewed 24 October 2026. This extends the existing lighting implementation rather than adding another environment system.

| Area | Existing modules and integration |
| --- | --- |
| Renderer and lifecycle | `src/main.js`: Three.js r128, ACES tone mapping, sRGB output, gradient background, HemisphereLight, one shadowed DirectionalLight, fixed run selection, pause/resume, render loop and texture loading |
| Quality and camera | `src/rendering/QualityManager.js`: automatic pixel ratio, Low/Medium/High distance and shadows. `CameraSystem.js`: chase camera and sun target |
| Streets | Recycled chunks in `main.js`; `src/cbd/CbdWorld.js` builds Central roads, facade atlases and lamps. `CbdMode.js` maps road-space objects to the actual curved road only while rendering |
| Models | `vehicles.js`, `src/assets/vehicles/freight.js`; cached models face −Z. Baking merges Lambert geometry. Player lamp rigs attach after baking |
| Traffic and reuse | `TrafficPool` retains baked groups; `TrafficAI` and `SendMeController` already report actual braking. Visual lighting reads these flags and speed; it does not change movement |
| SENDME | `src/assets/vehicles/sendmeRider.js`: shared model with separate lean, fork and wheel pivots. Lamp rig follows the existing lean pivot |
| Gameplay boundaries | `PlayerSystem`, `CollisionSystem`, `PassengerSystem`, `RunRules`, state machine and API/account modules retain their behavior |

The public [Danfo Run experience](https://danforun.com/) was inspected visually on 24 October. The observed Calabar scene used contrasting lane/curb edges, dark roadside silhouettes, legible vehicle details and soft road-light patches. A selectable night state, full day/night transition, brake-light behavior and real-phone performance could not be verified in that observation. No private source, bundled implementation, assets or city styling were used for this work. The transferable design principle is road/traffic contrast against darker scenery; Freetown's existing geography and architecture remain the basis here.

## Design and implementation

`src/rendering/EnvironmentManager.js` owns configurable DAY, SUNSET, NIGHT and SUNRISE presets. The existing start-screen choice is the least disruptive selection: `startRun()` reads it once, with no clock, randomness, route weighting or server change. The run retains its state through pause/resume. A later run can select another state.

Presets control sky, fog color, hemisphere color/intensity, directional color/intensity/direction, exposure, road color/roughness, building tint, window emission, backdrop contrast, contact-shadow opacity, hazard visibility and street/vehicle activation. QualityManager retains control over fog distance and shadow enablement. No new post-processing or weather system is introduced.

`setBlend(from, to, fraction)` interpolates colors and numeric values into one reusable preset and one reusable sky texture. It is an explicit extension API: competitive runs do not invoke transitions automatically. The SUNSET/SUNRISE presets give lamps and streetlights separate activation levels. Subscribers receive continuous brightness values. Material registration handles objects built after the run state has changed.

`src/rendering/VehicleLights.js` keeps two physical lamp positions on cars/buses, merged into one front mesh and one rear mesh per vehicle. Geometry is cached per model, and lamp materials and the soft projection texture are shared for the application lifetime. These unlit lamp surfaces provide the inexpensive visual equivalent of emission. The player gets one bounded, soft, shadowless SpotLight plus a road projection. Its target is a child of the vehicle, so steering and the Central world mapping move both source and target together.

Low disables the SpotLight but retains the road projection. Medium/Automatic keep the player spotlight and NPC visible lamps. High permits at most two NPC road projections within 24 m (approximately 1–2 seconds at ordinary traffic speeds). NPC lamp visibility follows the quality draw range. Motorcycle beams are shorter and narrower than the Poda's. Headlight ranges are world-space dimensions, independent of viewport size.

Brake lighting reads the existing controller flag, held/tapped braking, dwell, and deceleration in metres per second squared. A 120 ms hold prevents brief speed changes from producing flicker. The same slowdown is detected at 30, 60 and 120 Hz. Pausing freezes that signal. Pool checkout clears its history and visible lamps; disposal detaches the rig without freeing shared assets used by other vehicles.

`src/rendering/StreetLights.js` separates the existing poles from instanced lamp heads and soft road pools. Pool orientation follows the mapped street heading. Brightness responds continuously to the environment. There are no new streetlight PointLights or shadow maps. Three.js r128 intentionally disables InstancedMesh frustum culling; using the base lamp's sphere would incorrectly cull a city-wide batch.

The existing deterministic window/shop emission masks supply warm, selective light. CBD facades and the distant hills receive controlled night tints. Potholes retain a subtle rim. Pedestrians and static hazards receive a small night emission floor using one cloned material per shared source; ordinary scenery materials are not modified. Existing bright stop markings, collectibles and signs retain their contrast.

## Measurements

Headless Chromium on this computer, fixed benchmark vehicles with procedurally varying scenery. Values are representative samples, not identical-seed statistical comparisons. The follow-up desktop measurements ran without concurrent unit tests; an earlier busy CPU pass was excluded from the FPS comparison.

| Scene | FPS / frame time | Draw calls | Triangles | Active lights / shadow lights | Geometries / textures | Scene objects | Materials |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before, Day 1280×720 | 60 / 16.67 ms | 172 | 127,120 | 2 / 1 | 120 / 28 | — | — |
| Before, Night 1280×720 | 60 / 16.67 ms | 218 | 124,748 | 3 / 1 | 130 / 30 | — | — |
| After, Day 1280×720 | 59 / 16.94 ms | 170 | 124,006 | 2 / 1 | 119 / 28 | 724 | 57 |
| After, Night 1280×720 | 60 / 16.67 ms | 205 | 127,090 | 3 / 1 | 137 / 30 | 733 | 57 |
| After, Night portrait 412×860 | 60 / 16.67 ms | 206 | 125,920 | 3 / 1 | 137 / 30 | 728 | 58 |
| After, Night landscape 860×412 | 60 / 16.67 ms | 209 | 125,338 | 3 / 1 | 138 / 30 | 730 | 60 |
| After, Low Night 412×860 | 60 / 16.66 ms | 145 | 77,417 | 2 / 0 | 106 / 29 | 730 | 58 |
| After, Central Night 1280×720 | 59 / 16.94 ms | 75 | 100,291 | 3 / 1 | 71 / 28 | 1,269 | 66 |

Merged front/rear geometry reduces night lamp draws. The cached merged geometry increases the geometry count slightly but avoids a new geometry/material per spawned car. Scene object counting now includes hidden objects, while active lights use `traverseVisible` to account for hidden parents. The old object count was not comparable and is omitted. Baseline material counts were not available. Raw samples are in `doc/lighting-validation.json`.

GPU memory in bytes, actual Android/iPhone frame time and sustained thermal behavior remain unmeasured. Browser viewport emulation does not substitute for real phone GPU testing. No severe frame-time regression was observed in these desktop samples; the samples do not establish performance on every supported device.

## Verification checklist

| # | Check | Evidence / status |
| --- | --- | --- |
| 1 | Day starts | Browser benchmark and real UI restart passed |
| 2 | Night starts | Western/Central benchmarks and real UI start passed |
| 3 | Player headlights on at night | Browser and module assertions passed |
| 4 | Player projected lights off in day | Browser and restart assertions passed |
| 5 | Streetlights on at night | Western/Central assertions passed |
| 6 | Streetlights off in day | Browser and module assertions passed |
| 7 | NPC headlights and quality tiers | Module tests and benchmark captures passed |
| 8 | NPC rear running lamps | Module tests and captures passed |
| 9 | Actual NPC braking | TrafficAI-to-lamp integration test passed |
| 10 | Player brake lights | Actual ArrowDown input and frame-rate tests passed |
| 11 | SENDME lamps | Rig, lean-parent, beam size and shared-geometry tests passed; long-run visual review pending |
| 12 | Lamps follow steering | Transformed spotlight source/target tests passed |
| 13 | Beams face forward | Every supported rig tested; projections begin ahead of the front lamps |
| 14 | Road visibility | Western portrait/landscape and Central captures inspected |
| 15 | Pothole visibility | Benchmark captures inspected; subtle rims retained |
| 16 | Barrier visibility | Material floor tested; full live hazard sequence still requires manual play |
| 17 | Pedestrian visibility | Portrait capture inspected; material floor tested |
| 18 | Pickup/dropoff markers | Existing materials retained; complete stop sequence still requires manual play |
| 19 | Recognizable landmarks | Existing Central geometry retained; full route visual review pending |
| 20 | Material flicker | Stable cached assets and brake hold tested; short captures show no flashing |
| 21 | Disposal | Rig detach and shared-resource survival tests passed |
| 22 | Pool reset | Checkout clears lamps and braking history; test passed |
| 23 | Restart | Night → home → Day through actual UI passed, with exactly one player rig |
| 24 | Pause/resume | Simulation time and lighting remain stable; actual UI check passed |
| 25 | Mobile portrait | 412×860 Chromium viewport passed |
| 26 | Mobile landscape | 860×412 viewport plus live orientation change passed |
| 27 | Desktop | 1280×720 Western/Central passed |
| 28 | Low quality | Road beam retained; SpotLight/shadows off; capture inspected |
| 29 | FPS | Desktop headless results above; physical-phone/thermal validation pending |
| 30 | Day regression | Existing tests and build passed; sampled frame time and draw calls stayed comparable |

The existing 80 tests cover traffic, collisions, stops, passengers, controls, score validation, account/auth flows and other regressions. Eight additional lighting tests cover interpolation, material ownership, braking, steering, tiers, pooling and disposal. Cloudflare configuration and backend/authentication code are unchanged; no production deployment was performed during this pass.

## Reproduction

Use Node 22. Run `npm test` and `npm run build`. With `npm run dev -- --host 127.0.0.1 --port 5175` running:

```
PODA_URL=http://127.0.0.1:5175/ PODA_FLOW=1 node scripts/environment-smoke.mjs
```

`PODA_ONLY=0,1` selects desktop Day/Night for an isolated performance sample. `PODA_FLOW=only` selects the real-control lifecycle test. The script uses installed Chromium, or `SMOKE_CHROMIUM` can specify its executable. Screenshots are written to the system temporary directory. Before release, finish a manual Central run with stops/hazards and exercise long runs on physical Android and iPhone devices.
