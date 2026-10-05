# Poda-Poda Run plug-in contract

The engine (`index.html`) handles gameplay, the road, traffic logic and the HUD. What things look like comes from plug-in files. Each plug-in registers into `window.PODA`, and the engine calls it with a `kit` of shared helpers. If no plug-in is registered for something, the engine uses its built-in placeholder.

| File | Owner | Registers |
|---|---|---|
| `vehicles.js` | vehicles agent | `PODA.vehicles.*` |
| `districts-west.js` | west agent | `PODA.districts['Goderich' … 'IMATT']` |
| `districts-east.js` | east agent | `PODA.districts['Congo Cross' … 'FBC']` |
| `people.js` | characters agent | `PODA.people.make` |

**Edit only your own file.** Never touch `index.html` or anyone else's file. If you need an engine change, say so in your final report.

Every file starts with:
```js
window.PODA = window.PODA || { vehicles: {}, districts: {} };
```
Use plain browser JS and the global `THREE` (r128 API: `BoxGeometry`, `MeshLambertMaterial` and so on; no ES modules). Load no external assets. Draw textures with `kit.canvasTex`.

## World coordinates (metres)
- The player drives toward **−z**. The camera sits behind at about z=+10.5, y=5.3, looking down the road.
- **Road:** x ∈ [−5.45, 5.45], three lanes centred at x = −3.4, 0, +3.4. Sierra Leone drives on the right, so the kerb lane is +3.4.
- **Pavements:** |x| ∈ [5.45, 8.45], top surface at y = 0.2, with an open gutter on the road edge.
- **Buildings and scenery go at |x| ≥ 9.** Small kerb props (stalls, poles, people, signs) may sit at |x| ∈ [6, 8.4].
- **Ground:** a static laterite-red plane at y = −0.02 everywhere. A district can lay its own ground (sand, concrete, grass) at y between 0.01 and 0.05, beyond |x| > 8.5.
- **Hills:** `ctx.slopeL` / `ctx.slopeR` are hillside planes running from |x| = 10.5 to 52 and rising to y ≈ 17. `kit.hy(absX)` gives the slope height. Hide them (`.visible = false`) or recolour them (`.material = kit.M(0x…)`) per chunk. They reset to visible green before every fill.

## Districts: `PODA.districts[name] = { fill, landmark }`
District keys must match the stop names exactly:
`Goderich, Lumley Beach Road, Chapter One, Aberdeen, Lumley, Wilberforce, IMATT, Congo Cross, Cotton Tree, PZ, Abacha Street, Eastern Police, FBC`.
The stretch of road leading up to a stop uses that stop's district. You can register one object under several names.

**`fill(group, kit, ctx)`** decorates one recycled **chunk** (`ctx.index` counts chunks in driving order, so consecutive indices sit end to end): 30 m of road, with local z running from 0 down to −30 and x as above. It is called again whenever the chunk is recycled, with `group` already emptied, so it must be cheap:
- Reuse `kit.G.*` geometries and `kit.M(hex)` materials (both are cached).
- Build any custom geometry or texture **once** at module level, lazily on first call. Never build one per fill.
- Aim for at most about 150 meshes per chunk.
- Randomise so consecutive chunks don't look cloned.
- Chunks butt end to end, so anything continuous (sea, wall, bridge rail) must span the full z ∈ [−30, 0].

**`landmark(group, kit, ctx)`** is optional. It is a one-off set piece added to the **bus-stop group**:
- The origin is the stop centre at road level, and +x is the kerb side.
- The engine already puts a shelter at x ≈ 7–8, z −3…3 and a stop sign at x ≈ 6.5, z −6.5. Keep x ∈ [5.4, 9.2], z ∈ [−9, 9] clear.
- Never cover the road.
- Landmarks can be big (a roundabout monument, a clock tower, a college on a hill), placed at |x| > 9 or far behind on the hill.

## Vehicles: `PODA.vehicles.*`
Riders and drivers from `kit.makePerson` face +z, so rotate them by π to face forward. All vehicles face **−z**, sit on y = 0 and are centred on the origin. Collision boxes are fixed in the engine, so stay within the stated footprint.
- `podapoda(kit, { slogan, routeText, scheme, withCrew })` returns a `THREE.Group`, about **5.4 long × 2.2 wide**.
  - The rear (+z face) must show the slogan and route; `kit.getSloganTex(slogan, routeText)` is available, or draw your own.
  - With `withCrew`, put the apprentice at the open sliding door on the **right (+x)** side and set `group.userData.apprentice = person`. Persons come from `kit.makePerson()`; the engine waves `person.userData.armR`.
  - `scheme` is a suggestion (`{body, stripe, stripe2}`) and can be ignored.
- Each of these returns `{ g, wid, len, weave? }`, where wid and len are the collision footprint:
  - `kekeh(kit)`: about 1.5 × 2.8
  - `okada(kit)`: about 0.9 × 1.9, with `weave: true`
  - `taxi(kit)`: about 1.95 × 4.2
  - `wakaFine(kit)`: about 2.5 × 9

## People: `PODA.people.make(kit, opt)`
Returns a `THREE.Group` for one person:
- Feet at y = 0 and about **1.6–1.85 tall**.
- The person **faces +z** by default, so the face is toward the camera when rotation.y = 0. The engine rotates people with `rotation.y = atan2(dx, dz)` to face a walking direction (dx, dz).
- **Options:** `opt = { shirt?, lappa?, tray?, cast?, role? }`. `role` is one of `'passenger' | 'hawker' | 'apprentice' | 'rider' | 'driver' | 'vendor'`. `tray` means carrying goods on the head. `lappa` means a wrapper skirt.
- **userData:**
  - Set `userData.armL` / `userData.armR` to meshes or groups pivoting at the shoulder. The engine rotates `armR.rotation.z` and `rotation.x` to wave.
  - Optionally set `userData.legL` / `userData.legR`, pivoting at the hip, for a walk cycle.
  - For `role: 'rider' | 'driver'`, return a seated pose (and still face +z; vehicles rotate the person themselves).
- **Budget:** these are everywhere (stops, kerbs, vehicles), so keep it under about 20 meshes per person. Share geometries and textures at module level, keep a few cached textures (faces, gara/ankara prints) and pick between them.
- The engine bakes static scenery into merged meshes, so people standing in chunks cost almost nothing once baked. Animated ones (stop crowds, walkers, riders) stay live.

## `kit`
- **Libraries and helpers:** `THREE`, `G` (box, cyl, cyl6, sph, ico, pyr, cone, disc; all unit size, scale them), `M(hex)` (cached Lambert material), and `add(parent, geo, colorOrMaterial, sx, sy, sz, x, y, z, castShadow)` (y is the mesh centre).
- **Random and maths:** `rand(a, b)`, `randi(a, b)`, `pick(arr)`, `clamp`.
- **Textures:** `canvasTex(w, h, draw(ctx2d, w, h))`, `fitText(ctx, text, maxW, size, fontFamily)`, `getSloganTex(slogan, route)`. Bungee and Outfit are loaded.
- **Building blocks:** `makePerson({ shirt, lappa, tray, cast })`, `addHouse(parent, x, z, baseY, isFrontRow, side)`, `addTree(parent, x, z, baseY, isPalm)`, `addVendor(parent, x, z, side)`, `defaultFill(group)`.
- **Data and palettes:** `shopTex` (array of shop-sign textures), `DATA` (route, slogans, shops, krio), `SCHEMES`, `HOUSE`, `ROOF`, `CLOTH`, `SKIN`, `PANTS`.
- **Constants:** `CH` (30), `LANE_W`, `LANES`, `ROAD_HALF`, `hy`.

## Dev views (local only; these query strings don't survive publishing)
- `index.html?district=Congo%20Cross`: autopilot drive where every chunk and stop uses that district.
- `index.html?garage`: all vehicles lined up, front three-quarter view. Add `&rear` for the back view.
- `index.html#demo`: the normal route on autopilot.

Screenshot tool (headless Chromium with software WebGL; give it 8–15 s to warm up):
```
node /tmp/claude-1000/-home-night-bird-Documents-Projects-personal-project/f5ac29b6-1cb0-4be4-80f4-0157994e570e/scratchpad/shot.mjs "file:///home/night_bird/Documents/Projects/personal-project/poda-poda-run/index.html?district=PZ" out.png 12000 [width height]
```
It prints any page errors. Fix every error before you finish.
