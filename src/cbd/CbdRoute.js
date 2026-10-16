/* Gameplay rules for mapped Freetown routes. Pure data in, numbers out — no
   Three.js. The original CBD loop and the open Central corridor share these
   road-space rules and have separate geometry tests.

   The loop is real: Siaka Stevens Street → Wilberforce Street → Wallace Johnson
   Street → Walpole Street → three-quarters round the Cotton Tree roundabout,
   driven in the direction the one-way tags in OpenStreetMap allow. The Central
   corridor embeds that loop between Congo Cross and Eastern Police. */
(function (root, factory) {
  const geo = typeof module === 'object' && module.exports ? require('./geo.js') : root.PODA_CBD_GEO;
  const RoadPath = typeof module === 'object' && module.exports ? require('./RoadPath.js') : root.PODA_RoadPath;
  const CbdRoute = factory(geo, RoadPath);
  if (typeof module === 'object' && module.exports) module.exports = CbdRoute;
  if (root) root.PODA_CbdRoute = CbdRoute;
})(typeof window !== 'undefined' ? window : null, function (geo, RoadPath) {
  'use strict';

  /* Gameplay corridor. Lanes are the game's own (3 × 3.4 m); the CBD keeps them so
     handling and collision stay identical to every other route. Real carriageways
     here are narrower (see docs/cbd/04), so buildings that would stand inside the
     corridor are pushed back and the push is measured, never hidden. */
  const ROAD_HALF = 3.4 * 1.5 + 0.35;
  const CORRIDOR_HALF = ROAD_HALF + 0.36 + 2.64 + 0.3;      // carriageway, drain, footway, margin

  /* Stops, each anchored to a mapped OpenStreetMap feature. Coordinates are the
     feature's position as mapped (OSM base 2026-10-15); the stop sits on the kerb
     nearest to it. */
  const STOPS = [
    { name: 'Cotton Tree', start: true },
    { name: 'Rokel Commercial Bank', lat: 8.488753, lon: -13.234054, osm: 'way/177521576' },
    { name: 'Wilberforce Street', lat: 8.491124, lon: -13.233026, osm: 'node/21687820 (Lightfoot Boston St junction)' },
    { name: 'City Hall', lat: 8.490401, lon: -13.235251, osm: 'node/13133044444' },
    { name: 'Big Market', lat: 8.489821, lon: -13.236527, osm: 'way/173226206' },
    { name: 'Lightfoot Boston Street', lat: 8.488559, lon: -13.236669, osm: 'node/21687837 (Walpole St junction)' },
    { name: 'Law Courts', lat: 8.487411, lon: -13.23498, osm: 'way/91664110' },
  ];

  const LATERAL_ACCEL = 6.5;   // m/s², arcade-comfortable cornering
  const SPEED_BRAKE = 7;       // m/s², the envelope's planned deceleration; every vehicle brakes harder
  const BIG_TURN = 0.6;        // radians (~35°): turns that get a cue and a quiet zone

  function create(data, options = {}) {
    const closed = data.route.closed !== false;
    const path = RoadPath.create(data.route.points, { minRadius: closed ? 13 : 11, ...options.path, closed });
    const L = path.length;
    const wrap = path.wrap;
    const ahead = (from, to) => closed ? wrap(to - from) : to - from;
    const rawS = [0];
    for (let i = 1; i < data.route.points.length; i++)
      rawS.push(rawS.at(-1) + Math.hypot(data.route.points[i][0] - data.route.points[i-1][0], data.route.points[i][1] - data.route.points[i-1][1]));
    const atIndex = i => {
      const p = data.route.points[i], expected = rawS[i];
      return closed ? path.nearest(...p).s : path.nearest(...p, 2, Math.max(0, expected - 180), Math.min(L, expected + 180)).s;
    };

    // Street sections in path order, located from their first surveyed point.
    const streets = data.route.streets.map(st => ({ name: st.name, s: atIndex(st.start) }))
      .sort((a, b) => a.s - b.s);
    function streetAt(s) {
      s = wrap(s);
      let hit = streets.at(-1);
      for (const st of streets) if (st.s <= s) hit = st;
      return hit.name;
    }

    const turns = path.turns(BIG_TURN).map(t => ({ ...t, onto: streetAt(t.sEnd + 12) }));
    const arcs = path.prims.filter(p => p.type === 'arc');
    const inTurnZone = (s, before, after) => turns.some(t => {
      if (!closed) return s >= t.sStart - before && s <= t.sEnd + after;
      const into = ahead(s, t.sStart), out = ahead(t.sEnd, s);
      return into <= before || out <= after || ahead(t.sStart, s) <= t.sEnd - t.sStart;
    });

    // Start just clear of the roundabout exit, then each stop in driving order.
    const startS = closed ? wrap((turns.find(t => t.onto === 'Siaka Stevens Street')?.sEnd ?? 0) + 18) : 0;
    let prev = startS;
    const stops = (closed ? STOPS : data.route.stops).map(def => {
      if (def.start || (!closed && def.pointIndex === 0)) return { ...def, s: startS };
      const [x, z] = closed ? geo.project(def.lat, def.lon) : data.route.points[def.pointIndex];
      let s = closed ? path.nearest(x, z).s : atIndex(def.pointIndex);
      // A stop must not sit in a corner: slide it forward until it is on a straight.
      const stopTurnBuffer = closed ? 20 : 15;
      for (let k = 0; k < 80 && inTurnZone(s, stopTurnBuffer, stopTurnBuffer) && (closed || s < L - 10); k++) s = wrap(s + 2);
      let abs = closed ? prev + ahead(prev, s) : s;
      if (closed && abs - prev < 60) abs += L;               // never double back
      if (!closed && abs <= prev) throw new Error(`Stop ${def.name} is out of road order`);
      prev = abs;
      return { ...def, s: abs, x, z };
    });

    /** Highest speed from which every corner ahead can still be taken. */
    function speedCap(s, lookahead = 220) {
      let cap = Infinity;
      for (const a of arcs) {
        if (!closed && a.s0 + a.len < s) continue;
        const into = ahead(s, a.s0), inside = closed ? ahead(a.s0, s) <= a.len : s >= a.s0 && s <= a.s0 + a.len;
        const d = inside ? 0 : into;
        if (d > lookahead) continue;
        cap = Math.min(cap, Math.sqrt(LATERAL_ACCEL * a.r + 2 * SPEED_BRAKE * d));
      }
      return cap;
    }
    /** The next corner worth announcing, if one is close. */
    function nextTurn(s, within = 110) {
      let best = null;
      for (const t of turns) {
        const d = ahead(s, t.sStart);
        if (d >= 0 && d <= within && (!best || d < best.metres)) best = { direction: t.direction, onto: t.onto, metres: d, angle: t.angle };
      }
      return best;
    }
    /** Static hazards stay out of corners and out of the blind run just after one. */
    function canSpawnStatic(s) { return !inTurnZone(s, 25, 40); }

    /* Building fitting. Footprints come from OSM unchanged; any that reach into
       the gameplay corridor are moved straight back from the road, and the move is
       returned so it can be reported. Footprints sitting on the centreline itself
       (kiosks, the roundabout island) are dropped. */
    const samples = [];
    for (let s = 0; s < L; s += 1) samples.push(path.frameAt(s, {}));
    const CELL = 24, grid = new Map();
    samples.forEach((f, i) => {
      const k = Math.floor(f.x / CELL) + ',' + Math.floor(f.z / CELL);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    });
    function lateral(x, z) {
      let best = null, d2 = Infinity;
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const idx of grid.get((cx + i) + ',' + (cz + j)) || []) {
          const f = samples[idx], dd = (f.x - x) ** 2 + (f.z - z) ** 2;
          if (dd < d2) { d2 = dd; best = f; }
        }
      }
      if (!best) return null;
      return { offset: (x - best.x) * -best.dz + (z - best.z) * best.dx, nx: -best.dz, nz: best.dx, distance: Math.sqrt(d2) };
    }
    function fitFootprint(pts) {
      let shift = [0, 0], moved = 0;
      const cur = () => pts.map(p => [p[0] + shift[0], p[1] + shift[1]]);
      const centre = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
      const c = lateral(...centre);
      if (c && Math.abs(c.offset) < 3.5 && c.distance < 3.5) return { pts, shift: 0, dropped: true };
      for (let pass = 0; pass < 4; pass++) {
        let worst = null;
        for (const p of cur()) {
          // Also test edge midpoints so long façades cannot straddle the corridor.
          const l = lateral(...p);
          if (!l || Math.abs(l.offset) >= CORRIDOR_HALF || l.distance > CORRIDOR_HALF + 1) continue;
          const side = Math.sign(c ? c.offset : l.offset) || 1;
          const need = CORRIDOR_HALF - side * l.offset;
          if (need > 0 && (!worst || need > worst.need)) worst = { need, nx: l.nx * side, nz: l.nz * side };
        }
        if (!worst) break;
        shift = [shift[0] + worst.nx * (worst.need + 0.05), shift[1] + worst.nz * (worst.need + 0.05)];
        moved = Math.hypot(...shift);
        if (moved > 25) return { pts, shift: moved, dropped: true };
      }
      return { pts: cur(), shift: moved, dropped: false };
    }

    // Subdivide before trimming: a long side-street pavement can start on the
    // carriageway even when its midpoint is well outside the loop.
    function sideFootway(a, b, half, side) {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      if (len < 0.2) return [];
      const nx = -dz / len * side, nz = dx / len * side;
      const at = (t, width) => [a[0] + dx * t + nx * width, a[1] + dz * t + nz * width];
      const quads = [], steps = Math.ceil(len);
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const pts = [at(t0, half), at(t0, half + 1.8), at(t1, half + 1.8), at(t1, half)];
        if (pts.some(p => { const l = lateral(...p); return l && l.distance < CORRIDOR_HALF; })) continue;
        quads.push({ pts, from: t0 * len, to: t1 * len });
      }
      return quads;
    }

    return { path, length: L, startS, stops, streets, turns, streetAt, speedCap, nextTurn, canSpawnStatic, fitFootprint, lateral, sideFootway, CORRIDOR_HALF };
  }

  return Object.freeze({ create, STOPS, ROAD_HALF, CORRIDOR_HALF, LATERAL_ACCEL, SPEED_BRAKE });
});
