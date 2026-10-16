# 05 — Landmark inventory

Every landmark's **position and footprint** come from OpenStreetMap; no landmark has been moved to make it more visible. Massing, colour and details are only as good as the sources listed, and the confidence column says so. "Shift" is the corridor setback applied (doc 04).

Reference date for the reconstruction: **2025–2026, present day**. In particular the Cotton Tree is shown as it stands after its collapse, not as the historic tree.

| # | Landmark | OSM feature | Lat, lon (OSM) | Tier | Shift | What is modelled | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | **Cotton Tree site** | node 3563419693 (`natural=tree`, wikidata Q602200) | 8.487148, −13.235624 | 1 | 0 | Charred trunk spires (4, 7–12 m), green regrowth, flag wrap in green/white/blue bands, stepped dark circular plinth, black-and-white kerb, in the roundabout island | Position: OSM. Form: Wikimedia Commons photo (2025) and news photos described in `research/east-notes.md`. Spire heights estimated. |
| 2 | **Law Courts** (Supreme Court Building) | way 91664110 (`amenity=courthouse`) | 8.487411, −13.234980 | 1 | 0 | Footprint, cream walls, two storeys (≈10 m, estimated), red hipped roof, colonnade and steps on the façade facing Siaka Stevens Street | Footprint: OSM. Cream/columns/red roof: press photos (DW, 2023) per `research/east-notes.md`; Lonely Planet places it "immediately east of the Cotton Tree" (matches OSM). Column count and height estimated. |
| 3 | **National Museum** | node 3563419694 (`tourism=museum`); footprint = unnamed way 307244436 that contains the node | 8.486769, −13.235903 | 2 | 0 | Small cream single-storey block, red hipped roof | Footprint attribution inferred (node inside it). Form low confidence. |
| 4 | **NASSIT House** | node 3342047993/4985984023 inside unnamed way 306848898 | 8.487164, −13.235920 | 2 | 2.0 m | White multi-storey block (9 storeys, estimated) with a vertical blue stripe on the road face | Stripe and colour from photos (Al Jazeera aerial, 2023, per research notes). Storeys estimated. OSM also has a *different* way named "Nassit House" (306777434) on Wallace Johnson Street — unresolved which building locals mean; the roundabout one is modelled because the photo shows it at the Cotton Tree. |
| 5 | **Sierra Leone Commercial Bank** | way 177521577 | 8.488062, −13.235006 | 1 | 0 | Sand-coloured tower, 12 storeys, vertical concrete ribs, dark ground floor | "About 12 storeys", ribbed, tan: Getty/Alamy photos cited in research notes. Approximate. |
| 6 | **Rokel Commercial Bank** | way 177521576 (`amenity=bank`) | 8.488753, −13.234054 | 1 | 0.7 m | White block, blue brise-soleil grid on the road face; 6 storeys (estimated) | Colour and grid: Alamy photo cited in research notes. Storeys estimated. |
| 7 | **Freetown City Hall** | node 13133044444 (`amenity=townhall`); footprints = unnamed ways 1430383234 + 1430383235 beside it | 8.490401, −13.235251 | 1 | 0 | Two 15-storey towers on those footprints, neutral grey, windowed | **15 storeys, "twin building", 17 Wallace Johnson Street, rebuilt on the site of the hall burnt in 1999: Freetown City Council.** Footprint attribution inferred (two adjacent ≈1,050 m² footprints at the node; nothing else nearby is that size). Colour and façade not verified. |
| 8 | **St George's Cathedral** | way 177521574 (`denomination=anglican`, wikidata Q7588097) | 8.490005, −13.235697 | 1 | 0 | Footprint, stone-coloured walls (≈9 m), steep roof, tall window bays | Built 1817–1828 of stone (Wikipedia/travel sources). **Tower and window pattern not modelled — no verified reference was found**; this is the most incomplete Tier 1 model. |
| 9 | **Big Market** | way 173226206 (`amenity=marketplace`) | 8.489821, −13.236527 | 1 | 4.3 m | Footprint, two storeys (estimated), arched openings on the road face, vendors with umbrellas on Wallace Johnson Street either side | On Wallace Johnson Street (tourism listings; OSM). Storeys, colour, façade **not verified**. A Vikidia claim about Portuguese origins and a 1999 destruction was found but not corroborated, so it is not used. |

## Considered, not modelled in Phase 1

| Landmark | Why not |
|---|---|
| St John's Maroon Church (way 177518788) | Off the loop (Siaka Stevens Street south-west of the roundabout). |
| State House (way 173225235) | Outside the 70 m footprint band; visibility from the loop unverified. |
| Wesley Methodist Church (way 173226205), Treasury Building (way 173226208), SALPOST (ways 177521581, 1430383320/1) | Inside the core block, not on a loop frontage at sufficient prominence to justify Tier 2 without photographs; drawn as ordinary footprints where in the band. |
| Eastern Police clock tower | East End, future phase. |

## Ordinary buildings (Tier 3)

All other footprints are extruded with: shop bays on any ground-floor face that looks onto the loop (8 original shopfront designs with invented business names — no real brands), louvred windows on upper floors, an estimated storey count, and either a flat roof with parapet and water tank or (for low buildings) a corrugated hipped roof. Colours vary per building from a palette of the cream, sand, pale blue and ochre renders visible in CBD street photography.

## Validation status

Side-by-side comparison with reference photographs (brief §15.2) has **not** been completed: the reference images are on third-party sites whose licences don't permit copying them into the repository, and no locally taken photographs were available. The deterministic viewpoints in doc 06 are set up so that a reviewer with the photos can do the comparison; until then, visual accuracy is unverified beyond the descriptions above.
