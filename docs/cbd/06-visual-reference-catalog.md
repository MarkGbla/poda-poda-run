# 06 — Visual reference catalog and review pack

## References

Nothing from these sources is copied into the game. They are links, consulted for descriptions; image licences belong to their owners. Items marked *(research notes)* were collected earlier in this repository's history (`research/east-notes.md`); I re-used those notes and did not re-open every image in this session.

| Subject | Source | Date | What it shows / was used for |
|---|---|---|---|
| Cotton Tree after collapse | https://commons.wikimedia.org/wiki/File:Cotton_Tree_with_stump_and_Sierra_Leonean_flag.jpg *(research notes)* | 2025 | Charred spires, flag wrap, plinth |
| Cotton Tree regrowth | https://en.wikipedia.org/wiki/Cotton_Tree_(Sierra_Leone) *(research notes)* | 2024 | Regrowth note |
| Cotton Tree collapse, surroundings | https://www.aljazeera.com/news/2023/5/25/storm-fells-symbolic-400-year-old-cotton-tree-in-sierra-leone *(research notes)* | 2023 | Roundabout, NASSIT House |
| Law Courts behind the tree | https://www.dw.com/en/sierra-leones-iconic-cotton-tree-destroyed-by-storm/a-65736127 *(research notes)* | 2023 | Cream colonial block, columns, red roof |
| Cotton Tree conservation | https://www.africell.com/?p=1517 (search result) | 2024–25 | Kew study of the stump; no monument found |
| Siaka Stevens Street | https://commons.wikimedia.org/wiki/File:Siaka_Stevens_Street,_Freetown.jpg *(research notes)* | — | 3–6 storey frontage, shop boards |
| Rokel bank, street signpost | https://www.alamy.com/stock-photo/siaka-stevens-street-freetown-sierra.html *(research notes)* | — | White/blue brise-soleil |
| SLCB tower | https://www.gettyimages.com/photos/siaka-stevens *(research notes)* | — | Tan ribbed tower |
| Street tour video | https://www.youtube.com/watch?v=j_BT2-NFLjE *(research notes)* | 2023 | Street density, kekeh/taxi mix |
| City Hall | https://fcc.gov.sl/press-release-new-city-hall-opening/ ; https://fcc.gov.sl/?p=2153 ; https://thesierraleonetelegraph.com/?p=31665 | 2018–2021 | 15 storeys, twin building, Wallace Johnson Street, rebuilt on 1999 site |
| St George's Cathedral | https://en.wikipedia.org/wiki/St._George%27s_Cathedral,_Freetown | — | 1817–1828, stone |
| Big Market | https://tourismsierraleone.com/where-to-go/freetown/ ; https://en.vikidia.org/wiki/Sierra_Leone_Big_Market (uncorroborated) | — | Location on Wallace Johnson Street |
| Law Courts | https://www.lonelyplanet.com/pois/457735 ; https://sierra-leone.org/Speeches/kabbah-040402.html | 2002– | "Immediately east of the Cotton Tree", restored after war damage, reopened 2002 |
| Street grid | https://transnationalarchitecture.group/2026/02/28/new-monograph-freetown-an-architectural-gazetteer/ | 2026 | Grid laid out by Sierra Leone Company surveyors in the 1790s |

**Gaps.** No Mapillary sequences, Street View or local photographs were inspected in this session. That is the single biggest limitation on visual fidelity, and the first thing to fix (doc 08).

## Visual observations used for the street environment

- Continuous 2–6 storey frontage on Siaka Stevens and Wallace Johnson streets; ground floors are shops with painted boards and roller shutters *(research notes; Siaka Stevens Street photo)*.
- Louvred windows, rain staining under sills, flat roofs with water tanks; corrugated roofs on low buildings *(general CBD photography in research notes)*.
- Civic quarter around the Cotton Tree: lower, set-back colonial buildings and trees; market activity concentrated near Big Market on Wallace Johnson Street — hence vendors only there.
- 303 trees are placed exactly where OSM mappers recorded them; species and canopy size are generic.

## Review pack (deterministic viewpoints)

Generate: `npm run dev`, then `npm run cbd:views -- --url=http://localhost:5173/ --out=docs/cbd/img`.
Each view is `?cbd&view=x,z,yaw,height` (plan metres from the Cotton Tree node, yaw clockwise from north) and is taken from points on the drivable path, so a reviewer can stand at the same place with a phone.

| Image | Where (lat, lon of camera) | Looking | Shows |
|---|---|---|---|
| `img/01-siaka-stevens-law-courts.jpg` | 8.487594, −13.235233 | NE along Siaka Stevens St | Law Courts colonnade (right), SLCB tower (left) |
| `img/02-siaka-stevens-rokel.jpg` | 8.488262, −13.234379 | NE | Mid Siaka Stevens St, cross-street openings |
| `img/03-corner-wilberforce.jpg` | 8.489659, −13.232427 | NE | Approach to the Wilberforce St corner |
| `img/04-wilberforce-to-wallace-johnson.jpg` | 8.491621, −13.233344 | NW | Approach to Wallace Johnson St |
| `img/05-wallace-johnson-city-hall.jpg` | 8.490866, −13.234886 | SW | City Hall twin towers, dual-carriageway S-bend |
| `img/06-wallace-johnson-big-market.jpg` | 8.489955, −13.236166 | SW | Big Market frontage and vendors |
| `img/07-walpole.jpg` | 8.489046, −13.237012 | SE down Walpole St | |
| `img/08-roundabout-cotton-tree.jpg` | 8.487241, −13.235804 | SE | Roundabout, Cotton Tree site, NASSIT House |
| `img/09-cotton-tree-close.jpg` | 8.487013, −13.235685 | NE, eye level | Cotton Tree site |
| `img/10-city-hall-street-level.jpg` | 8.490543, −13.235480 | W, eye level | Wallace Johnson St at City Hall |

### For local reviewers (brief §15.3)

Show each image **without its caption** and ask: Where is this? What is wrong or missing? Which building did you expect here? Would you know which way to turn next? Record answers against the image name in an issue. Local feedback guides fixes, but positions are only changed on mapped or photographic evidence.
