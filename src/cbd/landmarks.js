/* Tier 1 and Tier 2 landmarks on the CBD loop.

   Position and footprint always come from OpenStreetMap (the ids below).
   Massing, colour and details come from the sources in
   docs/cbd/05-landmark-inventory.md; the `confidence` field says how much of
   each model is evidenced. Nothing here moves a landmark to make it visible. */
import './geo.js';

const project = (lat, lon) => window.PODA_CBD_GEO.project(lat, lon);

export const LANDMARKS = [
  { id: 'cottonTree', name: 'Cotton Tree site (post-May-2023 state)', node: [8.487148, -13.235624], confidence: 'position: OSM node; form: 2025 Wikimedia photo of the remaining trunk spires, flag wrap and plinth' },
  { id: 'lawCourts', name: 'Law Courts (Supreme Court Building)', osmWays: [91664110], floors: 2, confidence: 'footprint: OSM; cream colonial block, columns, red roof: press photos (docs/cbd/06); height estimated' },
  { id: 'museum', name: 'Sierra Leone National Museum', osmWays: [307244436], floors: 1, confidence: 'footprint: unnamed OSM building containing the museum node; form low confidence' },
  { id: 'nassit', name: 'NASSIT House', osmWays: [306848898], floors: 9, confidence: 'footprint: OSM building containing the NASSIT node; white with blue stripe from photos; 9 storeys estimated' },
  { id: 'slcb', name: 'Sierra Leone Commercial Bank', osmWays: [177521577], floors: 12, confidence: 'footprint: OSM; sand-coloured ribbed tower, ~12 storeys, from photos (approximate)' },
  { id: 'rokel', name: 'Rokel Commercial Bank', osmWays: [177521576], floors: 6, confidence: 'footprint: OSM; white with blue brise-soleil from photos; storeys estimated' },
  { id: 'cityHall', name: 'Freetown City Hall', osmWays: [1430383234, 1430383235], floors: 15, confidence: '15 storeys, twin building: Freetown City Council; footprints inferred (two unnamed ~1,050 m² buildings at the townhall node); colour not verified' },
  { id: 'cathedral', name: "St George's Cathedral", osmWays: [177521574], confidence: 'footprint: OSM; stone walls (1817–28); tower and window pattern not modelled — no verified reference' },
  { id: 'bigMarket', name: 'Big Market', osmWays: [173226206], floors: 2, confidence: 'footprint: OSM; storeys and façade not verified' },
];

export function buildLandmark(def, ctx) {
  const { THREE, B, data, route, helpers } = ctx;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const put = (geo, x, y, z, sx, sy, sz, col, key = 'vc:lm', rx = 0, rz = 0) => {
    Q.setFromEuler(new THREE.Euler(rx, 0, rz));
    B.geometry(key, geo, M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz)), col);
  };
  const footprint = id => {
    const b = data.buildings.find(x => x.id === id);
    if (!b) return null;
    const fit = route.fitFootprint(b.pts);
    return { pts: fit.pts, shift: fit.shift };
  };
  const centroid = pts => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  /** The footprint edge that faces the loop most squarely. */
  const frontEdge = pts => {
    const signed = pts.reduce((s, a, i) => { const b = pts[(i + 1) % pts.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
    let best = null;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez);
      if (len < 2) return;
      const n = signed > 0 ? [ez / len, -ex / len] : [-ez / len, ex / len];
      const l = route.lateral((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      if (!l) return;
      const toRoad = [-l.nx * Math.sign(l.offset), -l.nz * Math.sign(l.offset)];
      const score = (n[0] * toRoad[0] + n[1] * toRoad[1]) * len / (1 + l.distance * 0.05);
      if (!best || score > best.score) best = { a, b, n, len, score, yaw: Math.atan2(ex, ez) };
    });
    return best;
  };
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
  const cone = new THREE.ConeGeometry(0.5, 1, 7), ico = new THREE.IcosahedronGeometry(0.5, 0);
  const result = { id: def.id, name: def.name, confidence: def.confidence, shift: 0 };
  const FLOOR = 3.2, GROUND = 3.6;
  const heightOf = floors => GROUND + (floors - 1) * FLOOR;

  switch (def.id) {
    case 'cottonTree': {
      const [x, z] = project(...def.node);
      put(cyl, x, 0.08, z, 9.6, 0.16, 9.6, 0xf2f2f2);                    // painted kerb ring
      for (let i = 0; i < 16; i++) {                                     // black-and-white kerb blocks
        const a = i / 16 * Math.PI * 2;
        B.box('vc:lm', x + Math.cos(a) * 4.85, 0.2, z + Math.sin(a) * 4.85, 0.9, 0.26, 0.3, -a, i % 2 ? 0x1c1c1c : 0xf2f2f2);
      }
      put(cyl, x, 0.5, z, 9.0, 1.0, 9.0, 0x3a3634);                      // stepped dark plinth
      put(cyl, x, 1.3, z, 7.2, 0.7, 7.2, 0x4a4542);
      put(cyl, x, 1.85, z, 5.6, 0.5, 5.6, 0x2e2b29);
      put(cyl, x, 2.8, z, 4.4, 1.4, 4.4, 0x0072c6);                      // flag wrap, blue lowest
      put(cyl, x, 4.2, z, 4.2, 1.4, 4.2, 0xf2f2f2);
      put(cyl, x, 5.6, z, 4.0, 1.4, 4.0, 0x1eb53a);
      for (const [dx, dz, h, w] of [[0, 0, 12, 1.9], [-1.3, 0.6, 10, 1.3], [1.2, -0.7, 8.5, 1.2], [0.4, 1.3, 7, 1.0]]) {
        put(cone, x + dx, 6.3 + h / 2 - 0.5, z + dz, w, h, w, 0x1e1a17, 'vc:lm', dz * 0.05, -dx * 0.06);   // charred spires
      }
      const leaves = [0x4f9a3a, 0x5fae45, 0x3f8a3a];
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4, r = 1.2 + (i % 3) * 0.6;
        put(ico, x + Math.cos(a) * r, 6.5 + (i % 4) * 1.5, z + Math.sin(a) * r, 2.6, 1.8, 2.6, leaves[i % 3]);   // regrowth
      }
      result.position = [x, z];
      break;
    }
    case 'lawCourts': case 'museum': {
      const fp = footprint(def.osmWays[0]); if (!fp) return null;
      const top = def.id === 'museum' ? 5.2 : 10.4;
      helpers.extrude('vc:lm', fp.pts, 0, top, 0xefe4c6, 'plain');
      helpers.extrude('vc:lm', fp.pts, top - 0.7, top, 0xf8f3e4, 'plain');
      helpers.hipRoof('vc:lm', fp.pts, top, def.id === 'museum' ? 2.0 : 3.2, 0xa3442e);
      const e = frontEdge(fp.pts);
      if (e) {
        const n = Math.max(2, Math.floor(e.len / 3.2));
        for (let i = 0; i <= n; i++) {
          const t = 0.06 + 0.88 * i / n, px = e.a[0] + (e.b[0] - e.a[0]) * t + e.n[0] * 1.6, pz = e.a[1] + (e.b[1] - e.a[1]) * t + e.n[1] * 1.6;
          if (def.id === 'lawCourts') put(cyl6, px, top / 2 - 0.3, pz, 0.62, top - 0.6, 0.62, 0xf8f3e4);
          if (i < n) B.box('vc:lm', px + (e.b[0] - e.a[0]) / n * 0.5 - e.n[0] * 1.62, 2.6, pz + (e.b[1] - e.a[1]) / n * 0.5 - e.n[1] * 1.62, 0.12, 2.3, Math.min(1.4, e.len / n * 0.5), e.yaw - Math.PI / 2, 0x2c3a44);
        }
        if (def.id === 'lawCourts') {
          const mx = (e.a[0] + e.b[0]) / 2 + e.n[0] * 1.6, mz = (e.a[1] + e.b[1]) / 2 + e.n[1] * 1.6;
          B.box('vc:lm', mx, top - 0.35, mz, e.len * 0.92, 0.7, 2.0, e.yaw - Math.PI / 2, 0xf8f3e4);     // portico entablature
          B.box('vc:lm', mx, 0.25, mz, e.len * 0.9, 0.5, 3.6, e.yaw - Math.PI / 2, 0xd9d2c0);           // raised steps
        }
      }
      result.shift = fp.shift; result.position = centroid(fp.pts);
      break;
    }
    case 'nassit': case 'slcb': case 'rokel': case 'cityHall': {
      const colour = { nassit: 0xf4f4f2, slcb: 0xc9a97a, rokel: 0xf3f3ef, cityHall: 0xdcdcd6 }[def.id];
      const top = heightOf(def.floors);
      for (const id of def.osmWays) {
        const fp = footprint(id); if (!fp) continue;
        helpers.extrude('vc:lm', fp.pts, 0, GROUND, 0x4a4f52, 'plain');                   // glazed / shaded ground floor
        helpers.extrude('win:lm', fp.pts, GROUND, top, colour, 'win');
        helpers.roofCap('vc:lm', fp.pts, top, 0xb9b3a6);
        helpers.extrude('vc:lm', fp.pts, top, top + 1.0, colour, 'plain');
        const e = frontEdge(fp.pts);
        if (e && def.id === 'nassit') {
          const mx = (e.a[0] + e.b[0]) / 2 + e.n[0] * 0.12, mz = (e.a[1] + e.b[1]) / 2 + e.n[1] * 0.12;
          B.box('vc:lm', mx, (top + GROUND) / 2, mz, 1.6, top - GROUND, 0.3, e.yaw - Math.PI / 2, 0x1f4fa3);  // vertical blue stripe
        }
        if (e && def.id === 'rokel') {                                                        // blue brise-soleil grid
          for (let y = GROUND + FLOOR; y < top; y += FLOOR) B.box('vc:lm', (e.a[0] + e.b[0]) / 2 + e.n[0] * 0.35, y, (e.a[1] + e.b[1]) / 2 + e.n[1] * 0.35, e.len, 0.22, 0.6, e.yaw - Math.PI / 2, 0x2a5ea8);
          for (let t = 0; t <= 1.001; t += 1 / Math.max(2, Math.round(e.len / 2.4))) B.box('vc:lm', e.a[0] + (e.b[0] - e.a[0]) * t + e.n[0] * 0.35, (top + GROUND) / 2, e.a[1] + (e.b[1] - e.a[1]) * t + e.n[1] * 0.35, 0.18, top - GROUND, 0.6, e.yaw - Math.PI / 2, 0x2a5ea8);
        }
        if (def.id === 'slcb') {                                                              // vertical concrete ribs
          fp.pts.forEach((a, i) => {
            const b = fp.pts[(i + 1) % fp.pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            for (let t = 0; t <= 1.001; t += 1 / Math.max(1, Math.round(len / 1.8))) B.box('vc:lm', a[0] + (b[0] - a[0]) * t, (top + GROUND) / 2, a[1] + (b[1] - a[1]) * t, 0.35, top - GROUND, 0.35, 0, 0xb8956a);
          });
        }
        result.shift = Math.max(result.shift, fp.shift); result.position = centroid(fp.pts);
      }
      break;
    }
    case 'cathedral': {
      const fp = footprint(def.osmWays[0]); if (!fp) return null;
      helpers.extrude('vc:lm', fp.pts, 0, 9, 0xb5aa94, 'plain');
      helpers.hipRoof('vc:lm', fp.pts, 9, 5.5, 0x6d5a4a);
      fp.pts.forEach((a, i) => {                                                              // tall window bays, spacing unverified
        const b = fp.pts[(i + 1) % fp.pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 6) return;
        const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
        for (let t = 0.15; t < 0.9; t += 4 / len) B.box('vc:lm', a[0] + (b[0] - a[0]) * t, 4.6, a[1] + (b[1] - a[1]) * t, 0.4, 4.2, 1.1, yaw, 0x3a4250);
      });
      result.shift = fp.shift; result.position = centroid(fp.pts);
      break;
    }
    case 'bigMarket': {
      const fp = footprint(def.osmWays[0]); if (!fp) return null;
      helpers.extrude('vc:lm', fp.pts, 0, GROUND, 0xe6dccb, 'plain');
      helpers.extrude('win:lm', fp.pts, GROUND, 7.2, 0xe6dccb, 'win');
      helpers.roofCap('vc:lm', fp.pts, 7.2, 0x9a9690);
      const e = frontEdge(fp.pts);
      if (e) for (let t = 0.08; t < 0.95; t += 4.5 / e.len) B.box('vc:lm', e.a[0] + (e.b[0] - e.a[0]) * t + e.n[0] * 0.05, 1.6, e.a[1] + (e.b[1] - e.a[1]) * t + e.n[1] * 0.05, 0.12, 3.0, 2.6, e.yaw, 0x2b2622);
      result.shift = fp.shift; result.position = centroid(fp.pts);
      break;
    }
    default: return null;
  }
  return result;
}
