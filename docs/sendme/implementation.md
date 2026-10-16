# SendMe rider engineering report

## Architecture and integration

PodaPoda Run uses Three.js 0.128, Vite and a road-relative simulation in
`src/main.js`. The player remains near z=0; traffic advances toward -z relative
to scrolling distance. TrafficSystem owns displacement/despawn, TrafficAI owns
ordinary vehicle decisions, CollisionSystem checks road-space rectangles, and
TrafficPool reuses visuals. The GameClock caps simulation steps at 50 ms.
Camera, input, scoring, audio, and run lifecycle remain unchanged.

Classic streets are straight. The existing CBD preview maps road-space objects
onto a continuous RoadPath before rendering, then restores their transforms.
SendMe uses this mapping unchanged, including tangent heading and lane offset.
Both drivable surfaces are flat: the surrounding hills are scenery, not driving
surface elevation. There is no slope implementation to integrate or validate.

Selected approach: a procedural, shared, low-poly model and a small dedicated
following controller, registered in the existing traffic loop. No dependencies,
frameworks, physics engine, backend, UI redesign, or unrelated asset changes.
Existing uncommitted CBD/UI work was preserved.

## Files introduced or edited for this feature

- `src/assets/vehicles/sendmeRider.js`: original 3D model factory, shared template,
  independently baked moving assemblies, wheel/steering/lean/brake animation.
- `src/simulation/systems/SendMeController.js`: configurable spawn share and
  enabled switch; acceleration, braking, following and emergency separation.
- `src/assets/vehicles/trafficPool.js`: preserve SendMe's independently baked
  pivots and reset wheel/fork/lean/brake transforms on checkout.
- `src/main.js`: register model/controller, replace a configured fraction of
  motorcycle spawns, use CBD speed caps/curvature, and expose a stats-only
  guarded spawn hook for verification.
- `public/assets/sendme/logo.png`: locally served official logo at 512px width.
- `public/assets/sendme/README.md`: logo source and brand-approval note.
- `tests/sendme.test.cjs`: following, player awareness, frame-step, multi-rider,
  collision and despawn regression tests.
- `scripts/sendme-check.mjs`: actual browser gameplay, animation, collision,
  pool-reuse, curve, restart, mobile-touch and renderer checks.
- `docs/sendme/implementation.md`: this assessment, evidence and limitations.
- `output/sendme/*.png` and `output/sendme/results.json`: gameplay captures and
  measured browser results. These are evidence artifacts, not runtime assets.

## Implemented behavior and configuration

The default `window.PODA_SendMe.config` enables riders with `motorcycleShare=.08`
(8% of eligible motorcycle spawns, not 8% of all traffic). Set `enabled=false`
to stop new SendMe spawns; existing riders finish their lifecycle normally.
Settings live in SendMeController.js and can also be tuned through that runtime
object. This is a gameplay distribution, not a real-world market-share claim.

Riders stay in their selected lane, follow traffic and the player when ahead,
slow for static obstacles/crossers currently occupying that corridor, and
accelerate when it clears. States are CRUISING, FOLLOWING_TRAFFIC, BRAKING and
STOPPED. They obey CBD corner speed caps. Emergency stopping bounds displacement
rather than teleporting the rider backward. Existing collision damage, scoring,
invulnerability, crash debris and game-over behavior apply unchanged.

The regular spawnRow checks supply road validity, spacing, stop-area exclusion
and lane selection; normal despawn and reset use the traffic pool. Collision
bounds are .85 x 2.05 world units. No independent spawn timer or update listener
is installed. The optional `?stats` debug hook is `PODA.debug.spawnSendMe(lane,z)`;
it rejects player proximity and occupied positions. It intentionally supports
controlled test fixtures; normal gameplay has no rider debug UI.

## Visual asset

The supplied PNG was used as art direction, not placed into the scene. The
procedural model has two wheels, fork/handlebars, frame/engine, tank, mudguard,
seat, exhaust, rack, blue box, helmet, torso, articulated seated limbs, gloves,
boots and lights. Blue/orange/white styling follows the reference. The official
logo is on both cargo-box sides, its rear, and the jacket back.

The approximately 2m motorcycle is comparable with the existing 1.9m okada.
Its rider reaches roughly 1.96m including helmet. Lambert materials match the
existing art/rendering pipeline. Independent assemblies are baked to eight
meshes, 1,148 triangles. Shared buffers/materials/texture persist for application
lifetime and are never disposed when an individual clone leaves the scene.
Wheel spin uses travelled distance and radius, including CBD lane-offset arc
length. Fork steering and limited visual lean respond to curvature; collision
bounds remain upright. The brake lamp changes visible size without dynamic
lights or per-instance material mutation.

Brand source: https://www.sendmesl.com/images/sendme-new-logo.png, linked from
https://www.sendmesl.com/. The uniform is a stylization, not a verified actual
SendMe uniform. Brand approval may be needed for public/commercial release.

## Validation and performance

`npm run build` passes; Vite retains its bundle-size warning.
`npm test` passes all 59 tests, including four new rider tests.
The existing browser smoke suite passes 47 checks with zero page errors:
start, driving, passengers, audio lifecycle, pause, menus, leaderboard display,
CBD movement/restart and emulated mobile touch controls.
An earlier smoke run timed out at a hidden pause-menu control; the clean rerun
passed. Focused browser checks use deliberate fixtures through the real update
and render loops, not a standalone model viewer.

The renderer comparison adds one rider to the same loaded benchmark scene.
Measured incremental cost: eight draw calls, 1,148 triangles, eight geometry
buffers and one texture on first use. Reused clones share those resources.
See `output/sendme/results.json` for the latest raw measurements. FPS samples
vary with warmup and concurrent browser activity and are not a reliable speedup
or regression estimate. Environment: local macOS, Playwright Chromium 1228,
1280x800 desktop and 390x844 touch-emulated viewport, DPR 1 desktop.

## Known limits / release checks still needed

- No overtaking or delivery stops. Existing ordinary traffic lane changes do
  not guarantee a continuously clear passing corridor; safe lane following was
  selected instead. No pickup/drop-off, RECOVERING, or delivery mission system.
- Slopes/variable-width roads are not supported by the current road simulation.
- This retains the game's rectangle collision model and existing traffic AI;
  it is not swept rigid-body collision avoidance. Abrupt lateral intrusions by
  other vehicles/player still follow existing gameplay collision rules.
- Mid-range physical mobile hardware and extended-session memory/thermal
  profiling have not been measured. The 30 FPS mobile goal is not certified.
- Natural spawn probability is wired into normal traffic; focused visual
  verification deliberately spawns riders rather than waiting for a rare draw.
- Logo authorization remains a release consideration; no endorsement is implied.
