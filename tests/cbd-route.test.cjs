const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../src/cbd/geo.js');
const RoadPath = require('../src/cbd/RoadPath.js');
const CbdRoute = require('../src/cbd/CbdRoute.js');
const PlayerSystem = require('../src/simulation/systems/PlayerSystem.js');
const data = require('../src/cbd/data/cbd-data.json');

const route = CbdRoute.create(data);
const { path } = route;

/* ---------- geographic data ---------- */
test('projection round-trips and keeps distances', () => {
  const [x, z] = geo.project(8.490401, -13.235251);
  const back = geo.unproject(x, z);
  assert.ok(Math.abs(back.lat - 8.490401) < 1e-9 && Math.abs(back.lon - -13.235251) < 1e-9);
  // WGS84 at 8.49° N: 1° of latitude ≈ 110,598 m, 1° of longitude ≈ 110,108 m (standard ellipsoid tables).
  const [, z1] = geo.project(8.488148, -13.235624);
  assert.ok(Math.abs(-z1 - 110.60) < 0.05, `got ${-z1}`);
  const [x1] = geo.project(8.487148, -13.234624);
  assert.ok(Math.abs(x1 - 110.11) < 0.05, `got ${x1}`);
  assert.deepEqual(geo.project(geo.ORIGIN.lat, geo.ORIGIN.lon).map(v => Math.abs(v)), [0, 0]);
});

test('dataset is complete, finite and attributed', () => {
  assert.match(data.meta.licence, /ODbL/);
  assert.ok(data.route.points.length > 20);
  for (const p of data.route.points) assert.ok(p.every(Number.isFinite));
  for (const b of data.buildings) {
    assert.ok(b.pts.length >= 3, `building ${b.id}`);
    for (const p of b.pts) assert.ok(p.every(Number.isFinite), `building ${b.id}`);
  }
  assert.equal(new Set(data.route.nodes).size, data.route.nodes.length, 'loop never revisits an OSM node');
});

test('the loop is the core CBD block in the mapped one-way direction', () => {
  assert.deepEqual(data.route.streets.map(s => s.name),
    ['Siaka Stevens Street', 'Wilberforce Street', 'Wallace Johnson Street', 'Walpole Street', 'Cotton Tree roundabout']);
  // Consecutive surveyed nodes are close: a gap would mean an invented connection.
  const pts = data.route.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 140, `gap after node ${data.route.nodes[i]}`);
  }
});

/* ---------- path geometry ---------- */
test('path stays within tolerance of the surveyed centreline', () => {
  const stats = path.stats();
  assert.ok(Math.abs(stats.length - stats.surveyedLength) / stats.surveyedLength < 0.02, 'length within 2 %');
  let worst = 0;
  for (const [x, z] of data.route.points) worst = Math.max(worst, path.nearest(x, z).distance);
  // 90° street corners are rounded to a 13 m drivable radius: the corner node
  // itself then sits ~5.4 m off the path. Everywhere else it is far closer.
  assert.ok(worst < 6, `worst surveyed node is ${worst.toFixed(2)} m from the path`);
});

test('path is continuous, never tighter than a three-lane road can turn', () => {
  assert.ok(path.stats().minRadius >= 12.99, `min radius ${path.stats().minRadius}`);
  const a = {}, b = {};
  for (let s = 0; s < path.length; s += 0.5) {
    path.frameAt(s, a); path.frameAt(s + 0.5, b);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.51, `position jump at ${s}`);
    assert.ok(Math.hypot(a.dx - b.dx, a.dz - b.dz) < 0.05, `heading jump at ${s}`);
  }
  // wraps cleanly
  path.frameAt(path.length - 0.01, a); path.frameAt(0, b);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.05);
});

test('road-space lateral offsets land on the correct side', () => {
  const f = {}, r = {};
  for (const s of [100, 470, 900, 1520]) {
    path.frameAt(s, f); path.toWorld(s, 3.4, r);
    // +x is the driver's right: (dx, dz) rotated clockwise in a north-up plan
    const cross = f.dx * (r.z - f.z) - f.dz * (r.x - f.x);
    assert.ok(cross > 0, `offset at ${s} is on the left`);
    const n = path.nearest(r.x, r.z);
    assert.ok(Math.abs(n.offset - 3.4) < 0.05);
  }
});

/* ---------- gameplay rules ---------- */
test('stops run forward along the loop, on straights, one lap long', () => {
  const s = route.stops.map(st => st.s);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] - s[i - 1] >= 60, `${route.stops[i].name} too close`);
  assert.ok(s.at(-1) - s[0] > path.length * 0.9 && s.at(-1) - s[0] < path.length * 1.2);
  for (const st of route.stops.slice(1)) {
    assert.ok(route.canSpawnStatic(st.s) || route.turns.every(t => path.wrap(st.s - t.sEnd) > 20), `${st.name} sits in a corner`);
    // Each stop is within reach of the feature it is named after.
    const f = path.frameAt(st.s, {});
    assert.ok(Math.hypot(f.x - st.x, f.z - st.z) < 70, `${st.name} is ${Math.hypot(f.x - st.x, f.z - st.z).toFixed(0)} m from its feature`);
  }
});

test('the speed envelope is brakeable and respects lateral limits', () => {
  const vehicles = require('../src/data/GameConfig.js').vehicles;
  const minBraking = Math.min(...Object.values(vehicles).map(v => v.braking));
  assert.ok(minBraking > CbdRoute.SPEED_BRAKE, 'every vehicle out-brakes the envelope');
  for (let s = 0; s < path.length; s += 1) {
    const now = route.speedCap(s), next = route.speedCap(s + 1);
    // Reaching next from now within 1 m never needs more than the planned deceleration.
    if (Number.isFinite(now) && Number.isFinite(next)) assert.ok(next * next >= now * now - 2 * CbdRoute.SPEED_BRAKE * 1 - 1e-6, `envelope too steep at ${s}`);
  }
  for (const arc of path.prims.filter(p => p.type === 'arc' && p.r < 80)) {
    const mid = arc.s0 + arc.len / 2, cap = route.speedCap(mid);
    assert.ok(cap * cap / arc.r <= CbdRoute.LATERAL_ACCEL + 1e-6, `corner at ${mid.toFixed(0)}`);
  }
});

test('a simulated lap at full gas never exceeds the corner limits', () => {
  const run = { time: 0, dist: 0, toStop: 1e9, speed: 15, invuln: 0, magnet: 0, x: 0, lane: 1, dwell: 0, vehicle: { acceleration: 6, braking: 24, maxSpeed: 34, handling: 11 } };
  const input = { gas: true, brake: false, brakePulse: 0 };
  let s = route.startS, worstLat = 0;
  for (let t = 0; t < 400 && s < route.startS + path.length; t += 1 / 60) {
    run.speedCap = route.speedCap(s);
    const { distance } = PlayerSystem.stepPlayer(run, input, 1 / 60, 'play', [-3.4, 0, 3.4]);
    s += distance;
    const k = Math.abs(path.frameAt(s, {}).k);
    worstLat = Math.max(worstLat, run.speed * run.speed * k);
  }
  assert.ok(s >= route.startS + path.length, 'completed the lap');
  assert.ok(worstLat <= CbdRoute.LATERAL_ACCEL + 0.6, `peak lateral ${worstLat.toFixed(2)} m/s²`);
});

test('no speed cap means PlayerSystem behaves exactly as before', () => {
  const mk = () => ({ time: 0, dist: 0, toStop: 100, speed: 20, invuln: 0, magnet: 0, x: 0, lane: 1, dwell: 0 });
  const a = mk(), b = mk();
  b.speedCap = undefined;
  for (let i = 0; i < 120; i++) {
    PlayerSystem.stepPlayer(a, { gas: true, brake: false, brakePulse: 0 }, 1 / 60, 'play', [-3.4, 0, 3.4]);
    PlayerSystem.stepPlayer(b, { gas: true, brake: false, brakePulse: 0 }, 1 / 60, 'play', [-3.4, 0, 3.4]);
  }
  assert.equal(a.speed, b.speed);
  const capped = mk(); capped.speedCap = 9;
  PlayerSystem.stepPlayer(capped, { gas: true, brake: false, brakePulse: 0 }, 0.1, 'play', [-3.4, 0, 3.4]);
  assert.ok(capped.speed < 20 && capped.speed >= 9);
});

test('static hazards stay out of corners and the blind run after them', () => {
  for (const t of route.turns) {
    for (let s = t.sStart; s <= t.sEnd + 35; s += 2) assert.equal(route.canSpawnStatic(s), false, `hazard allowed at ${s}`);
  }
  assert.ok(route.canSpawnStatic(route.stops[1].s - 60) || route.canSpawnStatic(route.stops[1].s + 60));
});

test('every turn cue names a real street', () => {
  const names = new Set(data.route.streets.map(s => s.name));
  for (const t of route.turns) assert.ok(names.has(t.onto), t.onto);
  const cue = route.nextTurn(route.turns[0].sStart - 50);
  assert.equal(cue.onto, route.turns[0].onto);
  assert.ok(Math.abs(cue.metres - 50) < 0.01);
});

/* ---------- buildings ---------- */
test('side-street pavements never cross the playable carriageway', () => {
  let quads = 0;
  for (const st of data.sideStreets) {
    if (st.name === 'Wallace Johnson Street') continue;
    const half = ['primary', 'secondary'].includes(st.highway) ? 4.2 : 3.5;
    for (let i = 1; i < st.points.length; i++) for (const side of [-1, 1]) {
      for (const { pts } of route.sideFootway(st.points[i - 1], st.points[i], half, side)) {
        quads++;
        // Sample across the actual rendered surface, not just its vertices.
        for (let u = 0; u <= 1; u += 0.25) for (let v = 0; v <= 1; v += 0.25) {
          const p = [0, 1].map(axis => pts[0][axis] + u * (pts[1][axis] - pts[0][axis]) + v * (pts[3][axis] - pts[0][axis]));
          assert.ok(path.nearest(...p).distance > CbdRoute.ROAD_HALF + 0.36, `${st.name} pavement reaches the road`);
        }
      }
    }
  }
  assert.ok(quads > 100, 'side-street footways remain visible beyond junctions');
});

test('no footprint stands in the gameplay corridor once fitted, and moves are small', () => {
  let moved = 0, worst = 0;
  for (const b of data.buildings) {
    const fit = route.fitFootprint(b.pts);
    if (fit.dropped) continue;
    if (fit.shift > 0) { moved++; worst = Math.max(worst, fit.shift); }
    const p = fit.pts;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length];
      for (let t = 0; t <= 1; t += 0.1) {
        const l = route.lateral(a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t);
        assert.ok(!l || l.distance >= CbdRoute.ROAD_HALF + 0.36, `building ${b.id} reaches the carriageway`);
      }
    }
  }
  assert.ok(moved / data.buildings.length < 0.15, `${moved} of ${data.buildings.length} moved`);
  assert.ok(worst < 8, `largest move ${worst.toFixed(1)} m`);
});
