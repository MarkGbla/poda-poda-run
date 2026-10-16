# 02 — Geographical boundaries

## Sources and what was actually checked

- **Official CBD core.** The project brief cites Freetown City Council's CBD greening competition page as defining the core CBD as the area bounded by **Walpole Street, Wilberforce Street, Siaka Stevens Street and Wallace Johnson Street**. *I did not open that FCC page during this work*; the definition is taken from the brief. What I did verify, against OpenStreetMap (Overpass extract, OSM base 2026-10-15T14:33Z), is that those four streets form one closed, connected block.
- **Road network, footprints, landmarks:** OpenStreetMap (ODbL), fetched with `scripts/cbd/fetch-osm.mjs`.

## Coordinate system

WGS84 (EPSG:4326) source data → local tangent plane centred on the OSM node *The Cotton Tree* (node 3563419693, 8.487148 N, 13.235624 W). Game metres: x east, z south. Details in doc 03.

## Core CBD polygon (verified from OSM junction nodes)

| Corner | OSM node | Lat, lon | Game x, z (m) |
|---|---|---|---|
| Siaka Stevens St × Wilberforce St | 21687821 | 8.489889, −13.232163 | 381.1, −303.1 |
| Wilberforce St × Wallace Johnson St | 21687819 | 8.491814, −13.233503 | 233.5, −516.1 |
| Wallace Johnson St × Walpole St | 21687838 | 8.489241, −13.237150 | −168.0, −231.5 |
| Walpole St × Cotton Tree roundabout | 370887096 | 8.487162, −13.235730 | −11.7, −1.5 |
| Roundabout × Siaka Stevens St (slip) | 4137239735 | 8.487228, −13.235467 | 17.3, −8.9 |

The block is a parallelogram roughly 500 m (NE–SW) by 260–280 m (NW–SE). Its south-west corner is the Cotton Tree roundabout itself (centre 8.487094, −13.235593; mean ring radius 17.4 m from the 21 mapped ring nodes).

## Playable route extent (Phase 1)

The playable route is **the perimeter of that core block**, driven anticlockwise:

Siaka Stevens Street (NE) → Wilberforce Street (NW) → Wallace Johnson Street (SW) → Walpole Street (SE) → three-quarters round the Cotton Tree roundabout → Siaka Stevens Street.

That direction is not a choice of convenience: Walpole Street (way 5032962) and the western part of Wallace Johnson Street's westbound carriageway (way 669957483) are tagged `oneway=yes` in exactly this direction, and the roundabout (way 32934926) circulates anticlockwise. The build script refuses to walk a one-way way backwards.

## In scope

| Road | In the loop | Notes |
|---|---|---|
| Siaka Stevens Street | yes (470 m) | way 33615653 + slip 573743200 |
| Wilberforce Street | yes (255 m) | ways 572463160, 5032940 |
| Wallace Johnson Street | yes (490 m) | ways 669957484, 669957483 (westbound), 5032937 |
| Walpole Street | yes (275 m) | way 5032962 (one-way) |
| Cotton Tree roundabout | yes (71 m driven) | way 32934926 |
| Lamina Sankoh, George, Gloucester, Charlotte, Howe, Rawdon, Lightfoot Boston, Pademba Rd, OAU Drive | as junction stubs only | 70 m of real alignment from each junction is drawn so the openings are visible; they are not drivable |

## Considered and excluded (Phase 1)

| Place | Decision | Reason |
|---|---|---|
| Pultney, Percival, Waterloo, Wellington, Bathurst, Goderich, Sanders, Campbell, Sani Abacha Streets | excluded | Outside the core block; Pultney/Percival/Waterloo/Wellington are one-way pairs that would need route selection (doc 07, option B) |
| St John's Maroon Church | excluded | On Siaka Stevens Street *south-west* of the roundabout (≈160 m along), off the loop |
| State House | excluded | Its OSM footprint (way 173225235) lies more than 70 m from the loop, behind the Law Courts; whether it is visible from Siaka Stevens Street needs a street-level check |
| Government Wharf, King Jimmy | excluded | North of Wallace Johnson Street, toward the water; only the coastline is drawn as backdrop |
| Eastern Police clock tower, Kissy Road, Fourah Bay Road | excluded | ≈1 km east (Clocktower Roundabout way 5064036 at x≈1,032 m) — East End, a future phase |
| Tower Hill / Parliament | excluded | South of the CBD on high ground; would need elevation data |
| East End / West End | excluded | Future phases by brief |

## Building extraction band

Footprints are kept if any vertex is within **70 m** of the surveyed loop centreline (766 buildings). That covers every frontage visible from the carriageway at the game's fog distance.
