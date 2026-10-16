# 04 — Road and junction inventory

All lengths are measured on projected OSM geometry (doc 03). "Path" values are on the drivable, filleted path the game uses; "surveyed" on the raw OSM centreline.

## Loop streets

| Street | OSM ways (driving order) | Class (OSM) | One-way | Surface tag | Path length | Building-to-building corridor (measured, see below) |
|---|---|---|---|---|---|---|
| Siaka Stevens Street | 573743200 (slip), 33615653 | primary | slip only | asphalt / untagged | 470 m | median 19.4 m (p10 16.6) |
| Wilberforce Street | 572463160, 5032940 | secondary / tertiary | no | asphalt | 255 m | median 23.1 m (p10 18.5) |
| Wallace Johnson Street | 669957484, 669957483, 5032937 | tertiary | westbound section yes | asphalt | 490 m | median 26.8 m (p10 12.6) |
| Walpole Street | 5032962 | unclassified | yes | asphalt | 275 m | median 22.6 m (p10 14.2) |
| Cotton Tree roundabout | 32934926 | primary | yes (anticlockwise) | asphalt | 71 m driven of ~109 m | ring radius 17.4 m |
| **Total** | | | | | **1,560 m path / 1,580 m surveyed** | |

**Carriageway width.** No loop way carries `width` or `lanes` tags (Sanders Street, off the loop, is the only nearby way with `lanes=2`). Width is therefore *not* claimed. As a proxy, the corridor between building footprints either side was sampled every 4 m on straights (`building-to-building`, raw OSM footprints): its median is 19–27 m and its 10th percentile 12.6–18.5 m. The game keeps its own three 3.4 m lanes (10.9 m carriageway) plus drain and footway: a 16.9 m corridor (17.5 m with margin). That fits within the median corridor on every street; at the narrower points footprints are moved back (below).

## Turns (drivable path)

| Turn | At path s | Angle | Min radius | Corner speed cap |
|---|---|---|---|---|
| Siaka Stevens → Wilberforce | 451–471 m | 89° left | 13.0 m | 33 km/h |
| Wilberforce → Wallace Johnson | 707–728 m | 91° left | 13.0 m | 33 km/h |
| Wallace Johnson dual-carriageway split | 913–923 m | 43° right (then 32° left) | 13.0 m | 33 km/h |
| Wallace Johnson → Walpole | 1,196–1,217 m | 90° left | 13.0 m | 33 km/h |
| Cotton Tree roundabout → Siaka Stevens | 1,487–1,544 m | 191° left (net, with entry/exit deflections) | 13.0 m | 40 km/h |

## Junctions along the loop (OSM nodes shared with other named streets)

| s (m) | OSM node | Meets |
|---|---|---|
| 16 | 5509521797 | Siaka Stevens Street (roundabout slips) |
| 40 | 21687836 | Lamina Sankoh Street |
| 116 | 21687834 | George Street |
| 187 | 21687833 | Gloucester Street |
| 253 | 21687812 | Charlotte Street |
| 324 | 21687813 | Howe Street |
| 391 | 21687814 | Rawdon Street |
| 461 | 21687821 | **Wilberforce Street** |
| 624 | 21687820 | Lightfoot Boston Street |
| 785 | 21687818 | Rawdon Street |
| 856 | 21687817 | Howe Street |
| 918 / 1,076 | 6274224064 / 6274224065 | Wallace Johnson Street (eastbound carriageway) |
| 927 | 6274224053 | Charlotte Street |
| 998 | 6274224050 | Gloucester Street |
| 1,068 | 21687831 | George Street |
| 1,137 | 21687839 | Lamina Sankoh Street |
| 1,295 | 21687837 | Lightfoot Boston Street |
| 1,485–1,534 | various | Siaka Stevens Street (SW), Pademba Road, OAU Drive (roundabout arms) |

The regular cross streets (George, Gloucester, Charlotte, Howe, Rawdon) meet both Siaka Stevens and Wallace Johnson streets, which is the 1790s grid the city was laid out on. Each is drawn as a 70 m stub of its real alignment with a gap in the loop's footway.

## From polyline to drivable path (`src/cbd/RoadPath.js`)

1. Drop points closer than 0.5 m.
2. Where a segment is too short to hold two 13 m-radius fillets (mapped slip-road and kerb nodes), replace its two end vertices by the intersection of the neighbouring segments. 55 surveyed nodes become 50 path vertices.
3. Replace each vertex with a circular arc: the radius that keeps the arc within 2.5 m of the vertex, clamped to 13–90 m and to what the neighbouring segments allow. **No spline smoothing** — straight mapped segments stay straight, and the curve between them is the tightest drivable arc.
4. Arc-length parametrise; `frameAt(s)` gives position, unit tangent and curvature.

Why 13 m: the game's road is 10.9 m wide; the inside kerb of a 13 m centreline arc is at 7.5 m radius, the footway edge at 4.6 m, so lane offsets never fold over. Real kerb radii at these corners are probably smaller; the vehicle path through a 90° city corner is not.

## Measured deviation from the surveyed centreline

| Measure | Value |
|---|---|
| Surveyed nodes within 1 m of the path | 48 of 55 |
| Median node-to-path distance | 0.11 m |
| 90th percentile | 2.12 m |
| Worst | 5.39 m (a 90° street-corner node) |
| Path vs surveyed length | 1,560 m vs 1,580 m (−1.2 %; corners are cut) |
| Minimum radius | 13.0 m everywhere |
| Heading continuity | max tangent change 0.05 per 0.5 m (no kinks) |

The worst values are at the four 90° corners: a vehicle turning a corner does not drive over the junction's centre node, so that is the expected shape of the error, not a misplacement. Tests assert < 6 m.

## Buildings and the gameplay corridor

Footprints that would stand inside the corridor (half-width 8.75 m from the path) are moved straight back from the road; nothing is deleted or reshaped.

| Measure | Value |
|---|---|
| Footprints in the band | 766 |
| Moved | 76 (9.9 %) |
| Median move | 2.8 m |
| Largest move | 5.5 m |
| Dropped | 0 |

Tests check that no fitted footprint edge reaches the carriageway and that < 15 % move by < 8 m.

## Not represented

- Elevation and gradients (doc 03).
- Real lane markings, parking, one-way signage: the game's own three-lane texture is used.
- Drainage: the game's standard drain channel is drawn at the kerb on every street; real drain positions were not surveyed.
- Turn restrictions other than one-way tags.
