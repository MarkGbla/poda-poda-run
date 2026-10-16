/* A drivable closed path built from a surveyed polyline.

   The game simulates in "road space": x across the carriageway (+ right), z
   along it (player at 0, ahead negative). RoadPath maps arc length s onto a real
   centreline so road space can be drawn on the actual CBD street geometry.

   OSM centrelines are polylines with hard vertices. Each vertex is replaced by a
   circular arc (a fillet) so the heading is continuous and lane offsets never
   fold over. The radius is the largest that keeps the arc within maxDeviation of
   the surveyed vertex, but never below minRadius — a three-lane road cannot turn
   tighter than that — and never longer than the neighbouring segments allow.
   Where minRadius wins, the deviation is reported rather than hidden: see
   stats() and docs/cbd/04-road-and-junction-inventory.md. */
(function (root, factory) {
  const RoadPath = factory();
  if (typeof module === 'object' && module.exports) module.exports = RoadPath;
  if (root) root.PODA_RoadPath = RoadPath;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const wrapAngle = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

  function clean(points, minGap, closed = true) {
    const out = [];
    for (const p of points) if (!out.length || Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) >= minGap) out.push(p);
    while (closed && out.length > 2 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < minGap) out.pop();
    return out;
  }

  /**
   * @param {number[][]} points closed loop of [x, z] metres, first point not repeated
   * @param {{minRadius?:number, maxRadius?:number, maxDeviation?:number}} options
   */
  /* Where a segment is too short to hold two minimum-radius fillets, its two end
     vertices are replaced by the intersection of the neighbouring segments: the
     single corner a driver actually takes. Mapped junction clutter (slip-road
     nodes, kerb nodes a few metres apart) is what triggers this. */
  function mergeShortSegments(pts, minRadius, closed = true) {
    pts = pts.slice();
    const halfTurn = (a, b, c) => {
      const t = wrapAngle(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
      return Math.abs(t) / 2;
    };
    for (let guard = 0; guard < 500 && pts.length > 4; guard++) {
      const n = pts.length;
      let worst = -1, worstExcess = 0;
      for (let i = closed ? 0 : 1; i < (closed ? n : n - 2); i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
        const need = minRadius * (Math.tan(halfTurn(a, b, c)) + Math.tan(halfTurn(b, c, d)));
        const excess = need - Math.hypot(c[0] - b[0], c[1] - b[1]) * 0.98;
        if (excess > worstExcess) { worstExcess = excess; worst = i; }
      }
      if (worst < 0) break;
      const i = worst, a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
      // Intersect line a→b with line d→c.
      const r = [b[0] - a[0], b[1] - a[1]], q = [c[0] - d[0], c[1] - d[1]];
      const den = r[0] * q[1] - r[1] * q[0];
      let m = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      if (Math.abs(den) > 1e-6) {
        const t = ((d[0] - a[0]) * q[1] - (d[1] - a[1]) * q[0]) / den;
        const hit = [a[0] + r[0] * t, a[1] + r[1] * t];
        if (Math.hypot(hit[0] - m[0], hit[1] - m[1]) < 25) m = hit;
      }
      if (closed) { pts.splice(i, 1, m); pts.splice((i + 1) % n, 1); }
      else pts.splice(i, 2, m);
    }
    return pts;
  }

  function create(points, { minRadius = 13, maxRadius = 90, maxDeviation = 2.5, closed = true } = {}) {
    const pts = mergeShortSegments(clean(points, closed ? 0.5 : 1.5, closed), minRadius, closed);
    const n = pts.length;
    if (n < 3) throw new Error('RoadPath needs at least three points');
    const seg = (closed ? pts : pts.slice(0, -1)).map((p, i) => {
      const q = pts[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      return { dx: dx / len, dz: dz / len, len };
    });
    // Turn at each vertex and the radius each would like.
    const corners = pts.map((p, i) => {
      if (!closed && (i === 0 || i === n - 1)) return { i, p, turn: 0, half: 0, radius: maxRadius };
      const a = seg[(i - 1 + n) % n], b = seg[i];
      const turn = wrapAngle(Math.atan2(b.dz, b.dx) - Math.atan2(a.dz, a.dx));
      const half = Math.abs(turn) / 2;
      const want = half < 1e-4 ? maxRadius : maxDeviation / (1 / Math.cos(half) - 1);
      return { i, p, turn, half, radius: Math.max(minRadius, Math.min(maxRadius, want)) };
    });
    // Tangent lengths must fit: two fillets sharing a segment may use at most all of it.
    // Gentle fillets give way first, and only down to minRadius; mergeShortSegments
    // guarantees two minimum-radius fillets fit every segment, so the proportional
    // fallback should never run on real data (stats().minRadius would show it).
    const tan = c => c.half < 1e-4 ? 0 : c.radius * Math.tan(c.half);
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < seg.length; i++) {
        const a = corners[i], b = corners[(i + 1) % n], have = seg[i].len * 0.98;
        for (const [c, other] of tan(a) >= tan(b) ? [[a, b], [b, a]] : [[b, a], [a, b]]) {
          if (tan(a) + tan(b) <= have || c.half < 1e-4) continue;
          c.radius = Math.max(Math.min(minRadius, c.radius), (have - tan(other)) / Math.tan(c.half));
        }
        const need = tan(a) + tan(b);
        if (need > have) { const k = have / need; a.radius *= k; b.radius *= k; }
      }
    }
    // Primitives: line from previous fillet end to this fillet start, then the arc.
    const prims = [];
    for (let i = 0; i < n; i++) {
      const c = corners[i], t = tan(c), a = seg[(i - 1 + n) % n] || seg[0], b = seg[i] || seg.at(-1);
      const start = [c.p[0] - a.dx * t, c.p[1] - a.dz * t], end = [c.p[0] + b.dx * t, c.p[1] + b.dz * t];
      c.start = start; c.end = end;
      if (t > 0) {
        const side = Math.sign(c.turn);                           // +1 turns towards +angle
        // Centre sits along the left/right normal of the incoming direction.
        const nx = -a.dz * side, nz = a.dx * side;
        const centre = [start[0] + nx * c.radius, start[1] + nz * c.radius];
        const a0 = Math.atan2(start[1] - centre[1], start[0] - centre[0]);
        c.arc = { centre, r: c.radius, a0, sweep: c.turn, len: c.radius * Math.abs(c.turn) };
      }
    }
    for (let i = 0; i < n; i++) {
      const c = corners[i], next = corners[(i + 1) % n];
      if (c.arc) prims.push({ type: 'arc', corner: i, ...c.arc });
      if (!closed && i === n - 1) break;
      const dx = next.start[0] - c.end[0], dz = next.start[1] - c.end[1], len = Math.hypot(dx, dz);
      if (len > 1e-6) prims.push({ type: 'line', x: c.end[0], z: c.end[1], dx: dx / len, dz: dz / len, len });
    }
    let total = 0;
    for (const p of prims) { p.s0 = total; total += p.len; }
    // Where each surveyed vertex lands on the path (the middle of its fillet).
    const vertexS = corners.map(c => {
      if (!closed && c.i === n - 1) return total;
      const arc = prims.find(p => p.type === 'arc' && p.corner === c.i);
      if (arc) return arc.s0 + arc.len / 2;
      const line = prims.find(p => p.type === 'line' && Math.hypot(p.x - c.p[0], p.z - c.p[1]) < 1e-3);
      return line ? line.s0 : 0;
    });

    const wrap = closed ? s => ((s % total) + total) % total : s => Math.max(0, Math.min(total, s));
    function primAt(s) {
      let lo = 0, hi = prims.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (prims[mid].s0 <= s) lo = mid; else hi = mid - 1; }
      return prims[lo];
    }
    /** Position, unit tangent and signed curvature (+ turns left as seen driving) at s. */
    function frameAt(s, out = {}) {
      if (!closed && (s < 0 || s > total)) {
        const edge = s < 0 ? 0 : total;
        frameAt(edge, out);
        out.x += out.dx * (s - edge); out.z += out.dz * (s - edge); out.k = 0;
        return out;
      }
      s = wrap(s);
      const p = primAt(s), u = s - p.s0;
      if (p.type === 'line') {
        out.x = p.x + p.dx * u; out.z = p.z + p.dz * u; out.dx = p.dx; out.dz = p.dz; out.k = 0;
      } else {
        const dir = Math.sign(p.sweep), a = p.a0 + dir * u / p.r;
        out.x = p.centre[0] + Math.cos(a) * p.r; out.z = p.centre[1] + Math.sin(a) * p.r;
        out.dx = -Math.sin(a) * dir; out.dz = Math.cos(a) * dir;
        // x east / z south is a left-handed plan view, so +angle turns are right turns.
        out.k = -dir / p.r;
      }
      return out;
    }
    /** Road space (lateral x, along s) → plan position. Right of travel is +x. */
    function toWorld(s, x, out = {}) {
      frameAt(s, out);
      out.x += -out.dz * x; out.z += out.dx * x;
      out.heading = Math.atan2(-out.dx, -out.dz);                 // Three.js yaw that faces -z along the tangent
      return out;
    }
    /** Nearest point on the path to a plan position: { s, offset (+ right), distance }. */
    function nearest(x, z, step = 2, from = 0, to = total) {
      let best = { s: 0, d2: Infinity };
      const f = {};
      from = Math.max(0, from); to = Math.min(total, to);
      for (let s = from; s <= to; s += step) {
        frameAt(s, f);
        const d2 = (f.x - x) ** 2 + (f.z - z) ** 2;
        if (d2 < best.d2) best = { s, d2 };
      }
      // Refine with a golden-section style shrink around the coarse hit.
      let lo = Math.max(from, best.s - step), hi = Math.min(to, best.s + step);
      for (let k = 0; k < 30; k++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        const d1 = (frameAt(m1, f).x - x) ** 2 + (f.z - z) ** 2;
        const d2 = (frameAt(m2, f).x - x) ** 2 + (f.z - z) ** 2;
        if (d1 < d2) hi = m2; else lo = m1;
      }
      const s = wrap((lo + hi) / 2);
      frameAt(s, f);
      const offset = (x - f.x) * -f.dz + (z - f.z) * f.dx;
      return { s, offset, distance: Math.hypot(x - f.x, z - f.z) };
    }
    /** Turns worth warning about: runs of arcs, merged, with their total angle. */
    function turns(minAngle = 0.5) {
      const out = [];
      for (const p of prims) {
        if (p.type !== 'arc') continue;
        const last = out.at(-1);
        if (last && p.s0 - last.sEnd < 6 && Math.sign(p.sweep) === Math.sign(last.angle)) {
          last.sEnd = p.s0 + p.len; last.angle += p.sweep; last.minRadius = Math.min(last.minRadius, p.r);
        } else out.push({ sStart: p.s0, sEnd: p.s0 + p.len, angle: p.sweep, minRadius: p.r });
      }
      return out.filter(t => Math.abs(t.angle) >= minAngle).map(t => ({ ...t, direction: t.angle > 0 ? 'right' : 'left' }));
    }
    function stats() {
      const arcs = prims.filter(p => p.type === 'arc');
      return {
        length: total,
        surveyedLength: seg.reduce((a, b) => a + b.len, 0),
        minRadius: Math.min(...arcs.map(a => a.r)),
        // How far each fillet's midpoint sits from the surveyed vertex it replaces.
        vertexDeviation: corners.map(c => c.arc ? c.radius * (1 / Math.cos(c.half) - 1) : 0),
      };
    }
    return { length: total, points: pts, prims, vertexS, wrap, frameAt, toWorld, nearest, turns, stats, closed };
  }

  return Object.freeze({ create });
});
