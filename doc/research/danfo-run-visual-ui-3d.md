# Danfo Run visual study: UI, 3D, light, shadows and implications for Poda-Poda Run

Research date: 6 October 2026. Companion: [gameplay and observable architecture](danfo-run-gameplay-architecture.md).

## Method and evidence limits

I inspected the live [Danfo Run](https://danfo.horpey.dev/) in a desktop browser and at a 390 × 844 portrait viewport. I captured frames of the start scene, garage, first driving seconds, a bus-stop approach, and portrait driving in the task's browser output. I also compared them with Poda-Poda Run's saved [desktop](../../screenshots/07-playing.png), [portrait](../../screenshots/10-mobile.png), [PZ](../../screenshots/east-pz.png), and [title](../../screenshots/11-title-town.png) frames and read the relevant local rendering code. These captures show appearance, not Danfo Run's shader, lighting or camera parameters. Its production source was not available.

The browser's security policy blocked exporting the captured Danfo screenshots through a data URL, so this file records the frames as an inspection log rather than pretending that images were saved here. They remain visible in the task's browser output.

| Captured view | What to look at |
|---|---|
| Start scene | Bus already in the world; warm pale horizon; darker road; UI placed around the bus |
| Garage | Vehicle preview remains in the street; cream panel takes one side; background dims without disappearing |
| Driving start | Off-centre bus, long road view, roadside scale, route strip and message overlay |
| Stop approach | Kerb guidance, traffic silhouettes, yellow zone, worn road and pavement |
| Portrait drive | Bus size relative to road ahead, compact top HUD, thumb-reachable pedals and horn |

## What makes the scene feel more grounded

### 1. Surface detail carries much of the realism

The most striking difference is **texture richness**, not polygon count. Danfo Run's road has dark asphalt variation, cracks, manhole covers, patches and oil marks. Building faces have peeling paint, stains, shutters, window depth cues and signs that look attached to specific shops. Roofs have varied materials; the bus has cargo and readable painted text. A player can keep recognising details as they approach without the street becoming a set of plain coloured boxes.

The live page loaded image groups for facades, decals, road and roof textures, pickups and buses. That supports an inference that texture and decal art is doing substantial visual work; it does not reveal the exact mesh layout. Poda-Poda Run also uses textures and atlases, but many shopfronts and facades are visibly cleaner and more uniformly coloured. Its road texture is generated from a grey fill, small noise squares, one dark patch and lane marks in [`buildTextures`](../../index.html). More random speckle alone would not reproduce the observed effect; **larger-scale material variation** is the missing cue.

For Poda, the right test is a small, reusable Freetown material set: two or three weathered plaster or painted-concrete variants, zinc roofing, shop shutters, patched asphalt and drainage-edge stains. Add a few geographically appropriate ground details—open gutters, laterite shoulders, worn stop paint—using atlases and sparse decals. Avoid copying Lagos shop signs, barrier colours or facade artwork.

### 2. A restrained value range lets the bright objects matter

Danfo Run keeps much of the road and built environment in dark browns, greys and weathered creams. The yellow bus, route markers, market umbrellas, coins and UI then become clear accents. Poda-Poda Run's green hills, blue sky, pastel buildings, cream pavement, coloured shops and bright vehicle compete more evenly for attention. In the [PZ frame](../../screenshots/east-pz.png), there is strong location detail, but many surfaces are similarly bright and clean.

This is an art-direction issue before it is a light-intensity issue. A darker asphalt and a more varied, slightly subdued building base could increase vehicle and hazard visibility while preserving Freetown's colourful shops, vegetation and flag palette. The bus-stop yellow must remain the clearest road marking when it matters.

### 3. Haze and backdrop integrate distant geometry

Danfo Run's view fades toward a pale, warm horizon. Far buildings and traffic lose contrast, and the sky stays relatively quiet. This makes the near road feel deeper and reduces the burden on distant geometry. Poda-Poda Run already uses fog and a sky gradient, but its saturated blue upper sky, light green mountains and sharp near/far colour split give a more toy-like result. Current settings are in [`index.html`](../../index.html): a 70–215 m fog range and a four-stop sky gradient.

For Poda, test a Freetown-specific atmospheric palette: coastal haze on Lumley Beach Road, humid daylight near PZ, and a hill/harbour silhouette near FBC. Keep the fog colour, sky horizon and distant hills coordinated. The aim is depth and local weather, not Danfo Run's exact dusk or grey sky.

### 4. Shadows anchor the bus and roadside objects

The live frames show dark under-vehicle contact, cast shadows on the road, and stronger dark/light separation on facades and street props. The visible result is that objects appear seated on the road instead of floating. I cannot tell from screenshots which Danfo shadows are dynamic, baked into textures, or drawn as decals.

Poda-Poda Run already has one warm directional light, a cool/warm hemisphere light, 1024² PCF soft shadows, shadow-receiving road and pavement, and a player bus that casts a shadow. Those are real features in [`index.html`](../../index.html), so “add shadows” would misdiagnose the gap. A more specific issue is that static district chunks are merged by `bake(c)` with `cast = false`; the merged meshes therefore do not cast dynamic shadows. Many nearby buildings, poles and stalls lack the extra shading that would anchor them. Turning on shadow casting for every merged chunk would be costly and would not automatically create contact darkening at the correct places.

Test a small number of shadow casters near the road and bus stops, plus simple contact shading beneath the bus, traffic, market stalls and large props. Keep the existing adaptive quality fallback: the game already lowers pixel ratio and can disable shadows when frames are slow. [Three.js explains](https://threejs.org/manual/pages/shadows.html) that shadow quality depends on both the shadow-map size and the area covered by the light's shadow camera; expanding the area makes the same map look blockier and shadow passes cost rendering time. These general principles apply, though Poda uses Three.js r128 and any specific new API examples must be checked against that version.

### 5. Small asymmetries create a lived-in street

Danfo Run places uneven cargo, mixed stalls, wires at different heights, varied facades, signs and pedestrians at several depths. The street repeats but does not read as a uniform corridor in the observed frames. Poda has many of these ingredients already—wires, stalls, people, district landmarks—but some roads show repeated building masses and evenly clean lane/footpath edges. The strongest low-cost change is to **vary material, setback and wear** within existing district geometry, then use the current atlas approach to keep draw calls down.

## UI breakdown

| UI feature | Danfo Run observation | Poda-Poda Run opportunity |
|---|---|---|
| Title | Live bus and street fill the screen; game menus float around the vehicle | Current title's large central plate hides much of the town model; test a visible poda in the title world |
| HUD | Score, multiplier, route, passengers and next stop each have compact anchors; alerts appear only when relevant | The large green stop card is clear but dominates the top of portrait; try a compact variant while keeping destination and distance legible |
| Controls | Portrait Brake and Gas are large in the lower thumb area; horn is nearby; swipe steering leaves the road free | Poda already has the same core touch actions; test button size and the space available to steer on smaller phones |
| Stop guidance | Contextual text adds direction and metres as the box approaches | Poda's hint already changes by lane; add a clearly timed distance cue only if testing shows players miss stops |
| Menus | Garage/Route/Leaderboard panels sit over the moving street and bus | Reuse the existing 3D scene for a game shell, while keeping menus simpler than Danfo's current feature set |
| Results | Score and ticket occupy a clear focal column; stats and missions remain visible | Poda already has a result card; add a completed-shift outcome and distinct skill stats only after run rules are set |

Danfo Run uses oversized comic display type, cream panels, black outlines, rounded corners, yellow buttons and dark translucent HUD chips. Poda has an established Bungee/Outfit and Salone-green/cream language. Its UI can adopt Danfo's *spatial hierarchy*—clear primary action, persistent vehicle, compact HUD, short alerts—without adopting the same typography, panel shapes or icons. Danfo's smallest desktop/portrait HUD labels are hard to read in some captures; increasing information density would be a poor direct copy.

## Why the camera contributes to apparent realism

The bus is visible as a physical object and the road extends far enough for the player to read traffic. At driving start, the bus sits low and somewhat off-centre. In portrait, it occupies less vertical space than Poda's bus in the saved mobile frame, leaving more road ahead. The camera also shows the bus's roof cargo and apprentice, so vehicle details earn their art budget.

Poda's camera is tied directly to lane position each frame: `camera.position.x = S.x * 0.65` and `lookAt.x = S.x * 0.8`, with a 60° desktop or 74° portrait base field of view, extra FOV under Gas, and impact shake. That is already functional. Before changing it, compare three controlled screenshots and short playtests on the same route section: current view; a modest rear three-quarter offset; and that offset with a slightly wider FOV. Record bus visibility, obstacle reaction time, stop-box visibility and motion comfort. A visual match to Danfo is not sufficient if a player cannot brake accurately.

## Recommended visual experiments for Poda-Poda Run

1. **Material prototype in one district.** Choose PZ or Abacha Street and make one weathered facade atlas, one zinc/roof variant and a few ground decals. Compare with the current scene at identical camera and time of day.
2. **Atmosphere prototype.** Tune sky, fog and distant geometry together for coastal Freetown daylight. Keep colour and contrast consistent from road to hills.
3. **Shadow placement prototype.** Keep the current sun and shadow map. Add selective roadside shadow casters and a subtle bus contact shadow; measure frame time on a portrait mobile device before extending it.
4. **Camera and HUD comparison.** Capture the first stop at desktop and portrait for each camera variant. Use the stop box as the key readability test.
5. **Title composition.** Put the player's poda in the scene before play and reduce the area covered by title UI. The current town diorama can still establish Freetown behind it.

These are visual tests, not instructions to change every district at once. The present renderer already bakes static meshes, caches materials/atlases and adapts pixel ratio. New textures and shadows should preserve those safeguards.

## Sources

- Live visual inspection and captures: https://danfo.horpey.dev/
- Poda-Poda Run source and frames linked above.
- Three.js official shadow guidance: https://threejs.org/manual/pages/shadows.html
- Three.js colour-management guidance for future renderer work: https://threejs.org/manual/pages/color-management.html
