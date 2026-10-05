# West Freetown districts — visual research notes

Photos saved to `research/refs/<slug>/` (reference only, not shipped).

## Verified route order (important finding)

Real geography, west to east: **Goderich** (fishing town, south of Lumley junction)
→ **Lumley** (the roundabout/market junction — Spur Rd/Wilkinson Rd/Lumley Beach Rd
meet here) → **Lumley Beach Road** (runs north from the Lumley junction along the
coast) → **Chapter One** (a specific venue AT 30 Lumley Beach Road, so sits inside
that stretch) → **Aberdeen** (at the north end of the beach road, across Aberdeen
Bridge/creek) → back inland via Wilkinson Road through **Wilberforce** → **IMATT**
(a junction in the Wilberforce/Hill Station hills, named after the old military
compound) → **Congo Cross**.

Source: FreetownCityTV/Facebook posts on Wilkinson Road ("from Lumley to Congo
Cross"), a YouTube drive "Lumley Beach → Lumley Market → Juba → Goderich", and the
Wilberforce Wikipedia page (barracks "crossroad connecting to Lumley, Hill Station,
Congo Cross").

**The engine's current order (Goderich → Lumley Beach Road → Chapter One →
Aberdeen → Lumley → Wilberforce → IMATT) has "Lumley" in the wrong slot** — the
junction/market geographically comes *before* Lumley Beach Road/Chapter One, not
after Aberdeen. Flagged in the final report as an engine-data change, not made here
(route order lives in `index.html`'s `DATA.route`, out of scope for this file).

## Goderich
Fishing town on a tidal creek/mangrove inlet. Wooden canoes painted in bright
hand-lettered bands (red/yellow/green/white/blue, Sierra-Leone-flag colours),
painted names ("GOD TIME", "M. CONTEH"), small masts with pennant flags, piled
nets. Mangrove bushes at the waterline, brownish-green murky water. Simple
board-and-zinc houses, smokehouses (small huts, often with visible smoke).
Refs: `refs/goderich/1-4` (Flickr/Mongabay/Instagram, fishing canoes at Goderich
beach and a mangrove creek with canoes).

## Lumley Beach Road
Long straight coast road, Atlantic on one side (west), low beachfront buildings/
bars on the other. Tall coconut palms lining the kerb, sandy/littered verge
between road and beach, pale turquoise-grey sea with visible surf line, overcast-
pale sky common in photos. Refs: `refs/lumley-beach-road/1-4` (Getty/Alamy/
TripAdvisor — repeated palm-row + straight beach + low surf).

## Chapter One
Confirmed: NOT a neighbourhood, it's a specific beach venue — "Chapter One: Nile
Sierra Leone's premier lifestyle club", 30 Lumley Beach Road. A nightclub +
"Ocean Terrace" restaurant + "Cloud Nine" rooftop bar + pool/beach club, all in one
multi-storey building. Render shows a charcoal/dark-grey and timber-tone building,
rooftop with white sail-shade canopies, a gold crown-and-shield "CHAPTER ONE" lit
sign, and a large teal infinity pool with white loungers on a wood deck right on
the sand, palms either side. Refs: `refs/chapter-one/1-4` (official site renders +
pool photo).

## Aberdeen
Aberdeen Bridge: a plain concrete beam bridge (multiple square piers) crossing
Aberdeen Creek, pedestrian railings, lamp posts, the "Man of War Bay"/creek visible
underneath with small boats, Murray Town's colourful hillside houses as backdrop
(cream, yellow, green roofs, a few taller rendered 3–4 storey buildings). Low tide
exposes mud/sandbanks. Refs: `refs/aberdeen/1-4` (Getty/iStock/Wikimedia/Afripics).

## Lumley (junction/market)
Busy multi-road junction: brick 3-storey buildings with white-balustrade verandas,
large painted ad boards ("Bet Salone – Lumley Branch"), a church tower, dense
tangle of overhead wires on wooden poles, blue three-wheel kekehs with yellow
curtains, minivans ("West Point"), saloon taxis painted in bright two-tone
schemes, hawkers with head-trays. Hilly backdrop with houses climbing the slope
behind the junction. Refs: `refs/lumley/1-3`.

## Wilberforce
Hilly residential suburb, home to Wilberforce Barracks (military). Houses are a
mix of solid two-storey concrete villas — white walls, dark maroon/brown roof
trim, covered verandas with waist-high balustrade railings and external stairs —
and older board houses. Masts/antennas on the hilltops. Refs: `refs/wilberforce/
1,3,4` (property photos show the white-wall/maroon-trim veranda style clearly;
`2.jpg` turned out to be an unrelated interior shot and was not used).

## IMATT
IMATT = International Military Advisory & Training Team, the UK-led mission that
trained Sierra Leone's army after the civil war; it formally closed in 2013
(handed to ISAT). The compound/HQ sat in the Wilberforce/Leicester hills area
(near Hill Station, "IMATT to Leicester" is a known road stretch). The name
outlived the mission: **"IMATT Junction" is still very much a live place name
today** — confirmed via multiple 2025 TikTok/Instagram/Facebook posts for a
"Pee's Bakery" grilling catfish and snacks right at "IMATT Junction". So the stop
is modelled as: a weathered ex-military compound wall/gate (faded signage,
sentry-booth silhouette, boom gate) bordering the road, plus a cluster of
roadside grill/snack stalls at the junction — not an active military photo-op,
since current photos of IMATT are generic soldier/classroom shots with no
distinguishing architecture. Refs: `refs/imatt/1-2` (mostly unusable — confirms
the lack of a strong distinct building to model, hence the compound-wall +
junction-stall approach).

## Palette picked from photos
- Sea (beach road/Chapter One): `#3f7f93` body, `#e8f1ee` foam.
- Creek (Aberdeen/Goderich): `#56726b` / murky mangrove water `#5c6a46`.
- Sand: `#d8c48a`, wet sand `#ab9468`.
- Weathered zinc roofing: greys/rust `#8a8f91 #9a7a63 #716a5e #b5a98f`.
- Krio veranda houses: white `#f4ede0` walls, maroon trim `#5a2a22` / `#7f4a32`.
- Canoe hulls: Sierra-Leone-flag-ish brights, reused from `kit.CLOTH`.
- Chapter One: charcoal `#3a3d42`, timber `#c9a06a`, gold sign `#d4af37`, pool `#1c8f8a`.
