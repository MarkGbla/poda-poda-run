# 07 — Gameplay architecture

## Options considered (brief §8.1)

| Option | Fit with this codebase | Verdict |
|---|---|---|
| **A. Fixed geographic route** | Matches the existing *route of named stops* model exactly; landmarks have fixed, true positions | **Chosen**, as a closed loop |
| B. Route choice through a road graph | Needs junction decisions the lane-based input has no verb for, and route-dependent stop lists; the CBD's one-way pairs (Pultney/Percival, Waterloo/Wellington) make legal choices non-obvious | Deferred |
| C. Real sections joined by replay transitions | Risks "teleport" seams the brief forbids | Rejected |

The chosen route is a **real, legal circuit**: the perimeter of the official core block, in the direction its one-way tags allow (doc 02). Because it closes on itself through real junctions, repeating it is driving round the block again, not a disguised jump. One lap is one route (≈1.6 km, 6 stops) — the same order of length as the existing routes (5 stops at 420–560 m legs ≈ 2 km).

## Road space onto real streets

The simulation is unchanged and keeps working in road space (doc 01). `CbdMode.beforeRender` maps every road-space object `(x, y, z)` to

```
s       = s_player − z                       (arc length along the loop)
P, T    = RoadPath.frameAt(s)                (position, unit tangent)
world   = P + R(T)·x + (0, y, 0)             R(T) = driver's right = (−T.z, 0, T.x)
heading = atan2(−T.x, −T.z) applied as a yaw before the object's own rotation
```

and `afterRender` restores the road-space values, so `update()` never sees plan coordinates. Consequences:

- **Collisions, stops, scoring, traffic AI, passengers, jumps: untouched.** They are as correct on a curve as on a straight because they only ever compare road-space x and z.
- **Traffic follows the curve** for free — a car 60 m ahead in lane 0 is drawn 60 m along the real street, in lane 0.
- **Stops sit at their real places**: leg lengths are now real distances along the loop (`distanceToStop`), so the stop drawn at road-space `z = −toStop` lands at the mapped feature.
- Coins (an `InstancedMesh`) are mapped per instance and restored from a saved copy of the instance buffer.

## Steering on curves

Lateral control is unchanged: lanes are measured from the curved centreline, so "left lane" stays the left lane through a bend. No world-axis assumptions remain in drawing.

## Speed and difficulty on real corners (`CbdRoute.speedCap`, `PlayerSystem`)

- Every arc gets a corner speed `√(a_lat · r)` with `a_lat = 6.5 m/s²` — 33 km/h at the 13 m street corners, 40 km/h in the roundabout, 87 km/h on the gentlest 90 m bends.
- A braking envelope looks 220 m ahead: `cap(s) = min √(v_corner² + 2·7·d)`. The vehicle eases down to it on its own brakes (`PlayerSystem`, only when `run.speedCap` is set). Every vehicle brakes harder than the planned 7 m/s² (slowest: Waka Fine, 16 m/s²).
- The existing difficulty curve (target speed rising with distance, denser rows) still applies on straights.
- Verified in `tests/cbd-route.test.cjs`: a simulated full-gas lap never exceeds the corner limit (measured peak lateral acceleration 6.66 m/s² for every vehicle, at full gas from 3 km into a run) and the envelope is never steeper than the planned braking.

Not every landmark slows you: only geometry does.

## Fairness rules added

| Rule | Why |
|---|---|
| No static hazards from 25 m before a corner to 40 m after it | Nothing appears just beyond a blind corner (brief §9.3) |
| Kerb lane kept clear 55 m either side of **every** CBD stop | The original rule protects only the current stop; CBD legs can be as short as 152 m, so the next stop is inside the 200 m spawn horizon. Without this, a hazard could block the stop lane (found by the autopilot test drive) |
| Stops placed on straights (≥20 m from any corner) | You can always see and line up the yellow box |
| Turn cue 95 m ahead: `TURN LEFT ONTO WALLACE JOHNSON STREET · 60 m`, or `BEND RIGHT · EASE OFF` | Advance warning; stop cues keep priority |

## Camera

`CameraSystem` is unchanged. Its road-space position (behind and above) and a target 24 m along its own forward axis are both mapped onto the path, and the camera looks from one to the other. Because the target is already round the bend, the camera turns *into* corners progressively — no added smoothing, no cinematic moves. It always sits over the road surface (13.5 m behind the vehicle along the real path), so it never starts inside a building; on a 13 m-radius corner the chord to the vehicle cuts at most ≈1.8 m inside the curve, well within the 8.75 m corridor, so buildings do not occlude the vehicle.

## Scenery

All CBD scenery is static and geographic (`CbdWorld.js`): road ribbon from the path, side-street stubs, 766 footprints, 9 landmarks, 303 mapped trees, lamps, market vendors, sea, and a distant hill silhouette that follows the camera. The straight road, chunks and district plug-ins are hidden in CBD mode and skip their per-frame work.

## Rollback

Remove `?cbd` from the URL. Nothing else changes behaviour: with `cbd === null` every new branch is skipped and `PlayerSystem` sees no cap. Deleting `src/cbd/` plus the guarded lines in `main.js` removes the feature entirely.
