# CBD implementation and UX review — 15 October 2026

## Verdict

The repository contains a playable CBD preview, not the completed reconstruction
described by the master brief. Keep the `?cbd` preview flag until the remaining
visual, geographic and device acceptance work is complete.

This review inspected the source, existing research documents, build pipeline,
geographic tests, simulation and UI integration, then ran browser checks and
reviewed fresh screenshots. Existing uncommitted work on `feat/cbd-phase1` was
preserved. Historical claims in documents 01–10 are not new measurements from
this review.

## Requirement assessment

| Area | Assessment | Evidence / limitation |
|---|---|---|
| Architecture audit and research documents | Present | All ten required documents contain substantive content. |
| Geographic data pipeline | Implemented | Cached OSM extraction, shared metric projection, build-time connectivity and one-way checks. |
| Real connected route | Implemented for one loop | Siaka Stevens → Wilberforce → Wallace Johnson → Walpole → Cotton Tree roundabout. Side streets are scenery, not selectable routes. |
| Road geometry | Approximation disclosed | Three uniform lanes, minimum 13 m corner radius, flat terrain. No measured road widths or elevation profile. |
| Official boundary validation | Incomplete | Doc 02 relies on the supplied brief for the FCC definition. Attempting the linked council page during this review returned a verification screen. The OSM loop is not an independently sourced official boundary polygon. |
| Landmark models | Partial | Nine definitions exist, with model-specific confidence notes. Cathedral tower/window pattern, City Hall façade and Big Market form remain unverified. |
| Building placement | Partial | 766 source footprints; corridor fitting deliberately moves some buildings. Heights are estimates. |
| Visual validation | Incomplete | Generated review images exist, but no completed photo/model comparisons or local recognisability feedback. |
| Gameplay integration | Implemented | Road-space simulation mapped onto the geographic route for rendering; corner speed caps and hazard exclusion zones. |
| UI/UX | Fixes and checks in this review | Fixed misleading CBD route controls and added fixed-route driving guidance. See test results below. |
| Scores and backend | Local gameplay scores | Current start flow explicitly does not start online sessions for these vehicle/route rules. Server/API tests do not demonstrate deployed online CBD scoring. No backend or schema changes made. |
| Performance | Partial | Browser renderer metrics available; real Android/iOS performance and sustained device memory remain unverified. |
| Scope and rollback | Implemented | Remove `?cbd` for the original routes. Existing East/West arcade routes predate this work; this is not their geographic reconstruction. |

## Fresh geographic measurements

Using the checked-in dataset and `CbdRoute.create()`:

- Drivable loop: **1,560.41 m**.
- Source polyline: **1,579.54 m**; difference **−19.14 m (−1.21%)**.
- Maximum distance of an original mapped route node from the drivable path:
  **5.39 m**.
- Minimum turn radius: **13 m**.
- Dataset: **766 buildings**, **32 side-street records**, **7 gameplay stops**.
- Corridor fitting moves **76 footprints**, maximum **5.46 m**. This includes
  Big Market (**4.31 m**), Rokel bank (**0.77 m**) and NASSIT (**2.07 m**).
  This conflicts with the brief's strict landmark-placement requirement; widening
  the road to preserve three arcade lanes is an explicit fidelity trade-off.

These measure agreement with the repository's OSM-derived data, not accuracy
against a field survey. The geometric tests do not establish façade accuracy,
real lane widths, elevation, traffic restrictions today, or local recognisability.

## Defects and changes

The CBD title displayed a fixed CBD route while its arrows changed the stored
classic route; the garage displayed that unrelated classic route and its stops.
CBD now hides the ineffective arrows, displays a disabled CBD preview selection,
preserves the classic preference, and explains automatic bends and device-local
scores in the garage and help dialog. The fixed route copy spans the full title
card grid, including on phones; otherwise hiding the arrows squeezed the label
into the first arrow column. A browser assertion checks that the name is not
clipped.

Fresh gameplay screenshots also exposed side-street pavements crossing the
driving lanes. The original mesh builder tested only the middle of a long
pavement strip, missing its end at the main road. The fix subdivides strips into
at most one-metre pieces and omits pieces touching the route corridor. A new
regression test samples the rendered surfaces against the exact route path.

The garage also rendered the geographic scene at the workshop origin, putting
the Cotton Tree model over the vehicle. CBD scenery, panorama and map attribution
are now hidden while the garage is active and restored on exit.

Files changed by this review: `src/main.js`, `src/cbd/CbdMode.js`,
`src/cbd/CbdRoute.js`, `src/cbd/CbdWorld.js`, `scripts/smoke.mjs`,
`tests/cbd-route.test.cjs`, and this report. Other working-tree changes predated
the review.

## Verification record

- Initial `npm test`: **54/54 passed**.
- Initial `npm run build`: **passed**, with the existing large-bundle warning
  (approximately 969 kB JavaScript / 314 kB gzip).
- Initial browser smoke: **29 passed, 2 failed, 0 page errors**. Failures were
  Goals open/close while source edits caused a development reload. A separate
  interactive browser check opened Goals and showed all three progress entries.
  Do not count the initial smoke as a pass.
- Fresh initial CBD frame: **149 draw calls / 93,213 triangles / 30 FPS** in
  headless desktop Chromium. This is one observation, not a performance budget
  certification or a phone measurement.
- Screenshot artifacts: `output/cbd-verification/` (generated, ignored PNGs).

The first expanded smoke run passed **43/43**, including Goals, CBD route
selection consistency, restart and phone-sized touch flows. After the pavement
fix, **55/55 unit tests passed**. The final build passes with the same bundle-size
warning (969.94 kB raw JavaScript / 313.95 kB gzip). The full regression run after
the pavement and garage fixes passed **44/44**, with **zero page errors**.
Its sampled CBD frame was **121 draws / 93,367 triangles / 24 FPS**; screenshot
review confirmed that the crossing pavement and garage obstruction were gone.
The mobile title adjustment was then checked with the focused `--cbd-only` suite:
**21/21 passed, zero page errors**. Its screenshot confirms the full CBD name
and route endpoints remain legible. The sampled CBD frame was 161 draws /
103,559 triangles / 54 FPS, reinforcing that these short samples vary and are
not a sustained hardware benchmark.

Browser coverage is headless Chromium at 1280×800 and a simulated 390×844 phone
viewport at DPR 2. Mobile gas press/release and swipe tests use browser touch
events; pause and Home use touch taps. No physical phone, Safari/Firefox run,
fresh sustained memory test, or uninterrupted full browser lap was completed in
this review. Unit tests include a complete simulated lap. Audio checks establish
play/pause lifecycle, not subjective sound quality. No lint script is configured;
`git diff --check` passed.

## Remaining acceptance work, in priority order

1. Obtain dated, usable street-level references and complete the landmark
   side-by-side comparisons required by the brief. Correct major silhouette and
   façade differences; collect local recognisability feedback.
2. Independently verify the official boundary, real street widths, current traffic
   directions and Cotton Tree site's reference-date condition. Preserve explicit
   uncertainty where evidence is unavailable.
   Resolve the shifted hero landmarks and uniform road width before declaring
   geographically faithful placement.
3. Run sustained sessions on real mid-range Android and iOS hardware, plus Firefox
   and Safari. Record frame-time percentiles, memory and input behaviour.
4. Verify the deployed backend separately before promising online scores. The
   preview currently promises device-local storage only.
5. Improve mobile HUD legibility and street identity based on actual playtesting;
   automated input assertions alone cannot establish that the game is enjoyable.

No deployment, backend rewrite, authentication, schema change or new geographic
zone was introduced. Future zones can reuse the projection/path machinery with
separate datasets and landmark definitions as described in doc 08.
