# Poda-Poda Run upgrade delivery

This is a playable expansion of the existing game and Western vertical slice. It is **not completion of every production ambition in the supplied brief**. The remaining-work section is part of the handoff.

## Research

See [the dated research and audit](research/full-upgrade-2026-10-07.md). Live Danfo menu/garage inspection informed vehicle-first presentation, clear actions and progression hierarchy. Government/World Bank transport research supports a distinct Lumley transport hub, Congo Cross interchange and eastern freight corridor. Existing district research and assets preserve coastal, market and hillside differences. Routes are condensed arcade itineraries, not surveyed street maps. Satellite/street imagery was not newly inspected, and precise current junction layouts remain unverified.

## Implemented

- Five actual playable models: poda-poda (14), kekeh (3), taxi (4), okada (1), Waka Fine (30). Capacity, speed, acceleration, braking, lateral handling, collision dimensions, chase framing and engine pitch derive from the vehicle catalog.
- Western, Central, Eastern and Cross-City route definitions. All stops, passenger destinations, completion and garage route descriptions consume the selected route. Cline Town, Kissy, Wellington and Calaba Town have new commercial/warehouse/market archetypes using the existing building factory and street atlas.
- Immediate garage changes: body paint, livery, slogan, route board, front trim, roof rack, cargo, horn, rims and rear stickers. Local persistence, open-sided workshop and moving preview camera. The underlying procedural model is rebuilt immediately; no page reload is required.
- Space and upward swipe arcade jump; vertical distance/duration/ratio thresholds; pointer capture/cancellation; pedal gestures cancel pending swipes. Only explicitly tagged low debris can be cleared. Landing compression, sound and camera response.
- Potholes remain fixed relative to the road, apply one speed penalty and jolt, and never trigger the fatal double-collision path or eject passengers.
- Grouped roadwork hazards, low debris and existing repair details. Neighbour-aware traffic follows leaders, checks lane gaps, stops for pickups and reacts to horns. Crossing pedestrians wait for nearby moving players and step away after a horn. Existing boarding/alighting animations remain connected.
- Named, deduplicated local leaderboard entries with today/week/all-time filters. Local storage failure is reported. Scores use the existing central formula and mission events.
- Browser-generated 3840 × 2160 PNG poster with the actual customized Three.js vehicle, player name, score, route, Salone colours, hills and street illustration. Web Share files when supported, an explicit Download PNG action, automatic PNG fallback and copy-link fallback. Final links use the repository's configured CNAME, `https://poda-sl.dropxlabs.net/`; web-tool availability of that domain could not be verified.
- Preserved title scene, start transition, pause/resume, missions, district models, audio, chunk recycling, merged scenery, traffic pool and instanced coins.
- Mobile panel scrolling, short-landscape menu layout and correct production CSS ordering. Low graphics now reduces decorative chunk crowds as well as existing distance/resolution/shadow settings.

## Architecture and performance

Small pure modules own vehicle/route data, jump rules, road contact and traffic decisions. Existing player/collision/camera modules consume the new vehicle data; the main entry still composes scene, input, stops and UI. This deliberately preserves working plug-ins rather than introducing a new framework. Stop-owned textures are disposed when the stop leaves the world; poster render targets are disposed after capture.

Removed the unused eager town-model import. Final Vite JS: **229.45 KB / 111.22 KB gzip**, compared with approximately **818 KB / 469 KB gzip** during the early upgrade build that still loaded it. Final CSS is 20.55 KB / 5.55 KB gzip. Music remains a separate 3.04 MB asset; Three.js and fonts still load from the existing external sources.

Observed in the desktop in-app browser with portrait viewport overrides: **21–48 FPS**, **105–217 draw calls**, roughly **36k–74k triangles**, frequently at adaptive DPR 0.60. Several samples included other live 3D tabs, so these are diagnostic observations, not an isolated performance benchmark or real-phone measurements. A later isolated low-quality portrait sample reached **50–60 FPS at DPR 0.80**; this remains a desktop-host observation. A stable 60 FPS physical-mobile target has **not** been demonstrated. No comparable before/after draw-call benchmark was captured.

## Validation

- `npm test`: **26 passed**, zero failures.
- `npm run build`: passes; the previous oversized-JS warning is gone.
- `git diff --check`: passes.
- Production browser: complete Western shift using the existing demo driver: **4 stops served, 0 missed, 17 passengers delivered, 0 collisions, score 2,291**. A second final-build run with the customized green poda completed with 18 delivered, 4 served, 0 missed, 1 collision and score 2,387. This verifies route completion/boarding/scoring integration; it is not a novice manual-driving playtest.
- Actual run HUD capacity checks: poda 7/14, kekeh 2/3, taxi 2/4, okada 1/1, Waka Fine 15/30. Full runs were not completed for every vehicle/route combination.
- Browser checks: live model selection, paint, cargo/rack, rims and stickers; eastern driving; keyboard commands; pause/resume; low quality selection; portrait HUD and garage; name input; repeated save deduplication; all three leaderboard periods.
- Poster downloaded and inspected, and its actual PNG dimensions verified as 3840 × 2160. The native OS share flow could not be verified; a later export attempt remained pending in-browser. A separate Download PNG action now bypasses native sharing, but its new button path has only build/syntax validation, not a third completed-run browser check. The first poster evidence predates the final canonical-URL and road illustration adjustments.
- No uncaught application errors or WebGL warnings appeared in the inspected browser logs. This does not prove every random traffic scenario is error-free.
- Pure tests cover all capacities, speed limits, jump landing, clearance restricted to tagged low obstacles, rejected swipe patterns, traffic separation, route order and stationary/non-fatal potholes.
- Viewports checked include 1280 × 720, 390 × 844, 360 × 740 and 844 × 390. A viewport override does not emulate a physical touch device. Actual multi-touch, iPhone/Android device performance and tablet play remain unverified.

Screenshots are in [screenshots/full-upgrade](../screenshots/full-upgrade/). Some capture intermediate findings; the test descriptions above distinguish what was observed from later fixes.

## Files

New in this upgrade (excluding the separately checkpointed pre-existing work):

- `base-ui.css`
- `src/data/GameConfig.js`, `src/data/EasternDistricts.js`
- `src/simulation/systems/JumpSystem.js`, `RoadContactSystem.js`, `TrafficAI.js`
- `src/ui/ScorePoster.js`
- `tests/upgrade.test.cjs`
- `doc/research/full-upgrade-2026-10-07.md`, this report, and screenshot evidence

Modified: `index.html`, `drive-ui.css`, `vehicles.js`, `src/main.js`, `src/assets/props/workshop.js`, `src/rendering/CameraSystem.js`, `src/simulation/systems/PlayerSystem.js`, `CollisionSystem.js`, `MissionSystem.js`.

## Remaining work

1. A deployed public leaderboard and updated versioned Worker validation for the new routes/vehicles. The old server scaffold remains tested but the expanded game intentionally saves scores locally; it does not claim those scores are verified online. No D1 account/database was configured or deployed.
2. Real turnable intersections, traffic priority/turn paths, varied physical road widths and slopes. The retained runner has three straight driving lanes; district landmarks and scenery do not constitute a literal street network.
3. Full map/art research and production refinement for every western, central and eastern neighbourhood. New east-end scenery is an archetype, not a landmark-accurate reconstruction. Hill Station and other requested neighbourhoods have not all been added.
4. Physical-device touch, FPS, memory/endurance and complete-route testing across all vehicles; stronger collision fairness and congestion stress tests. Traffic following is a lightweight heuristic, not a full junction simulation.
5. Further engine extraction (main remains substantial), a fixed timestep if subsequent measurements justify it, and explicit separate state-machine ownership for every menu overlay.
6. Bespoke engine recordings for each vehicle (current differences use playback pitch), deeper progression/upgrade economy, additional poster formats, and professional visual/playability review.

## Git

Fork: `MarkGbla/poda-poda-run`. Original: `zNi0q/poda-poda-run`. The fork only exposed `main`; no differently named Poda development branch existed. Work is on `codex/full-game-upgrade`, based on the fork's main. The user's pre-existing modifications were first preserved as `3e2428e`, separately from research and new feature commits. Draft PR: https://github.com/zNi0q/poda-poda-run/pull/1, targeting the original repository’s `main`. It has not been merged.

Commits: `3e2428e` baseline; `dc3f0b0` research; `ba4e0eb` rules/catalogs; `ab422c0` game/garage/sharing integration; `526d2a2` evidence and report. Later verification-only commits update this evidence.
