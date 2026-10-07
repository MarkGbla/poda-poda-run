# Freetown driving view: implementation benchmark

**Date:** 6 October 2026  
**Input:** User-supplied “Poda-Poda Drive to Lumley Beach.png”; existing west/east/vehicle/people notes; public Freetown references.

The supplied picture is an art-direction reference, not proof that every sign, road, fare, or building shown exists at the pictured location. Its useful traits are the readable rear-view poda, warm light, layered city and hills, street-level trade, and compact driving instruments. The UI uses a restrained dark surface so the place and bus remain central.

The live [Danfo Run interface](https://danfo.horpey.dev/) informed the layout hierarchy and stop prompts, while Poda-Poda Run keeps its own route, colours and vehicle. The road uses a [Three.js standard material](https://threejs.org/manual/pages/materials.html) with high roughness and one shared non-colour detail map. Dynamic shadows remain selective because [shadow-map area and resolution](https://threejs.org/manual/pages/shadows.html) directly affect quality and cost on mobile.

## Direct Danfo Run capture

Captured from the live game on 6 October 2026: [start screen](screenshots/danfo-run-start.png), [unobstructed gameplay](screenshots/danfo-run-gameplay.png). Compare the [current Lumley view](screenshots/poda-poda-lumley-after.png).

The gameplay capture shows a dark, worn asphalt surface with a centre divider, broken white lane marks and sharply alternating black/white curb blocks. Shopfronts have a mix of painted plaster, shutters, signs, flat roofs and low corrugated roofs. Market umbrellas, poles, dense wires and a petrol-station canopy make the roadside readable at speed. The HUD uses a narrow route strip at the top, small passenger and stop cards on the left, speed at the lower left, and compact audio controls at the lower right. These are composition and readability references; Freetown's road arrangement, transport colours and local signs need their own evidence.

## Place cues checked

| Cue | Evidence | Use in game |
|---|---|---|
| Coast beside Lumley Beach Road | [Ministry of Tourism beach guide](https://tourism.gov.sl/beaches/) describes Lumley Beach as a major city beach with bars and restaurants. | Keep the beach and sea visible on the coastal stretch; keep the inland Lumley market junction visually different. |
| Hill and Atlantic backdrop | [Ministry of Tourism Leicester Peak page](https://tourism.gov.sl/sites/) describes views over the Western Area Peninsula Mountains and Atlantic coastline. | Layer irregular, hazy ridges and hillside buildings rather than repeating pointed peaks. |
| Landmarks across the route | [National Tourist Board Western Area guide](https://ntb.gov.sl/western-area/) lists Cotton Tree, Sierra Leone National Museum and Old Fourah Bay College. | Give these hero locations distinct silhouettes instead of scattering them as generic buildings. |
| Cotton Tree context | [Ministry of Tourism cultural heritage guide](https://tourism.gov.sl/cultural-heritage/) places the landmark in the city centre among administrative buildings. | Keep its district composition civic and central rather than beach or market themed. |

The local [west notes](../../research/west-notes.md) and [east notes](../../research/east-notes.md) give more detailed photo observations for each district. The current route is a stylised straight driving corridor; it does not reproduce Freetown's street geometry literally.

## Components updated in this pass

1. **Driving instruments:** earnings, speed, passengers and body condition each have a fixed corner anchor; next stop is centred and progress remains visible. A Three.js orthographic scene now renders those cards, prompts, feedback and touch-control faces after the road scene. DOM nodes retain the text and input hit targets.
2. **Approach guidance:** the stop prompt now includes remaining distance and changes from keep right to slow down to brake.
3. **Touch controls:** horn, brake and gas are large circular targets with separate colour cues.
4. **Road and drainage:** large-scale asphalt wear, repair patches, cracks and worn paint are drawn into reusable textures. A separate non-colour map supplies fine relief and roughness to the road material; shallow channel geometry, grates and subtle chunk decals make the edges less flat.
5. **Vehicle contact and paint:** a soft under-bus shadow, a blue lower panel inspired by the supplied visual, and weathered livery texture improve the player's near-field vehicle without multiplying geometry.
6. **Lumley frontage:** variable setbacks, corrugated shutters and roofs, recessed openings, veranda rails, awnings, clustered goods and reusable weathered plaster maps give the first market district more depth. A single sign atlas varies shop names and colours while retaining one baked texture batch per chunk.
7. **Atmosphere:** coastal haze, warmer light, continuous peninsula ridges and hillside houses replace the previous isolated geometric peaks.

## Acceptance check for a later visual pass

Capture the same stop approach at desktop and portrait sizes. The stop box, traffic and next-stop distance must stay legible while the poda remains visually important. Compare at the same camera position and measure frame time on a representative mobile device. If the material changes reduce visibility or performance, tune them before propagating the pattern to other districts. The supplied picture is a target for visual hierarchy and sense of place, not a promise of photographic rendering from the current procedural geometry.
