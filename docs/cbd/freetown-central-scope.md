# Freetown Central: one west-to-east run

The playable **Freetown Central** route begins at Congo Cross Roundabout, passes Cotton Tree and the downtown CBD streets, continues through PZ and Sani Abacha Street, and ends at Eastern Police Clocktower Roundabout. Its end points are gameplay boundaries, not a claim that Freetown City Council has one legal “Central Freetown” polygon.

## Evidence and street structure

- [Freetown City Council's 2025 agenda](https://fcc.gov.sl/wp-content/uploads/2025/02/FINAL-Transform-Freetown_Transforming-Lives-Development-Agenda.pdf) calls Wilberforce-to-Walpole the *city center* for a regeneration project. Its [fourth-year report](https://fcc.gov.sl/wp-content/uploads/2023/02/Transform-Freetown-4th-Year-Report.pdf) uses a wider CBD project boundary and depicts a cultural parade through Eastern Police, Sani Abacha, Wilberforce, Wallace Johnson and Siaka Stevens. These are project and event extents, not a single city-center boundary.
- The [government's Congo Cross transport assessment](https://mof.gov.sl/wp-content/uploads/2019/04/ESHIA_IRUMP-April-2019.pdf) identifies King Street, Main Motor Road, Wilkinson Road and Old Signal Hill Road as the roundabout approaches. The game's eastbound path exits onto Main Motor Road according to the current OSM one-way tags.
- Eight small extracts from the [official OpenStreetMap API](https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box) cover 8.477–8.497 N and 13.263–13.220 W. `scripts/central/fetch-osm.mjs` caches them; `scripts/central/build-central.py` joins roads by shared OSM node IDs. The builder follows one-way ways and roundabouts only in their mapped direction, rejects disconnected steps, and rejects junction hairpins above 120°. The resulting nodes, coordinates, buildings and stop anchors are in `src/cbd/data/central-data.json`.

The driven street sequence is **Congo Cross Roundabout → Main Motor Road → Faulkner Street → Congo Town Road → Ascension Town Road → Kroo Town Road → Kingtom Bridge → Kroo Town Road → Siaka Stevens Street → Cotton Tree Roundabout → Siaka Stevens Street → Wilberforce Street → Wallace Johnson Street → Walpole Street → Cotton Tree Roundabout → Siaka Stevens Street → Wilberforce Street → PZ Junction → Sani Abacha Street → Eastern Police Clocktower Roundabout**. The downtown one-way loop necessarily returns through Cotton Tree before the eastbound leg; that is a real revisited junction, not a second “CBD mode.”

## Stops, in driven order

| Order | Stop | Anchor |
|---:|---|---|
| 1 | Congo Cross | Roundabout, OSM way 5064456 |
| 2 | Ascension Town Road | OSM way 5064047 |
| 3 | Kingtom Bridge | OSM way 361768252 |
| 4 | Kroo Town Road | OSM way 37438153 |
| 5 | Cotton Tree | Siaka Stevens approach, OSM node 5509521806, about 44 m from the tree; stopping on the roundabout would obstruct the turn |
| 6 | Rokel Commercial Bank | OSM way 177521576 |
| 7 | Wilberforce Street | OSM junction node 21687820 |
| 8 | City Hall | OSM townhall node 13133044444 |
| 9 | Big Market | OSM way 173226206 |
| 10 | Lightfoot Boston Street | OSM junction node 21687837 |
| 11 | Law Courts | OSM way 91664110; stop is on Siaka Stevens after the downtown loop |
| 12 | PZ Junction | Wilberforce/Sani Abacha junction node 21687824 |
| 13 | Sani Abacha Street | OSM way 32840398 |
| 14 | Eastern Police | Clocktower Roundabout, OSM way 5064036 |

These are **gameplay pickup points near mapped places**, not a published list of licensed public-transport stops. Each pickup is on the route centerline in forward order. The Cotton Tree, PZ and Eastern Police signs sit on street approaches rather than inside their junctions. The destination is approximately 5.76 km from Congo Cross. A short mapped continuation around the clocktower and onto Kissy Road lets a player recover a missed final stop; it is not another stop or route. The road model's turning fillets deviate at most about 5 m from the source centerline; the carriageway is wider than the actual streets to accommodate the game's three arcade lanes. Buildings near the playable carriageway may be moved back as reported by the existing CBD fitting diagnostics.
