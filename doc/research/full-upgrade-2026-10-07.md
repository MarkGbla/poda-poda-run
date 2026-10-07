# Full upgrade research and engine audit — 7 October 2026

## Evidence reviewed before changes

Read the existing western/eastern/vehicle/people notes and prior Danfo studies, then inspected the repository's main loop, state machine, inputs, camera, traffic pool, collisions, passengers, stop rules, district plug-ins, audio, renderer budgets, UI and server validation. Existing uncommitted work was preserved in its own baseline commit.

Live Danfo Run inspection: https://danfo.horpey.dev/ redirects to https://danforun.com/. The current menu exposes area selection, a prominent driving action, garage, progression, leaders, coins and events around an actual 3D bus. Its garage uses paint/sticker/horn/upgrade tabs. The live page was inspected, including menu screenshot and garage controls; prior repository studies document gameplay and end-screen observations. No exact camera/physics constants or source-code claims are inferred. Design decision: keep our Salone palette, fewer menu actions, actual vehicle preview and a single start-shift action. Do not reproduce its assets or branding.

## Geographic and transport evidence

- Government of Sierra Leone / World Bank, 2019 IRUMP environmental framework, sections 2.5 and Figure 1: https://documents1.worldbank.org/curated/en/298271553847395413/pdf/Environmental-and-Social-Management-Framework.pdf . Lumley is a western transport/commercial hub constrained by hills and streams; Congo Cross has busy interchange and pedestrian activity; Bai Bureh/Ferry Road connects the Kissy ferry district and informal trade. This is historical evidence, not a claim about current signal operation. The PDF map screenshot endpoint was requested, but the tool did not expose a viewable image in this session.
- World Bank IRUMP project report: https://documents1.worldbank.org/curated/en/099062124132032074/pdf/P1643531135e4a06419b9111cc68a94715f.pdf . Waka Fine introduced 50 buses in January 2024 on two pilot corridors. In-game capacity 30 is a requested gameplay value, not a claim about the real fleet's rated capacity.
- Sierra Leone Tourism: https://tourismsierraleone.com/attractions/cotton-tree/ . Cotton Tree fell in May 2023; retain the existing stump/regrowth scene instead of inventing an intact contemporary tree.
- Eastern traffic reporting: https://a-zsl.com/aig-brima-kanneh-champions-coordinated-traffic-reforms/ . Reports container queues between Shell New Road and Fourah Bay Road serving the quay. Design implication: eastern freight/warehouse scenery and slow leading vehicles.
- Existing local research: `research/west-notes.md`, `research/east-notes.md`, `research/vehicles-notes.md`, `research/people-notes.md`; their cited imagery informed the original district assets. Those notes are prior research, not imagery newly verified this session.

No Google Earth or Street View imagery was accessible/inspected in this session. Exact turn geometry, street widths, IMATT/Hill Station junction configuration and current building-by-building appearance are not established. New east-end assets are explicitly corridor archetypes. All route choices are condensed arcade itineraries, not navigation directions or official transit schedules. Western uses Goderich → Lumley → beach → Aberdeen → Congo Cross; central continues to Cotton Tree, PZ, Abacha and Eastern Police; eastern continues through Cline Town, Kissy, Wellington and Calaba Town. Cross-city joins those experiences. Existing Wilberforce, IMATT and FBC assets remain available through district previews.

## Audit findings and decisions

- Potholes followed the generic collision/debris path, allowing road surfaces to fly away and trigger fatal double impacts. Give them an independent non-fatal, once-per-pass response.
- Player dimensions, acceleration and capacity were hardcoded. A shared vehicle catalog now supplies movement, camera, collision and passengers.
- Route helpers were bound to a single legacy route. Runtime routes now come from an immutable catalog; preserve the legacy server rules until its versioned contract is migrated.
- Random lane weaving ignored neighbours. Introduce headway checks, reserved destination lanes, braking and vehicle-specific decisions; keep fair spawn separation.
- The garage orbit could enter its side walls. Open the sides and move the rear wall away from the large bus camera.
- Gesture inputs had no duration or pointer identity. Add primary-pointer capture, cancellation and vertical thresholds; reject jump gestures begun while using pedals.
- Body-wide `touch-action:none` prevented native scrolling in long mobile panels. Restrict gesture capture to the canvas and driving controls.
- Reuse geometry caches, baked scenery, instanced coins, traffic pooling and adaptive resolution. No new rendering or physics dependency.
- The Worker validator assumes a 13-stop/14-seat game. Do not label new local scores as server-verified. Online deployment and a new versioned validator are still required.
