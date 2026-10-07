# Poda-Poda Run — Architecture Implementation Checklist

**Status:** In progress; checked items have passed their stated checks. Full-route, device, and Cloudflare checks remain open.  
**Based on:** the proposed technical architecture, [architecture assessment](architechture.md), [Danfo Run research](research/danfo-run-gameplay-architecture.md), and the current game files.  
**Guiding rule:** Keep a playable build at the end of every phase. Extract existing behavior before adding new behavior.

Mark a box complete only when its **done check** has been verified. The phases are ordered by dependency, not by the proposed architecture's folder listing.

## Implementation audit — 6 October 2026

The game now has a finite 13-stop route, separate earnings and skill score, route-complete and crash states, pause/resume, a three-goal mission system, a local paint and slogan garage, quality profiles, a Vite entry module, and a Worker/D1 leaderboard scaffold. The gameplay rules and several systems have headless tests; `npm test` and `npm run build` pass. The old district, vehicle, and people plug-ins remain connected through an adapter.

**Still requiring implementation or verification:** a fixed simulation timestep; full separation of stop, spawn, and rendering logic; ES-module migration of the root plug-ins; measured phone performance and the first-stop playtest; traffic and district gameplay tuning; broader asset and audio ownership; a configured D1 database, production Worker deployment, and full-route browser checks. The local API has no database, so it currently displays offline status. See [online setup](online-setup.md).

The migrated build was checked in the browser after the tool's temporary usage limit expired: title, garage preview, starting from the garage, pause/resume, quality selection, portrait layout, local crash result, and the Vite development server all worked without logged browser errors. A viewport override does not simulate a touch device, and a complete Goderich-to-FBC run has not been observed. The production bundle builds but has not been played in a browser.

### Current implementation layout

```text
poda-poda-run/
├── index.html, drive-ui.css, vehicles.js, people.js, districts-*.js
├── package.json, vite.config.mjs, wrangler.example.jsonc
├── public/CNAME
├── src/main.js
├── src/engine/{GameClock,GameStateMachine,EventBus}.js
├── src/simulation/RunRules.js
├── src/simulation/systems/{Player,Traffic,Collision,Passenger,Mission}System.js
├── src/input/InputManager.js
├── src/rendering/CameraSystem.js, src/rendering/QualityManager.js
├── src/services/ApiClient.js
├── server/worker.mjs, server/services/ScoreValidator.mjs
├── server/db/{schema.sql,migrations/0001_initial.sql}
├── tests/*.test.cjs
└── doc/{architechture.md,architecture-implementation-plan.md,online-setup.md}
```

This is the current structure; the larger tree below remains the target. Existing root-level visual assets are intentionally still loaded by the Vite entry while their replacements are pending.

## Phase 0 — Agree on the game contract

- [ ] Choose the primary mode: a finite Goderich-to-FBC shift, with an endless mode only if wanted later. **Done check:** the route has an explicit finish condition and the result screen's meaning is written down.
- [ ] Confirm the 13-stop route and the role of Chapter One. Preserve the current Goderich → Lumley → Lumley Beach Road order unless the design intentionally changes it. **Done check:** one authoritative ordered list is agreed for route logic, HUD, and district selection.
- [ ] Decide what happens at FBC if the player misses the final stop, has passengers aboard, or crashes near the finish. **Done check:** each case has an unambiguous result.
- [ ] Define the run summary: distance, passengers delivered and lost, stops served and missed, stop grades, collisions, earnings, score, and completion status. **Done check:** every displayed result has a clear source.
- [ ] Decide whether road coins are spendable currency, part of earnings, or removed. Define skill score separately from fare earnings. **Done check:** a player can understand why their best run improved.
- [ ] Capture the current playable behavior on desktop and portrait mobile as a migration baseline. Include first stop, collision, restart, title, sound, and district transitions. **Done check:** later phases can compare against these observations.

## Phase 1 — Complete and tune the existing shift

**Current starting point:** route, stops, passengers, collisions, and results are in `index.html`.

- [ ] End the finite shift at FBC instead of silently wrapping to Goderich. **Progress:** the rule and result state are implemented and unit tested; full browser completion is still unverified.
- [ ] Add a route-complete result distinct from a crash result, using the agreed run summary. **Done check:** both outcomes report accurate totals and can start a new run.
- [ ] Playtest the first stop on a portrait phone and a desktop. Check visibility of the yellow zone, right-lane movement, braking distance, and miss explanation. **Done check:** a new player can serve or intentionally miss it and understand the outcome.
- [ ] Adjust stop cues and feedback based on that test before adding graded scoring. **Done check:** the HUD, road marker, and result agree about the stop outcome.
- [ ] Record performance on a representative phone, including frame time and visual quality near dense districts. **Done check:** there is a baseline for later refactoring and quality settings.

**Gate:** do not start leaderboard work until the run can finish and its result is trustworthy to the player.

## Phase 2 — Build the small engine foundation

**Goal:** centralize lifecycle while preserving the Phase 1 gameplay and rendering.

- [ ] Introduce an explicit state machine for boot/loading, title, playing, paused, route complete, game over, results, and garage when the garage exists. **Done check:** input and updates cannot continue in an inappropriate state.
- [ ] Define one game clock with pause/resume and a capped elapsed-time catch-up for background tabs. **Done check:** returning from a suspended tab does not jump the bus or simulate a long backlog.
- [ ] Move keyboard, pointer, brake/gas, horn, and future gamepad input into a common command interface. **Done check:** keyboard and touch produce the same gameplay commands.
- [ ] Add a narrow game event contract for stop served/missed, passengers boarded/dropped, collision, route complete, and run over. **Done check:** each gameplay fact is emitted once, with a documented payload.
- [ ] Move camera behavior into a dedicated presentation component. Preserve chase position, gas FOV change, shake, and portrait framing. **Done check:** camera changes no longer alter game rules.
- [ ] Keep the existing title-town view and audio behavior working through state transitions. **Done check:** starting, pausing, resuming, and restarting do not leave duplicate loops or sound running.

**Gate:** the same complete shift still plays before deeper simulation extraction.

## Phase 3 — Separate simulation from Three.js

**Goal:** game rules operate on plain JavaScript state; Three.js displays that state.

- [ ] Extract route progress and stop identity from meshes and the HUD. **Progress:** the ordered route and end condition are pure data, but progress still lives partly in the main loop.
- [x] Extract passenger capacity, relative destinations, boarding, delivery, and loss. **Done check:** seat counts stay within 0–14 and a missed stop has the agreed outcome.
- [x] Extract stop eligibility and grading using position, lane, speed, and any agreed timing rule. **Done check:** boundary cases produce predictable grades without a browser.
- [ ] Extract player speed, lane movement, and condition/damage from the rendered bus. **Progress:** speed and lane state have frame-rate tests; damage remains in the main loop.
- [ ] Extract traffic spawn state, movement, collision bounds, and despawn from vehicle meshes. Start with the current behavior. **Done check:** collisions use simulation positions and remain aligned with visible vehicles.
- [ ] Make score and earnings consume gameplay outcomes in one place. **Done check:** stops, coins, collisions, and completion cannot accidentally award or deduct twice.
- [ ] Introduce a fixed simulation timestep and render interpolation only after the state above is independent of Three.js. Make time-based spawn and weave decisions independent of render FPS. **Done check:** 30, 60, and 120 FPS runs have materially consistent progress and outcomes.
- [ ] Synchronize player, traffic, stop, people, effects, and HUD views from simulation state/events. **Done check:** rendering can be disabled without changing gameplay results.

Use small system-oriented modules. A general-purpose ECS or physics engine is unnecessary for the current arcade driving model.

## Phase 4 — Migrate the project structure and preserve performance

- [ ] Add Vite while staying in vanilla JavaScript. Move the inline game script to an entry module in manageable pieces. **Progress:** Vite development play and production build pass; production browser play remains to check.
- [ ] Convert `window.PODA` model and district plug-ins to ES modules incrementally. Keep a temporary adapter until all imports have moved. **Done check:** no district, vehicle, or person model disappears during migration.
- [ ] Give route data one owner and connect district definitions to both presentation and agreed gameplay modifiers. **Done check:** a route edit cannot silently desynchronize stops and district selection.
- [ ] Formalize the existing 30 m chunk recycling and geometry/material caches. **Done check:** chunk counts and GPU resource use remain stable during a long run.
- [ ] Add asset loading/disposal ownership where it solves an observed issue. Check procedural textures, stop groups, audio, and title-town resources. **Done check:** restarting and crossing many districts do not grow retained resources without bound.
- [ ] Keep merged static scenery, instanced coins, people LOD, and adaptive pixel ratio. Add low/medium/high presets only if measurements justify them. **Done check:** representative phone performance is at least as good as the Phase 1 baseline.
- [ ] Add JSDoc and targeted checking for shared run, entity, event, and route shapes. **Done check:** module contracts are clear without a TypeScript conversion.

The proposed `src/` tree is a destination, not a requirement to create every empty file up front.

### Target folder structure

This is the intended structure **after** the staged migration. Create each module when its checklist item is implemented. The current root-level scripts remain usable through a temporary adapter until their replacements work.

```text
poda-poda-run/
├── index.html
├── package.json
├── vite.config.mjs
├── wrangler.example.jsonc          # copy and configure for an account
├── public/
│   ├── audio/
│   ├── textures/
│   ├── models/
│   ├── icons/
│   └── manifest.webmanifest
├── src/
│   ├── main.js                     # boot and composition
│   ├── engine/
│   │   ├── GameEngine.js
│   │   ├── GameClock.js
│   │   ├── GameStateMachine.js
│   │   └── EventBus.js
│   ├── simulation/
│   │   ├── World.js
│   │   ├── RunState.js
│   │   └── systems/
│   │       ├── PlayerSystem.js
│   │       ├── TrafficSystem.js
│   │       ├── CollisionSystem.js
│   │       ├── PassengerSystem.js
│   │       ├── StopSystem.js
│   │       ├── RouteSystem.js
│   │       ├── ScoreSystem.js
│   │       ├── MissionSystem.js     # later gameplay phase
│   │       └── DifficultyDirector.js # only if measured need
│   ├── rendering/
│   │   ├── Renderer.js
│   │   ├── CameraSystem.js
│   │   ├── AssetManager.js
│   │   ├── ChunkManager.js
│   │   └── renderers/
│   │       ├── PlayerRenderer.js
│   │       ├── TrafficRenderer.js
│   │       ├── PeopleRenderer.js
│   │       ├── DistrictRenderer.js
│   │       └── EffectsRenderer.js
│   ├── world/
│   │   ├── DistrictManager.js
│   │   ├── routes/
│   │   │   └── goderich-fbc.js     # one authoritative stop order
│   │   └── districts/
│   │       ├── goderich.js
│   │       ├── lumley.js
│   │       ├── lumley-beach-road.js
│   │       ├── chapter-one.js
│   │       ├── aberdeen.js
│   │       ├── wilberforce.js
│   │       ├── imatt.js
│   │       ├── congo-cross.js
│   │       ├── cotton-tree.js
│   │       ├── pz.js
│   │       ├── abacha-street.js
│   │       ├── eastern-police.js
│   │       └── fbc.js
│   ├── entities/
│   │   ├── vehicles/              # migrated vehicles.js models
│   │   └── people/                # migrated people.js models
│   ├── input/
│   │   ├── InputManager.js
│   │   ├── KeyboardInput.js
│   │   └── TouchInput.js
│   ├── audio/
│   │   └── AudioManager.js
│   ├── ui/
│   │   ├── HUD.js
│   │   ├── PauseMenu.js
│   │   ├── ResultsScreen.js
│   │   ├── Garage.js
│   │   └── Leaderboard.js
│   ├── services/
│   │   ├── ApiClient.js
│   │   ├── LocalStorage.js
│   │   └── Analytics.js
│   └── data/
│       ├── game-config.js
│       ├── scoring.js
│       ├── missions.js
│       └── vehicle-config.js
├── server/                         # Phase 6 only
│   ├── worker.mjs
│   ├── routes/
│   │   ├── runs.js
│   │   └── leaderboard.js
│   ├── services/
│   │   ├── ScoreValidator.js
│   │   └── LeaderboardService.js
│   └── db/
│       ├── schema.sql
│       └── migrations/
├── tests/                          # focused rule and browser checks
├── doc/
└── research/
```

Ownership rule: `simulation/` may read game data and emit events, but it must not import Three.js or access the DOM. `rendering/`, `ui/`, and `audio/` consume simulation state or events. `server/` is independent of client presentation. Keep the existing `drive-ui.css` and other root assets working until the build migration gives them a stable home.

## Phase 5 — Add depth to the finished game

- [ ] Introduce transparent stop grades after the stop playtest. **Done check:** the result explains the grade and scoring matches it.
- [ ] Add a small, predictable traffic behavior set for taxi, kekeh, okada, Waka Fine, and other poda-podas. **Done check:** behaviors are visible, avoid unavoidable blocks, and respect stop approach space.
- [ ] Add district-specific gameplay parameters sparingly: traffic mix, pedestrian activity, ambience, and stop approaches. **Done check:** districts feel different without making hazards unfair or hiding the road.
- [ ] Add a few data-defined missions based on existing events: delivered passengers, accurate stops, named district reached, and safe completion. **Done check:** mission progress is correct after restart and is distinct from geographic stops.
- [ ] Build a small player garage from the existing bus model, beginning with paint and slogan selection. **Done check:** the selected look appears in play and persists locally.
- [ ] Add a dedicated difficulty director only after normal traffic has been measured. **Done check:** difficulty changes density and decision complexity within documented safe bounds, not merely speed.
- [ ] Split audio controls into engine, effects, voice, ambience, and music as the corresponding sounds exist. **Done check:** pause, mute, and browser background behavior are consistent across categories.

Daily modifiers, a large upgrade economy, and extra camera modes can wait until repeated runs show a need for them.

## Phase 6 — Define and build online competition

**Dependency:** finite-run rules, score formula, and game version are stable.

- [ ] Define the public run contract and privacy choices: anonymous player ID, optional display name, allowed fields, retention, and how invalid submissions appear to the player. **Done check:** the client and server share a versioned schema.
- [x] Define what the server can actually verify. Specify plausible duration, distance, stop count, passenger count, and score checks; decide whether any event trace is required. **Done check:** claims about server-calculated score match the evidence the server receives. See [online setup](online-setup.md); aggregate validation is explicitly limited.
- [ ] Add the small Worker API for run start/finish, leaderboard periods, and player best. **Done check:** invalid or repeated finish requests do not create ranked runs.
- [ ] Store accepted runs once in D1, with indexes that match the actual leaderboard queries. Keep database access behind a small repository interface. **Done check:** today, week, and all-time boards return ordered, paginated results.
- [ ] Add rate limits and basic abuse handling suited to shared mobile networks. **Done check:** normal play works while rapid repeated submissions are constrained.
- [x] Keep the game playable if the API is unavailable; queue or show local results according to the agreed product behavior. **Done check:** network failure cannot erase the local run result.
- [ ] Add analytics only for questions the team intends to answer, such as stop misses, district crashes, completion, and replay. **Done check:** events are documented and avoid unnecessary personal data.
- [ ] Add build, simulation, browser, and deployment checks appropriate to the new architecture. **Done check:** a preview build can complete a shift on desktop and portrait mobile before release.

## Release checks for every implementation phase

- [ ] Desktop and portrait controls still start, steer, brake, stop, crash, finish, and restart as applicable.
- [ ] HUD, audio, camera, and visible objects agree with the underlying game state.
- [ ] No duplicate timers, input handlers, animation loops, or audio continue after restart or pause.
- [ ] Dense districts and long runs remain within the agreed phone performance target.
- [ ] Changes to game rules have focused tests; visual and interaction changes have a real browser check.

## Explicitly deferred

Phaser, React, a full ECS library, realistic rigid-body physics, machine learning, multiplayer, WebSockets, mandatory accounts, and microservices are outside this plan unless the game's requirements change.
