# Poda-Poda Run — Architecture Assessment

**Status:** Review and recommendation  
**Scope:** Proposed technical architecture, current game, and local research  
**Implementation:** No code changes

## Overall assessment

The proposed architecture is a good direction for Poda-Poda Run. Its strongest decisions are to keep Three.js as the renderer, separate game rules from rendering, retain the existing 30 m recycled world chunks, and keep the interface in HTML and CSS. Adopt these changes gradually. The current game already has valuable Freetown scenery, vehicle and people models, bus-stop interactions, instanced coins, and mobile quality adjustment.

The immediate priority is to make the transport journey satisfying from start to finish. The proposed file structure and backend become more useful once that gameplay contract is clear.

## What the current game already does

- `index.html` defines a Goderich-to-FBC route, three-lane driving, traffic, collisions, bus stops, boarding, drop-off, fares, a HUD, and mobile controls.
- `districts-west.js` and `districts-east.js` supply place-specific scenery through the `window.PODA` plug-in contract.
- `vehicles.js` and `people.js` provide detailed Freetown models and visual variety.
- The game recycles 30 m scenery chunks, merges static geometry, instances coins, and adjusts pixel ratio according to frame time.
- A local best is stored in the browser. There is currently no public leaderboard, mission system, or route-completion result.

These are foundations to preserve during migration.

## Decisions to make before restructuring

### 1. Define a completed run

The route lists Goderich through FBC, but `stopName()` wraps around to the beginning after FBC. Decide whether reaching FBC completes a scored shift. A separate endless mode can be considered later. This decision affects results, missions, score comparisons, and server validation.

The route diagram in the proposed architecture omits Chapter One, which is present in the current route. Keep one authoritative route definition. The west research notes also explain why Lumley belongs before Lumley Beach Road; the current game already uses that corrected order.

### 2. Make the first stop clear and fair

The existing stop has a yellow kerb box, speed and lane checks, boarding, drop-off, a fare, and a binary perfect bonus. Test the first stop on a portrait phone: can a new player see the zone, move right, brake in time, and understand why a stop was missed?

Improve approach guidance and miss feedback before adding a more complex grading formula. Once the interaction is reliable, a small set of grades such as perfect, good, rough, and missed could reward accuracy. The Danfo Run research did not verify that game's actual stop thresholds, so they should not be copied as facts.

### 3. Define earnings and score separately

Currently fares and road coins both increase `S.cash`, and cash determines the personal best. If Leones represent transport earnings, keep them distinct from a competitive skill score. A score could reward passengers delivered, stop quality, safe driving, and finishing the shift. Define and explain those rules before building missions or a leaderboard.

## How the research can improve this game

The Danfo Run study identifies a useful rhythm: immediate traffic decisions, named stops during a run, then goals across multiple runs. Poda-Poda Run already has the first two layers. It can build the later layers after route completion and scoring are stable.

The visual research argues for Freetown-specific detail rather than copying Lagos's palette or road design. The current west and east district plug-ins already use recognizable places. District data could later influence traffic mix, crossing activity, stop approaches, and ambience as well as scenery. Keep those differences readable and fair. The current straight three-lane road presents bridges, junctions, and roundabouts as set pieces rather than literal road geometry.

The vehicle and people research supports the existing Sprinter poda-poda, kekehs, okadas, taxis, Waka Fine bus, clothing, head loads, and market crowds. A bus-visible title and small garage could reuse these models. Start with paint and slogan choices and local persistence before adding a large upgrade economy.

The Danfo Run research describes observable behavior and first-party disclosures, not recovered source code. Its renderer internals, exact scoring, collision rules, and server validation remain unknown. Use its player experience as a reference without treating inferred internals as a blueprint.

## How to apply the proposed architecture

1. **Establish the run contract and state transitions.** Represent title, playing, paused, route complete, and game over explicitly. A pause state is useful for mobile interruptions.
2. **Extract pure gameplay rules.** Route progress, passenger destinations, stop grading, and scoring are the best first candidates because they can be checked without Three.js.
3. **Move simulation away from meshes.** Today the main update function handles speed, player and obstacle transforms, collisions, stops, camera, and HUD. Move vehicle and traffic state into plain data, then let Three.js synchronize its objects from that state. A fixed simulation timestep becomes practical at this boundary.
4. **Preserve rendering optimizations.** Keep chunk recycling, geometry caching and merging, instanced coins, and adaptive pixel ratio. Measure performance before adding broader object pools or more quality settings.
5. **Add a small event interface where systems meet.** Stop served, passenger dropped, collision, and route complete are useful events for score, HUD, audio, and missions. Avoid introducing a large ECS framework or a broad event bus before those boundaries exist.
6. **Add progression after the shift works.** Start with a few missions based on existing actions, then a small garage. Keep geographic stops distinct from progression milestones; Danfo Run's route stamps appear to be goals, not bus stops.
7. **Add the backend after score rules settle.** Cloudflare Workers and D1 are a reasonable proposed stack for a small leaderboard, but the server validation contract needs precision. A server cannot independently calculate an official score from client-submitted totals alone. Define the run data, plausible limits, versioning, and the level of trust the leaderboard needs.

The proposed Vite and ES-module migration can happen in stages around these boundaries. It does not require rewriting every district and model plug-in at once.

## Recommended order

**Finishable shift → portrait stop playtest and feedback → earnings and score rules → gameplay-system extraction → missions and garage → backend and leaderboard.**

This order gives each architecture change a concrete gameplay purpose and preserves the working game throughout migration.

## Source material reviewed

- Proposed *Poda-Poda Run — Technical Architecture* supplied with the request.
- [`doc/research/danfo-run-gameplay-architecture.md`](research/danfo-run-gameplay-architecture.md).
- `research/lagos-run-visuals.md`, `research/west-notes.md`, `research/east-notes.md`, `research/people-notes.md`, and `research/vehicles-notes.md`.
- `index.html`, `PLUGINS.md`, `districts-west.js`, `districts-east.js`, `vehicles.js`, and `people.js`.
