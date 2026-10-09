// Three.js is a bundled dependency, not a CDN global: this file dereferences
// THREE at module-evaluation time, so it needs its own import rather than
// relying on another module to assign a global first.
import * as THREE from 'three';
window.PODA = window.PODA || { vehicles: {}, districts: {} };
/* ==================================================================
   People of Freetown: PODA.people.make(kit, opt) + PODA.people.walk(p, t)
   Low-poly but realistically proportioned (head ~1/7.6 of height).
   Every geometry and texture is built once, lazily, on the first call;
   make() only creates Meshes/Groups. All materials are single, opaque
   MeshLambertMaterials (plain ones via kit.M, textured ones = the atlas material)
   so the engine's baker can merge people standing in chunks.
   Body frame: feet at y=0, faces +z, hip pivot y=0.88, shoulders y~1.40
   (all scaled by the person's height / 1.735). Seated poses keep the
   same frame: buttocks at userData.seatY, feet at userData.footY.
   Textures: ONE 512x256 atlas + ONE textured material for faces/prints/jerseys (bakes to one draw).
   LOD: opt.lod ?? PODA.people.lodDefault ?? 'high'. 'low' = 4 colour-only meshes / ~190 tris for
   background crowds (arms + legs merged; armL/armR/legL/legR are dummy Object3Ds).
   ================================================================== */
(() => {
  const PEOPLE = (window.PODA.people = window.PODA.people || {});
  let K = null, GEO = null;
  let ATLAS = null;                    // one shared texture + material for every textured part
  const SPEC = {}, AG = {}, FLAT = {};

  /* ---------------- palettes (from Freetown street photos) ---------------- */
  const SKINS = [0x3b2418, 0x4a2c1d, 0x5a3623, 0x6b4430];
  const TEE = [0xf2f2ee, 0x1d1d1f, 0xd8333a, 0xff7a29, 0xe8b52a, 0x7a3fa0, 0x10a58c, 0x2a6fd0, 0xe24f8f, 0x8fc1e3, 0x3a7d44, 0x9a9a9a, 0x7a1f2b, 0xf5d3b8];
  const PANTS = [0x2b3d5c, 0x1e2a3a, 0x222222, 0x474747, 0x7d6b4f, 0x5a4632, 0x3d4f3a, 0x35507a];
  const SHORTS = [0x2b3d5c, 0x222222, 0x7d6b4f, 0xd8333a, 0x2a6fd0, 0x3d4f3a, 0x9a9a9a];
  const SHOES = [0x1c1c1c, 0xefefef, 0x6b4a32, 0x2a3a5a];
  const CAPS = [0xd8333a, 0x1d1d1f, 0xf2f2ee, 0x2a6fd0, 0x1eb53a, 0xe8b52a, 0x7a3fa0];
  const TOWELS = [0xf2f2ee, 0xe8b52a, 0xd8333a, 0x8fc1e3];
  const HAIR = 0x120d0c, FADE = 0x241914;
  const PRINTS = ['garaBlue', 'garaRust', 'ankaraY', 'ankaraT', 'stripes', 'dots'];
  const JERSEYS = ['jLeone', 'jStripe'];
  const BASINS = [0xbfc3c6, 0xd8333a, 0x2a6fd0, 0xf2f2ee, 'weave', 'weave'];
  const GOODS = { fruit: [0xf28c28, 0xe9b22e, 0x86b83a, 0xd94a2a], bags: [0xe6edf0, 0xd9c08a], bottles: [0x5a2d12, 0x2f5e2a] };

  /* ---------------- small maths helpers ---------------- */
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp1 = x => Math.max(-1, Math.min(1, x));
  function prof(P, y) {               // P = [[y, r], ...] ascending y
    if (y <= P[0][0]) return P[0][1];
    for (let k = 1; k < P.length; k++) if (y <= P[k][0]) {
      const t = (y - P[k - 1][0]) / (P[k][0] - P[k - 1][0]);
      return lerp(P[k - 1][1], P[k][1], t);
    }
    return P[P.length - 1][1];
  }
  let seed = 7;                        // deterministic noise for textures
  const srand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  /* ---------------- geometry builders ---------------- */
  // grid(segs, rows, pt(i,j)->[x,y,z], uv(i,j,p)->[u,v]) : closed or open surface of revolution
  function grid(segs, rows, pt, uvf) {
    const W = segs + 1, n = W * (rows + 1);
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= segs; i++) {
      const k = j * W + i, p = pt(i, j);
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
      const t = uvf ? uvf(i, j, p) : [i / segs, j / rows];
      uv[k * 2] = t[0]; uv[k * 2 + 1] = t[1];
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    fixNormals(g, segs, rows);
    return g;
  }
  // weld normals across the u seam and at poles (avoids seams / star artefacts)
  function fixNormals(g, segs, rows) {
    const P = g.attributes.position.array, N = g.attributes.normal.array, W = segs + 1;
    const same = (a, b) => Math.abs(P[a * 3] - P[b * 3]) + Math.abs(P[a * 3 + 1] - P[b * 3 + 1]) + Math.abs(P[a * 3 + 2] - P[b * 3 + 2]) < 1e-6;
    const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    for (let j = 0; j <= rows; j++) {
      const a = j * W, b = j * W + segs;
      if (same(a, b) && same(a, j * W + (segs >> 1))) {          // pole
        let x = 0, y = 0, z = 0;
        for (let i = 0; i <= segs; i++) { const k = (a + i) * 3; x += N[k]; y += N[k + 1]; z += N[k + 2]; }
        const n = norm(x, y, z);
        for (let i = 0; i <= segs; i++) N.set(n, (a + i) * 3);
      } else if (same(a, b)) {                                       // seam
        const n = norm(N[a * 3] + N[b * 3], N[a * 3 + 1] + N[b * 3 + 1], N[a * 3 + 2] + N[b * 3 + 2]);
        N.set(n, a * 3); N.set(n, b * 3);
      }
    }
  }
  // lathe from a [[y, r], ...] profile (ascending y), optional deform(x,y,z,phi)
  function lathe(P, segs, o = {}) {
    const zs = o.zs || 1;
    return grid(segs, P.length - 1, (i, j) => {
      const phi = (i / segs - 0.5) * TAU + (o.ph || 0), y = P[j][0], r = P[j][1];
      const x = r * Math.sin(phi), z = r * Math.cos(phi) * zs;
      return o.def ? o.def(x, y, z, phi) : [x, y, z];
    }, o.uv ? (i, j) => o.uv(i / segs, P[j][0], j / (P.length - 1)) : null);
  }
  // concatenate indexed geometries (position, normal, uv)
  function merge(list) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    let off = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
      if (g.index) for (const v of g.index.array) idx.push(v + off); else for (let k = 0; k < c; k++) idx.push(k + off);
      off += c;
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.setIndex(idx);
    return m;
  }
  function flipCopy(g, dy) {           // underside of a thin sheet
    const c = g.clone(); c.translate(0, dy, 0);
    const N = c.attributes.normal.array; for (let k = 0; k < N.length; k++) N[k] = -N[k];
    const I = c.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k]; I[k] = I[k + 2]; I[k + 2] = t; }
    return c;
  }
  // knee-bend a hip-pivoted leg part into a seated pose (thigh forward, shin down)
  const KNEE = -0.44;
  function seatBend(src) {
    const g = src.clone(), P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let k = 0; k < P.length; k += 3) {
      const x = P[k], y = P[k + 1], z = P[k + 2], t = ss(KNEE + 0.04, KNEE - 0.04, y);
      // thigh: rotate -90deg about x  (x, y, z) -> (x, z, -y);   shin: hang from the forward knee
      P[k] = x; P[k + 1] = lerp(z, y - KNEE, t); P[k + 2] = lerp(-y, z - KNEE, t);
      const nx = N[k], ny = N[k + 1], nz = N[k + 2];
      const mx = nx, my = lerp(nz, ny, t), mz = lerp(-ny, nz, t), l = Math.hypot(mx, my, mz) || 1;
      N[k] = mx / l; N[k + 1] = my / l; N[k + 2] = mz / l;
    }
    return g;
  }

  /* ---------------- the head ---------------- */
  // head + neck radius profile (y, r); top of skull at 1.735
  const HP = [[1.40, 0.051], [1.50, 0.058], [1.515, 0.067], [1.535, 0.074], [1.555, 0.078], [1.575, 0.080],
    [1.60, 0.082], [1.625, 0.084], [1.65, 0.085], [1.675, 0.0812], [1.70, 0.0687], [1.72, 0.048], [1.735, 0.0]];
  const HY = HP.map(p => p[0]);
  const XS = 0.94, CY = 1.615, TOP = 1.735;
  const FACE_PHI = 3 * TAU / 16, FACE_Y0 = 1.50, FACE_Y1 = 1.675;
  function headPos(phi, y) {
    const r = prof(HP, y), s = ss(1.47, 1.53, y), c = Math.cos(phi);
    return [r * XS * Math.sin(phi), y, r * c * (c > 0 ? 1 + 0.12 * s : 1 + 0.24 * s) + 0.004 * s];
  }
  const near = (a, b) => Math.abs(a - b) < 1e-4;
  function featureZ(phi, y) {          // nose, lips, chin, brow, sockets: pushes along +z
    const c = Math.max(0, Math.cos(phi)), a = Math.abs(phi);
    let d = 0;
    if (near(y, 1.575)) d += 0.019 * c ** 14 + 0.003 * Math.exp(-(((a - 0.78) / 0.25) ** 2));
    if (near(y, 1.60)) d += 0.011 * c ** 14 - 0.005 * Math.exp(-(((a - 0.39) / 0.2) ** 2));
    if (near(y, 1.625)) d += 0.004 * c ** 10 + 0.003 * c ** 3;
    if (near(y, 1.65)) d += 0.004 * c ** 3;
    if (near(y, 1.555)) d += 0.010 * c ** 8;
    if (near(y, 1.535)) d += 0.007 * c ** 8;
    if (near(y, 1.515)) d += 0.004 * c ** 6;
    if (near(y, 1.50)) d += 0.003 * c ** 4;
    return d;
  }
  function buildHead() {
    const segs = 16, rows = HY.length - 1, W = segs + 1;
    const full = grid(segs, rows, (i, j) => {
      const phi = (i / segs - 0.5) * TAU, p = headPos(phi, HY[j]);
      p[2] += featureZ(phi, HY[j]);
      return p;
    });
    const i0 = 5, i1 = 11, j0 = HY.indexOf(FACE_Y0), j1 = HY.indexOf(FACE_Y1);
    // back of head + neck (skin, untextured) = every cell outside the face patch
    const bidx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) {
      if (i >= i0 && i < i1 && j >= j0 && j < j1) continue;
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      bidx.push(a, b, d, a, d, c);
    }
    const back = new THREE.BufferGeometry();
    back.setAttribute('position', full.attributes.position);
    back.setAttribute('normal', full.attributes.normal);
    back.setIndex(bidx);
    const ears = [-1, 1].map(s => new THREE.SphereGeometry(1, 5, 4).scale(0.011, 0.027, 0.019).rotateY(s * 0.3).translate(s * 0.077, 1.585, -0.01));
    // face patch (textured): columns i0..i1, rows j0..j1, uv spans the whole face texture
    const P = full.attributes.position.array, N = full.attributes.normal.array;
    const fw = i1 - i0 + 1, fh = j1 - j0 + 1;
    const fp = new Float32Array(fw * fh * 3), fn = new Float32Array(fw * fh * 3), fu = new Float32Array(fw * fh * 2), fidx = [];
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const s = (j + j0) * W + (i + i0), k = j * fw + i;
      fp.set(P.subarray(s * 3, s * 3 + 3), k * 3); fn.set(N.subarray(s * 3, s * 3 + 3), k * 3);
      fu[k * 2] = i / (fw - 1); fu[k * 2 + 1] = (HY[j + j0] - FACE_Y0) / (FACE_Y1 - FACE_Y0);
    }
    for (let j = 0; j < fh - 1; j++) for (let i = 0; i < fw - 1; i++) {
      const a = j * fw + i, b = a + 1, c = a + fw, d = c + 1;
      fidx.push(a, b, d, a, d, c);
    }
    const face = new THREE.BufferGeometry();
    face.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    face.setAttribute('normal', new THREE.BufferAttribute(fn, 3));
    face.setAttribute('uv', new THREE.BufferAttribute(fu, 2));
    face.setIndex(fidx);
    return { head: merge([back, ...ears]), face };
  }
  // shells that hug the skull: hair, head-ties, caps
  function shell(ybFn, tFn, o = {}) {
    const segs = o.segs || 16, rows = o.rows || 5;
    return grid(segs, rows, (i, j) => {
      const phi = (i / segs - 0.5) * TAU, v = j / rows, yb = ybFn(phi);
      let h, vv = v;
      if (o.drop && yb < 1.56) {                       // hanging curtain (braids, bob) below the skull
        const vd = 0.35;
        if (v < vd) { h = headPos(phi, 1.56); h[1] = lerp(yb, 1.56, v / vd); }
        else { vv = (v - vd) / (1 - vd); h = follow(phi, 1.56, vv); }
      } else h = follow(phi, yb, v);
      const dx = h[0], dy = h[1] - CY, dz = h[2], l = Math.hypot(dx, dy, dz) || 1, t = tFn(phi, v);
      const p = [dx * (1 + t / l), CY + dy * (1 + t / l), dz * (1 + t / l)];
      return o.post ? o.post(p, phi, v) : p;
    }, (i, j) => [i / segs * (o.uS || 1), j / rows * (o.vS || 1)]);
  }
  function follow(phi, yb, v) {
    const a0 = Math.asin(clamp1((yb - CY) / (TOP - CY))), th = a0 + (Math.PI / 2 - a0) * v;
    return headPos(phi, CY + (TOP - CY) * Math.sin(th));
  }
  const hairline = phi => {
    const c = Math.cos(phi);
    return c > 0 ? 1.60 + 0.07 * c ** 0.7 : 1.60 - 0.058 * (-c) ** 0.8;
  };
  const tieLine = phi => {
    const c = Math.cos(phi);
    return c > 0 ? 1.60 + 0.056 * c ** 0.6 : 1.60 - 0.07 * (-c) ** 0.8;
  };

  /* ---------------- body parts ---------------- */
  function buildGeo() {
    const G = {};
    Object.assign(G, buildHead());
    // hair styles
    G.short = shell(hairline, (p, v) => 0.007 + 0.006 * v);
    G.fade = shell(hairline, () => 0.004);
    G.puff = shell(phi => hairline(phi) - 0.004, (p, v) => 0.009 + 0.026 * Math.sin(v * Math.PI / 2) ** 0.8, { rows: 6 });
    G.rows = shell(hairline, (p, v) => 0.006 + 0.003 * v, { uS: 8 });
    G.bob = shell(phi => { const a = Math.abs(phi); return lerp(1.664, 1.518, ss(0.8, 1.3, a)); },
      (p, v) => 0.011 + 0.022 * (1 - v) ** 2, { drop: true, rows: 6 });
    G.braids = shell(phi => { const a = Math.abs(phi); return lerp(1.668, lerp(1.50, 1.40, ss(1.6, 2.6, a)), ss(0.9, 1.4, a)); },
      (p, v) => 0.009 + 0.012 * (1 - v), { drop: true, rows: 7, uS: 8 });
    const tieT = (k, up) => (phi, v) => 0.010 + k * v ** 1.3 + 0.005 * Math.sin(phi * 3 + v * 5) * v;
    const tiePost = (up, bk) => (p, phi, v) => { p[1] += up * v * v; p[2] -= bk * v * v; return p; };
    G.tie = shell(tieLine, tieT(0.045), { rows: 6, uS: 2, post: tiePost(0.03, 0.03) });
    G.gele = shell(tieLine, tieT(0.07), { rows: 6, uS: 2, post: tiePost(0.07, 0.015) });
    G.tieFlat = shell(tieLine, tieT(0.02), { rows: 4, uS: 2, post: tiePost(0.012, 0.0) });
    G.kufi = shell(phi => 1.652 + 0.006 * Math.cos(phi), (p, v) => 0.011, { rows: 4 });
    // baseball cap: crown + visor (double-sided sheet)
    const capLine = phi => 1.638 + 0.009 * Math.cos(phi);
    const crown = shell(capLine, (p, v) => 0.012 + 0.006 * v, { rows: 4 });
    const visor = grid(8, 1, (i, j) => {
      const a = (i / 8 - 0.5) * Math.PI * 0.9, h = follow(a, capLine(a), 0), l = Math.hypot(h[0], h[1] - CY, h[2]);
      const p0 = [h[0] * (1 + 0.012 / l), CY + (h[1] - CY) * (1 + 0.012 / l), h[2] * (1 + 0.012 / l)];
      const len = 0.075 * Math.max(0, Math.cos(a)) ** 0.6;
      return [p0[0] + Math.sin(a) * len * 0.3 * j, p0[1] - 0.014 * j, p0[2] + len * j];
    });
    G.cap = merge([crown, visor, flipCopy(visor, -0.004)]);

    // torsos (u: 4 tiles around, v: 2 tiles waist->neck, so prints are ~25cm)
    const tUV = (u, y) => [u * 5, y < 1.22 ? (y - 0.94) / 0.28 : 1 + (y - 1.22) / 0.25];   // 5 x 2 tiles, edges on rows
    G.torsoM = lathe([[0.94, 0.150], [1.02, 0.152], [1.12, 0.160], [1.22, 0.170], [1.30, 0.177], [1.36, 0.175], [1.40, 0.162],
      [1.43, 0.135], [1.455, 0.095], [1.47, 0.055]], 10, {
      uv: tUV, def: (x, y, z, phi) => {
        const c = Math.cos(phi);
        z *= lerp(0.64, 0.52, ss(1.36, 1.45, y));
        if (c > 0) z += 0.014 * Math.exp(-(((y - 1.29) / 0.07) ** 2)) * c;
        return [x, y, z];
      },
    });
    G.torsoF = lathe([[0.94, 0.136], [1.0, 0.126], [1.06, 0.128], [1.14, 0.140], [1.22, 0.153], [1.28, 0.154], [1.33, 0.152],
      [1.37, 0.148], [1.40, 0.137], [1.425, 0.115], [1.445, 0.08], [1.455, 0.05]], 10, {
      uv: tUV, def: (x, y, z, phi) => {
        const c = Math.cos(phi);
        z *= lerp(0.66, 0.54, ss(1.36, 1.44, y));
        if (c > 0) z += 0.038 * Math.exp(-(((y - 1.262) / 0.05) ** 2)) * c ** 1.5;
        return [x, y, z];
      },
    });
    // pelvis (trousers / shorts top)
    const pel = (hip, bum) => lathe([[0.80, hip - 0.004], [0.87, hip], [0.93, hip], [0.98, 0.148], [1.0, 0.146]], 10, {
      zs: 0.72, def: (x, y, z, phi) => { const c = Math.cos(phi); if (c < 0) z += bum * c * Math.exp(-(((y - 0.88) / 0.06) ** 2)); return [x, y, z]; },
    });
    G.pelvisM = pel(0.15, 0.012); G.pelvisF = pel(0.168, 0.028);
    // lappa / dress / kaftan skirt, local top at y=0 (waist)
    G.skirt = lathe([[-0.93, 0.168], [-0.6, 0.176], [-0.3, 0.186], [-0.16, 0.19], [-0.06, 0.172], [0.0, 0.15]], 10, {
      zs: 0.8, uv: (u, y) => [u * 5, y < -0.6 ? (y + 0.93) / 0.33 : y < -0.3 ? 1 + (y + 0.6) / 0.3 : 2 + (y + 0.3) / 0.3],
      def: (x, y, z, phi) => { const c = Math.cos(phi); if (c < 0) z += 0.02 * c * Math.exp(-(((y + 0.13) / 0.08) ** 2)); return [x, y, z]; },
    });
    // legs (local, hip pivot at 0; sole at -0.88)
    const legP = [[-0.83, 0.0], [-0.80, 0.034], [-0.74, 0.040], [-0.58, 0.053], [-0.46, 0.044], [-0.40, 0.050], [-0.2, 0.068],
      [0.0, 0.078], [0.05, 0.0]];
    const footGeo = new THREE.SphereGeometry(1, 6, 4).scale(0.045, 0.032, 0.115).translate(0, -0.848, 0.045);
    G.legBare = merge([lathe(legP, 6), footGeo]);
    G.trouser = lathe([[-0.84, 0.0], [-0.835, 0.058], [-0.70, 0.06], [-0.45, 0.067], [-0.15, 0.082], [0.0, 0.09], [0.05, 0.0]], 6,
      { uv: (u, y) => [u, y < -0.45 ? (y + 0.84) / 0.39 : 1 + (y + 0.45) / 0.5] });
    G.shoe = new THREE.SphereGeometry(1, 6, 4).scale(0.053, 0.038, 0.13).translate(0, -0.845, 0.05);
    G.shorts = lathe([[-0.36, 0.084], [-0.15, 0.087], [0.0, 0.092], [0.05, 0.0]], 6);
    for (const k of ['legBare', 'trouser', 'shoe', 'shorts']) G[k + 'Seat'] = seatBend(G[k]);
    // arms (local, shoulder pivot at 0), slight natural elbow bend, flattened hand
    G.arm = lathe([[-0.72, 0.0], [-0.69, 0.031], [-0.62, 0.035], [-0.57, 0.028], [-0.44, 0.04], [-0.31, 0.037],
      [-0.17, 0.047], [-0.05, 0.053], [0.05, 0.0]], 6, {
      def: (x, y, z) => {
        const h = ss(-0.56, -0.6, y); x *= lerp(1, 0.6, h); z *= lerp(1, 1.25, h);
        const b = ss(-0.27, -0.35, y) * 0.16, dy = y + 0.31;      // bend forearm forward about the elbow
        return [x, -0.31 + dy * Math.cos(b) + z * Math.sin(b), z * Math.cos(b) - dy * Math.sin(b)];
      },
    });
    G.sleeve = lathe([[-0.17, 0.056], [0.0, 0.057], [0.03, 0.043], [0.045, 0.0]], 7);
    G.sleeveWide = lathe([[-0.30, 0.076], [-0.12, 0.064], [0.0, 0.059], [0.03, 0.044], [0.045, 0.0]], 7,
      { uv: (u, y) => [u, (y + 0.3) / 0.345] });
    // towel over the left (+x) shoulder
    G.towel = merge([
      new THREE.BoxGeometry(0.085, 0.22, 0.012).rotateX(-0.18).translate(0, -0.105, 0.108),
      new THREE.BoxGeometry(0.085, 0.012, 0.2).translate(0, 0.004, 0),
      new THREE.BoxGeometry(0.085, 0.26, 0.012).rotateX(0.14).translate(0, -0.125, -0.1),
    ]).rotateZ(-0.3).translate(0.122, 1.438, 0);
    // head load: basin/basket (double-walled lathe, open top) + goods
    G.basin = lathe([[0.0, 0.0], [0.0, 0.12], [0.085, 0.24], [0.086, 0.228], [0.014, 0.11], [0.014, 0.0]], 12, {
      uv: (u, y, v) => [u * 6, v],
    });
    const fruit = [], bags = [], bottles = [];
    const ring = (n, r, f) => { for (let k = 0; k < n; k++) { const a = k / n * TAU + r * 3; f(Math.cos(a) * r, Math.sin(a) * r, a); } };
    const orange = (x, y, z) => fruit.push(new THREE.SphereGeometry(0.045, 5, 3).translate(x, y, z));
    ring(6, 0.135, (x, z) => orange(x, 0.05, z)); ring(3, 0.06, (x, z) => orange(x, 0.09, z)); orange(0, 0.135, 0);
    const bag = (x, y, z, a) => bags.push(new THREE.BoxGeometry(0.1, 0.035, 0.075).rotateY(a).rotateX(0.15).translate(x, y, z));
    ring(6, 0.13, (x, z, a) => bag(x, 0.04, z, a)); ring(3, 0.055, (x, z, a) => bag(x, 0.075, z, a + 0.6)); bag(0, 0.105, 0, 1);
    const bottle = (x, z) => bottles.push(new THREE.CylinderGeometry(0.018, 0.027, 0.15, 5, 1, true).translate(x, 0.09, z));
    ring(6, 0.13, bottle); ring(3, 0.05, bottle);
    G.goods = { fruit: merge(fruit), bags: merge(bags), bottles: merge(bottles) };
    return G;
  }

  /* ---------------- textures (64px, drawn once, cached) ---------------- */
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const rgb = (h, f = 1, a = 1) => `rgba(${Math.min(255, ((h >> 16) & 255) * f) | 0},${Math.min(255, ((h >> 8) & 255) * f) | 0},${Math.min(255, (h & 255) * f) | 0},${a})`;
  function wrapDraw(w, h, x, y, f) { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) f(x + ox, y + oy); }
  const FABRIC = {
    garaBlue: (g, w, h) => gara(g, w, h, '#1d3474', '#5f86c9', '#c9d8ef'),
    garaRust: (g, w, h) => gara(g, w, h, '#6e2a10', '#c2662a', '#f0c98a'),
    ankaraY(g, w, h) {
      g.fillStyle = '#f0b40c'; g.fillRect(0, 0, w, h);
      for (const [x, y] of [[16, 16], [48, 48]]) wrapDraw(w, h, x, y, (X, Y) => {
        circ(g, X, Y, 13, '#111'); circ(g, X, Y, 11.5, '#c8201e'); circ(g, X, Y, 7, '#111'); circ(g, X, Y, 6, '#1d3f8f'); circ(g, X, Y, 2.4, '#f6f0e0');
      });
      for (const [x, y] of [[48, 16], [16, 48]]) wrapDraw(w, h, x, y, (X, Y) => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; circ(g, X + Math.cos(a) * 6, Y + Math.sin(a) * 6, 2.2, '#1a6d3a'); } circ(g, X, Y, 2.5, '#c8201e'); });
    },
    ankaraT(g, w, h) {
      g.fillStyle = '#0b6e5a'; g.fillRect(0, 0, w, h);
      g.lineWidth = 1.5;
      for (const [x, y, a] of [[12, 14, 0.6], [44, 18, -0.6], [28, 44, 0.3], [58, 50, -0.9]]) wrapDraw(w, h, x, y, (X, Y) => {
        g.save(); g.translate(X, Y); g.rotate(a);
        g.beginPath(); g.ellipse(0, 0, 11, 5.5, 0, 0, TAU); g.fillStyle = '#f07f1d'; g.fill(); g.strokeStyle = '#f6efe0'; g.stroke();
        g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.strokeStyle = '#5a1f5e'; g.stroke(); g.restore();
      });
      for (const [x, y] of [[30, 12], [8, 34], [50, 34], [40, 60]]) circ(g, x, y, 2.5, '#f2d33a');
    },
    stripes(g, w, h) {
      g.fillStyle = '#1b3a86'; g.fillRect(0, 0, w, h);
      seed = 11;
      for (let x = 2; x < w; x += 6.4) { g.fillStyle = 'rgba(235,240,250,0.9)'; g.fillRect(x, 0, 1.4 + srand() * 1.2, h); }
      g.fillStyle = 'rgba(0,0,40,0.18)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3);
    },
    dots(g, w, h) {
      g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) circ(g, x * 8 + (y % 2) * 4 + 2, y * 8 + 4, 1.7, '#f4f1ea');
    },
    jLeone: (g, w, h) => jersey(g, w, h, '#1eb53a', '#f4f4f4', '#0072c6', '10'),
    jStripe(g, w, h) {
      for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? '#16407f' : '#9b1b3b'; g.fillRect(x, 0, 8, h); }
      jersey(g, w, h, null, null, '#f2c230', '9');
    },
    weave(g, w, h) {
      g.fillStyle = '#b48a4c'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#d2ac68' : '#8f6a35'; g.fillRect(x * 8 + 1, y * 8 + 1, 6, 6); }
    },
    rows(g, w, h) {
      g.fillStyle = '#100c0b'; g.fillRect(0, 0, w, h);
      for (const x of [3, 35]) { const gr = g.createLinearGradient(x, 0, x + 26, 0); gr.addColorStop(0, '#100c0b'); gr.addColorStop(0.5, '#3b302b'); gr.addColorStop(1, '#100c0b'); g.fillStyle = gr; g.fillRect(x, 0, 26, h); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < h; y += 8) { g.fillRect(0, y, w, 2); }
    },
  };
  function circ(g, x, y, r, c) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = c; g.fill(); }
  function gara(g, w, h, base, mid, light) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    seed = 3;
    for (const [x, y, r] of [[14, 15, 13], [47, 21, 11], [28, 48, 14], [58, 56, 8]]) wrapDraw(w, h, x, y, (X, Y) => {
      for (let k = 4; k >= 1; k--) {
        g.beginPath();
        for (let a = 0; a <= 24; a++) { const t = a / 24 * TAU, rr = r * k / 4 * (0.85 + 0.25 * Math.sin(t * 7 + k)); g.lineTo(X + Math.cos(t) * rr, Y + Math.sin(t) * rr); }
        g.fillStyle = k % 2 ? mid : base; g.fill();
      }
      g.strokeStyle = light; g.lineWidth = 0.8;
      for (let a = 0; a < 10; a++) { const t = a / 10 * TAU; g.beginPath(); g.moveTo(X + Math.cos(t) * 2, Y + Math.sin(t) * 2); g.lineTo(X + Math.cos(t) * r * 0.8, Y + Math.sin(t) * r * 0.8); g.stroke(); }
      circ(g, X, Y, 2.2, light);
    });
    for (let k = 0; k < 90; k++) { g.fillStyle = srand() < 0.5 ? light : mid; g.globalAlpha = 0.35; g.fillRect(srand() * w, srand() * h, 1, 1 + srand() * 2); }
    g.globalAlpha = 1;
  }
  function jersey(g, w, h, base, side, trim, num) {
    if (base) { g.fillStyle = base; g.fillRect(0, 0, w, h); }
    if (side) { g.fillStyle = side; g.fillRect(14, 0, 4, h); g.fillRect(46, 0, 4, h); }
    g.fillStyle = trim; g.fillRect(0, 0, w, 3);                       // collar band
    g.beginPath(); g.moveTo(26, 0); g.lineTo(32, 9); g.lineTo(38, 0); g.fill();   // V-neck
    g.fillStyle = base ? '#f4f4f4' : trim; g.fillRect(38, 15, 4, 5);      // crest (wearer's left)
    g.font = '800 21px Outfit, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = base ? '#f4f4f4' : trim;
    for (const x of [0, w]) g.fillText(num, x, 27);                       // number on the back (u=0 seam)
  }
  // face texture: covers phi in [-67.5, 67.5] deg and y in [1.50, 1.675]; border pixels are exact skin
  function faceDraw(g, w, h, skin, variant) {
    {
      const X = (x, y) => (Math.asin(clamp1(x / (prof(HP, y) * XS))) / (2 * FACE_PHI) + 0.5) * w;
      const Y = y => (1 - (y - FACE_Y0) / (FACE_Y1 - FACE_Y0)) * h;
      const kx = w / (2 * FACE_PHI * 0.078), ky = h / (FACE_Y1 - FACE_Y0);
      const female = variant === 2, smile = variant === 1;
      g.fillStyle = css(skin); g.fillRect(0, 0, w, h);
      const glow = (x, y, rx, ry, col) => {
        const cx = X(x, y), cy = Y(y), gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx * kx);
        gr.addColorStop(0, col); gr.addColorStop(1, rgb(skin, 1, 0));
        g.save(); g.translate(cx, cy); g.scale(1, (ry * ky) / (rx * kx)); g.translate(-cx, -cy);
        g.fillStyle = gr; g.fillRect(cx - rx * kx, cy - rx * kx, rx * kx * 2, rx * kx * 2); g.restore();
      };
      // painted light & shadow: forehead, nose bridge, cheekbones; darker eye area and philtrum
      glow(0, 1.652, 0.03, 0.016, rgb(skin, 1.32, 0.55));
      glow(0, 1.585, 0.008, 0.022, rgb(skin, 1.4, 0.6));
      for (const s of [-1, 1]) glow(s * 0.042, 1.572, 0.017, 0.012, rgb(skin, 1.28, 0.45));
      for (const s of [-1, 1]) glow(s * 0.031, 1.598, 0.021, 0.013, rgb(skin, 0.72, 0.6));
      glow(0, 1.545, 0.012, 0.006, rgb(skin, 0.8, 0.5));
      glow(0, 1.516, 0.012, 0.007, rgb(skin, 1.25, 0.4));
      // eyes
      for (const s of [-1, 1]) {
        const ex = X(s * 0.031, 1.598), ey = Y(1.598), ew = 0.0148 * kx, eh = (smile ? 0.0048 : 0.0062) * ky;
        g.beginPath(); g.ellipse(ex, ey, ew, eh, 0, 0, TAU); g.fillStyle = '#d4c8bc'; g.fill();
        g.save(); g.clip();
        circ(g, ex + s * -0.6, ey, 0.0064 * kx, '#2a170d'); circ(g, ex + s * -0.6, ey, 0.003 * kx, '#070403'); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(ex + s * -0.6 + 0.6, ey - 1.2, 1, 1);
        g.restore();
        g.strokeStyle = '#120a07'; g.lineWidth = female ? 1.4 : 1.0;
        g.beginPath(); g.ellipse(ex, ey + 0.3, ew * 1.05, eh * 1.1, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        // brows
        g.strokeStyle = '#140d0a'; g.lineWidth = female ? 0.9 : 1.6;
        g.beginPath();
        const bx0 = X(s * 0.013, 1.62), bx1 = X(s * 0.034, 1.627), bx2 = X(s * 0.05, 1.618);
        g.moveTo(bx0, Y(1.62)); g.quadraticCurveTo(bx1, Y(female ? 1.632 : 1.628), bx2, Y(female ? 1.616 : 1.62)); g.stroke();
      }
      // nose: alar shadow, nostrils, tip highlight
      for (const s of [-1, 1]) glow(s * 0.016, 1.562, 0.007, 0.007, rgb(skin, 0.75, 0.45));
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(s * 0.0105, 1.556), Y(1.556), 0.0042 * kx, 0.0024 * ky, s * 0.4, 0, TAU); g.fillStyle = rgb(skin, 0.5); g.fill(); }
      glow(0, 1.567, 0.007, 0.006, rgb(skin, 1.45, 0.55));
      // mouth
      const my = 1.532, mw = (female ? 0.023 : 0.025);
      const lx = X(-mw, my), rx = X(mw, my), cx = X(0, my), cy = Y(my);
      const up = smile ? -0.0035 * ky : 0;
      g.fillStyle = female ? '#5e262c' : rgb(skin, 0.66);                 // upper lip
      g.beginPath(); g.moveTo(lx, cy + up); g.quadraticCurveTo(cx, cy - (female ? 0.0085 : 0.0065) * ky, rx, cy + up); g.quadraticCurveTo(cx, cy + 0.6, lx, cy + up); g.fill();
      g.fillStyle = female ? '#8a474c' : rgb(0x7a4a44, Math.min(1.25, 0.55 + (skin >> 16) / 160));                  // lower lip, a bit pinker
      g.beginPath(); g.moveTo(lx, cy + up); g.quadraticCurveTo(cx, cy + (female ? 0.011 : 0.009) * ky, rx, cy + up); g.quadraticCurveTo(cx, cy + 0.6, lx, cy + up); g.fill();
      if (smile) {
        g.fillStyle = '#ece4d6';
        g.beginPath(); g.moveTo(lx + 1, cy + up); g.quadraticCurveTo(cx, cy + 0.0072 * ky, rx - 1, cy + up); g.quadraticCurveTo(cx, cy - 0.001 * ky, lx + 1, cy + up); g.fill();
      }
      g.strokeStyle = rgb(skin, 0.35); g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(lx, cy + up); g.quadraticCurveTo(cx, cy + (smile ? 0.004 * ky : 0.5), rx, cy + up); g.stroke();
    }
  }

  /* ---------------- the atlas: 512x256, 8x4 slots of 64px ----------------
     Each slot holds 56px of content inside a 4px wrapped border (limits mip bleeding).
     Slots 0-11 faces (skin x variant), then prints, jerseys, weave, cornrows. */
  const TILE_KEYS = [...PRINTS, ...JERSEYS, 'weave', 'rows'];
  function buildAtlas() {
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 64;
    const tg = tmp.getContext('2d');
    const tex = K.canvasTex(512, 256, (g) => {
      const slot = (k, draw, wrap, base) => {
        const x = (k % 8) * 64, y = (k >> 3) * 64;
        tg.clearRect(0, 0, 64, 64); draw(tg, 64, 64);
        const d = tg.getImageData(0, 0, 64, 64).data; let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4, flat = (Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(b / n);
        g.save(); g.beginPath(); g.rect(x, y, 64, 64); g.clip();
        if (base != null) { g.fillStyle = css(base); g.fillRect(x, y, 64, 64); }
        for (const dx of wrap ? [-1, 0, 1] : [0]) for (const dy of wrap ? [-1, 0, 1] : [0]) g.drawImage(tmp, x + 4 + dx * 56, y + 4 + dy * 56, 56, 56);
        g.restore();
        return flat;
      };
      SKINS.forEach((skin, si) => { for (let v = 0; v < 3; v++) slot(si * 3 + v, (c, w, h) => faceDraw(c, w, h, skin, v), false, skin); });
      TILE_KEYS.forEach((key, i) => { FLAT[key] = slot(12 + i, FABRIC[key], true); });
    });
    return { tex, mat: new THREE.MeshLambertMaterial({ map: tex }) };
  }
  // per-part UV remap into a slot, cached: 'fit' squeezes the whole UV range into the slot (jerseys),
  // otherwise each triangle keeps its own tile's fractional UVs (prints repeat by tiles)
  function atlasGeo(geo, spec) {
    const key = geo.uuid + '|' + spec.tile + (spec.fit ? 'f' : '');
    if (AG[key]) return AG[key];
    const g = geo.index ? geo.toNonIndexed() : geo.clone(), U = g.attributes.uv.array;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let k = 0; k < U.length; k += 2) { u0 = Math.min(u0, U[k]); u1 = Math.max(u1, U[k]); v0 = Math.min(v0, U[k + 1]); v1 = Math.max(v1, U[k + 1]); }
    const ox = (spec.tile % 8) * 64 + 4, oy = (spec.tile >> 3) * 64 + 4;
    for (let t = 0; t < U.length; t += 6) {
      let cu = 0, cv = 0;
      if (!spec.fit) { cu = Math.floor(Math.min(U[t], U[t + 2], U[t + 4]) + 1e-4); cv = Math.floor(Math.min(U[t + 1], U[t + 3], U[t + 5]) + 1e-4); }
      for (let k = t; k < t + 6; k += 2) {
        let lu = spec.fit ? (U[k] - u0) / (u1 - u0) : U[k] - cu, lv = spec.fit ? (U[k + 1] - v0) / (v1 - v0) : U[k + 1] - cv;
        if (lu > 1.001 || lv > 1.001) PEOPLE._atlasSpan = (PEOPLE._atlasSpan || 0) + 1;   // a triangle crossing a tile edge
        lu = Math.min(1, Math.max(0, lu)); lv = Math.min(1, Math.max(0, lv));
        U[k] = (ox + lu * 56) / 512; U[k + 1] = 1 - (oy + (1 - lv) * 56) / 256;
      }
    }
    return (AG[key] = g);
  }

  /* ---------------- materials ---------------- */
  const plain = hex => K.M(hex);
  // textured "materials" are slot specs; mesh() swaps in the atlas geometry + the one atlas material
  const fabric = key => SPEC[key] || (SPEC[key] = { tile: 12 + TILE_KEYS.indexOf(key), fit: key[0] === 'j', flat: FLAT[key] });
  const faceSpec = (skin, v) => SPEC['f' + skin + v] || (SPEC['f' + skin + v] = { tile: SKINS.indexOf(skin) * 3 + v, flat: skin });

  /* ---------------- make ---------------- */
  function init(kit) {
    K = kit;
    if (!GEO) GEO = buildGeo();
    if (!ATLAS) ATLAS = buildAtlas();
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const chance = p => Math.random() < p;
  const rand = (a, b) => a + Math.random() * (b - a);

  function make(kit, opt = {}) {
    init(kit);
    const G = GEO, cast = !!opt.cast;
    const role = opt.role || (opt.tray ? 'hawker' : 'passenger');
    const seated = role === 'rider' || role === 'driver';
    let female;
    if (opt.lappa) female = true;
    else if (role === 'hawker') female = chance(0.85);
    else if (role === 'vendor') female = chance(0.7);
    else if (role === 'apprentice' || role === 'driver' || opt.lappa === false && role === 'rider') female = false;
    else if (role === 'rider') female = chance(0.35);
    else female = opt.lappa === false ? chance(0.25) : chance(0.5);
    const lappa = !seated && female && (opt.lappa ?? (role === 'hawker' || role === 'vendor' ? chance(0.8) : chance(0.55)));
    const skin = pick(SKINS), skinM = plain(skin);

    /* --- outfit --- */
    let top, topMat, sleeve, bottom, botMat;
    const printKey = pick(PRINTS);
    if (opt.shirt != null) { top = 'tee'; topMat = plain(opt.shirt); }
    else if (role === 'apprentice' || role === 'rider' && !female) {
      top = chance(0.45) ? 'jersey' : chance(0.45) ? 'tank' : 'tee';
    } else if (female) top = chance(0.5) ? 'print' : 'tee';
    else top = role === 'vendor' && chance(0.5) ? 'kaftan' : pick(['tee', 'tee', 'jersey', 'print', 'tank']);
    if (!topMat) topMat = top === 'jersey' ? fabric(pick(JERSEYS)) : top === 'print' || top === 'kaftan' && chance(0.6) ? fabric(printKey) : plain(top === 'tank' && chance(0.6) ? 0xf2f2ee : pick(TEE));
    sleeve = top === 'tank' ? null : top === 'kaftan' || female && top === 'print' && chance(0.5) ? 'sleeveWide' : 'sleeve';
    if (lappa) { bottom = chance(0.25) && top === 'print' ? 'dress' : 'lappa'; botMat = bottom === 'dress' ? topMat : fabric(chance(0.7) ? pick(PRINTS.filter(p => p !== printKey)) : printKey); }
    else if (seated && female) { bottom = 'wrapLegs'; botMat = fabric(pick(PRINTS)); }
    else if (role === 'apprentice' ? chance(0.5) : !seated && !female && chance(0.18)) { bottom = 'shorts'; botMat = plain(pick(SHORTS)); }
    else { bottom = 'trousers'; botMat = plain(pick(PANTS)); }
    if (top === 'kaftan') bottom = 'trousers';
    const shoeM = plain(pick(SHOES));
    const slippers = bottom === 'lappa' || bottom === 'dress' || bottom === 'shorts' ? chance(0.75) : chance(0.3);
    let hair;
    if (female) {
      const tieP = role === 'hawker' ? 0.85 : role === 'vendor' ? 0.7 : 0.4;
      hair = opt.tray ? 'tieFlat' : chance(tieP) ? (chance(0.25) ? 'gele' : 'tie') : pick(['bob', 'braids', 'rows', 'rows', 'puff']);
      if (opt.tray && !chance(0.85)) hair = 'rows';
    } else hair = pick(['short', 'short', 'fade', 'fade', 'fade']);
    const hairMat = hair === 'rows' || hair === 'braids' ? fabric('rows') : hair === 'fade' ? plain(FADE) : hair === 'tie' || hair === 'gele' || hair === 'tieFlat' ? fabric(pick(PRINTS)) : plain(HAIR);
    const wantsCap = role === 'apprentice' ? chance(0.6) : !female && (role === 'driver' || role === 'rider' ? chance(0.3) : chance(0.18));
    let hat = null, hatMat = null;
    if (wantsCap && hair !== 'puff' && !opt.tray) { hat = role === 'apprentice' && chance(0.5) ? 'capBack' : 'cap'; hatMat = plain(pick(CAPS)); }
    else if (!female && role === 'vendor' && top === 'kaftan' && chance(0.7) && !opt.tray) { hat = 'kufi'; hatMat = plain(pick([0xf2f2ee, 0x7a1f2b, 0x1d1d1f])); }
    const height = female ? rand(1.6, 1.74) : rand(1.66, 1.85);
    const wide = rand(0.92, 1.12) * (role === 'vendor' && female ? 1.08 : 1);
    if ((opt.lod ?? PEOPLE.lodDefault ?? 'high') === 'low')
      return makeLow({ opt, role, seated, female, skin, top, topMat, sleeve, bottom, botMat, hair, hairMat, hat, hatMat, height, wide, cast });

    /* --- hierarchy --- */
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    body.scale.setScalar(height / 1.735);
    const mesh = (parent, geo, mat, x = 0, y = 0, z = 0) => {
      if (mat.tile != null) { geo = atlasGeo(geo, mat); mat = ATLAS.mat; }
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      if (cast) m.castShadow = true;
      parent.add(m); return m;
    };

    // hips / skirt
    if (bottom === 'lappa' || bottom === 'dress') {
      const sk = mesh(body, G.skirt, botMat, 0, 1.0, 0); sk.scale.set(wide, bottom === 'dress' ? rand(0.6, 0.8) : 1, wide);
    } else mesh(body, female ? G.pelvisF : G.pelvisM, botMat).scale.set(wide, 1, wide);
    if (top === 'kaftan') mesh(body, G.skirt, topMat, 0, 1.0, 0).scale.set(wide * 1.04, rand(0.5, 0.62), wide * 1.08);

    // legs
    const legs = [-1, 1].map(s => {
      const lg = new THREE.Group(); lg.position.set(s * 0.08 * wide, 0.88, 0); body.add(lg);
      const S = seated ? 'Seat' : '';
      if (bottom === 'trousers' || bottom === 'wrapLegs') mesh(lg, G['trouser' + S], botMat);
      else mesh(lg, G['legBare' + S], skinM);
      if (bottom === 'shorts') mesh(lg, G['shorts' + S], botMat);
      if (bottom === 'trousers' || bottom === 'wrapLegs' || !slippers) mesh(lg, G['shoe' + S], slippers ? plain(0x3a2a20) : shoeM);
      if (!seated) lg.rotation.z = s * 0.025;
      return lg;
    });

    // upper body (pivots at the waist so riders/apprentices can lean)
    const upper = new THREE.Group(); upper.position.y = 0.95; body.add(upper);
    mesh(upper, female ? G.torsoF : G.torsoM, topMat, 0, -0.95, 0).scale.set(wide, 1, wide);

    // arms: children of the root (not of the leaning upper body) so engine / vehicle code can
    // set armL/armR.position in person space; shoulder placed after the lean is known (see pose)
    const sx = (female ? 0.168 : 0.188) * wide, sy = female ? 1.385 : 1.40;
    const arms = [-1, 1].map(s => {
      const ag = new THREE.Group(); g.add(ag);
      mesh(ag, G.arm, skinM);
      if (sleeve) mesh(ag, G[sleeve], topMat);
      ag.rotation.z = s * rand(0.06, 0.12);
      return ag;
    });

    // head
    const head = new THREE.Group(); head.position.y = -0.95; upper.add(head);
    mesh(head, G.head, skinM);
    const faceV = female ? 2 : chance(0.4) ? 1 : 0;
    mesh(head, G.face, faceSpec(skin, faceV));
    mesh(head, G[hair], hairMat);
    const top_y = TOPY[hair] || 1.748;
    if (hat) mesh(head, G[hat === 'kufi' ? 'kufi' : 'cap'], hatMat).rotation.y = hat === 'capBack' ? Math.PI : 0;   // apprentices wear it backwards
    head.rotation.y = rand(-0.25, 0.25);

    // head load
    if (opt.tray) {
      const tray = new THREE.Group(); tray.position.set(0, top_y - 0.004, 0); tray.rotation.y = rand(0, TAU); head.add(tray);
      const b = pick(BASINS);
      mesh(tray, G.basin, b === 'weave' ? fabric('weave') : plain(b));
      const kind = pick(['fruit', 'fruit', 'bags', 'bottles']);
      mesh(tray, G.goods[kind], plain(pick(GOODS[kind])));
    }
    // apprentice towel
    if (role === 'apprentice' && chance(0.55)) mesh(upper, G.towel, plain(pick(TOWELS)), 0, -0.95, 0).scale.set(wide, 1, wide);

    /* --- pose --- */
    if (seated) {
      upper.rotation.x = role === 'rider' ? 0.2 : 0.08;
      for (const a of arms) { a.rotation.x = role === 'rider' ? -1.05 : -1.2; a.rotation.z *= 1.6; }
    } else if (role === 'apprentice') {
      upper.rotation.x = 0.05;
    }

    const sc = height / 1.735, lean = upper.rotation.x, dy = sy - 0.95;
    arms.forEach((a, k) => { a.scale.setScalar(sc); a.position.set((k ? 1 : -1) * sx * sc, (0.95 + dy * Math.cos(lean)) * sc, dy * Math.sin(lean) * sc); });
    Object.assign(g.userData, {
      armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], body, upper, head,
      role, female, seated, height,
      stride: bottom === 'lappa' || bottom === 'dress' ? 0.24 : opt.tray ? 0.32 : 0.45,
      phase: rand(0, TAU),
      seatY: seated ? 0.81 * sc : undefined, footY: seated ? 0.44 * sc : 0,
    });
    return g;
  }

  const TOPY = { tieFlat: 1.778, puff: 1.775, tie: 1.81, gele: 1.86 };

  /* ---------------- low LOD (background crowds, 15-40 m) ----------------
     <= 4 meshes: skin (head + arms [+ shins]), top (torso [+ sleeves]),
     bottom (legs or skirt), and one head item (hair / tie / cap / load).
     Same outfit choices as the high LOD; colour-only (a print becomes its mean colour), no face. */
  const LOW = {}, LX = 1.12;
  const lowGeo = (key, f) => LOW[key] || (LOW[key] = f());
  const sq = (k) => (x, y, z) => [x * k, y, z * k];             // compensate thin low-segment cross-sections
  function lowArm(s, female, seat, P, segs, k) {
    const g = lathe(P, segs, { ph: Math.PI / segs, def: sq(k) });
    g.rotateZ(s * (seat ? 0.15 : 0.09)); if (seat) g.rotateX(-1.1);
    return g.translate(s * (female ? 0.168 : 0.188), female ? 1.385 : 1.40, 0);
  }
  function lowLeg(s, P, seat) {
    let g = lathe(P, 4, { ph: Math.PI / 4, def: sq(1.25) });
    if (seat) g = seatBend(g);
    return g.translate(s * 0.08, 0.88, 0);
  }
  function lowShell(style) {
    const D = {
      short: [hairline, (p, v) => 0.011 + 0.006 * v], fade: [hairline, () => 0.008],
      puff: [phi => hairline(phi) - 0.004, (p, v) => 0.013 + 0.026 * v], rows: [hairline, () => 0.01],
      bob: [phi => lerp(1.664, 1.518, ss(0.8, 1.3, Math.abs(phi))), (p, v) => 0.015 + 0.02 * (1 - v), { drop: true }],
      braids: [phi => { const a = Math.abs(phi); return lerp(1.668, lerp(1.50, 1.40, ss(1.6, 2.6, a)), ss(0.9, 1.4, a)); }, (p, v) => 0.013 + 0.01 * (1 - v), { drop: true }],
      tie: [tieLine, (p, v) => 0.014 + 0.045 * v, { up: 0.03, bk: 0.03 }], gele: [tieLine, (p, v) => 0.014 + 0.07 * v, { up: 0.07, bk: 0.015 }],
      tieFlat: [tieLine, (p, v) => 0.014 + 0.02 * v, { up: 0.012, bk: 0 }],
      kufi: [phi => 1.652 + 0.006 * Math.cos(phi), () => 0.015], cap: [phi => 1.638 + 0.009 * Math.cos(phi), () => 0.016],
    }[style];
    const o = D[2] || {};
    const g = shell(D[0], D[1], {
      segs: 6, rows: o.drop ? 3 : 2, drop: o.drop, uS: style === 'tie' || style === 'gele' || style === 'tieFlat' ? 2 : 4,
      post: (p, phi, v) => { if (o.up != null) { p[1] += o.up * v * v; p[2] -= o.bk * v * v; } p[0] *= LX; return p; },
    });
    if (style !== 'cap') return g;
    const visor = grid(3, 1, (i, j) => {
      const a = (i / 3 - 0.5) * Math.PI * 0.9, h = follow(a, 1.638 + 0.009 * Math.cos(a), 0);
      const len = 0.075 * Math.max(0, Math.cos(a)) ** 0.6;
      return [(h[0] * 1.1 + Math.sin(a) * len * 0.3 * j) * LX, h[1] + 0.002 - 0.014 * j, h[2] * 1.1 + len * j];
    });
    return merge([g, visor]);
  }
  const lowSkirt = () => lathe([[-0.93, 0.17], [-0.3, 0.186], [-0.1, 0.19], [0, 0.15]], 6, {
    zs: 0.8, def: (x, y, z) => [x * 1.15, y, z], uv: (u, y) => [u * 5, (y + 0.93) / 0.93 * 4] });
  function makeLow(o) {
    init(K);
    const { opt, role, seated, female, skin, top, topMat, sleeve, bottom, botMat, hair, hairMat, hat, hatMat, height, wide, cast } = o;
    const F = female ? 'F' : 'M', S = seated ? 'S' : '', sc = height / 1.735;
    const bare = bottom === 'shorts';
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.scale.setScalar(sc);
    const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat.tile != null ? plain(mat.flat) : mat); if (cast) m.castShadow = true; body.add(m); return m; };
    // 1. skin: head + arms (+ shins under shorts)
    mesh(lowGeo('skin' + F + S + (bare ? 'b' : ''), () => {
      const yl = [1.42, 1.505, 1.60, 1.685, 1.735];
      const head = grid(6, 4, (i, j) => { const p = headPos((i / 6 - 0.5) * TAU, yl[j]); p[0] *= LX; return p; });
      const armP = [[-0.68, 0.03], [-0.3, 0.037], [0.03, 0.05]];
      const parts = [head, lowArm(-1, female, seated, armP, 3, 1.4), lowArm(1, female, seated, armP, 3, 1.4)];
      if (bare) for (const s of [-1, 1]) parts.push(lowLeg(s, [[-0.87, 0.045], [-0.36, 0.052]], seated));
      return merge(parts);
    }), plain(skin));
    // 2. top: torso (+ short sleeves), shirt hangs over the hips
    mesh(lowGeo('torso' + F + S + (sleeve ? 's' : ''), () => {
      const P = female ? [[0.84, 0.165], [1.02, 0.132], [1.26, 0.158], [1.42, 0.14], [1.455, 0.05]]
        : [[0.84, 0.155], [1.32, 0.176], [1.42, 0.152], [1.47, 0.055]];
      const parts = [lathe(P, 6, { zs: female ? 0.66 : 0.62, def: (x, y, z) => [x * 1.15, y, z], uv: (u, y) => [u * 4, (y - 0.94) / 0.53 * 2] })];
      if (sleeve) for (const s of [-1, 1]) parts.push(lowArm(s, female, seated, [[-0.17, 0.057], [0.035, 0.05]], 4, 1.25));
      return merge(parts);
    }), topMat).scale.set(wide, 1, wide);
    // 3. bottom: legs or skirt (a kaftan reads fine as the tunic-length top over trousers)
    if (bottom === 'lappa' || bottom === 'dress') {
      const sk = mesh(lowGeo('skirt', lowSkirt), botMat);
      sk.position.y = 1.0; sk.scale.set(wide, bottom === 'dress' ? 0.7 : 1, wide);
    } else {
      mesh(lowGeo('legs' + S + (bare ? 'b' : ''), () => merge([-1, 1].map(s => lowLeg(s, bare ? [[-0.38, 0.083], [0.06, 0.09]]
        : [[-0.87, 0.056], [-0.45, 0.062], [0.06, 0.088]], seated)))), botMat).scale.set(wide, 1, 1);
    }
    // 4. one head item: load > hat > hair
    if (opt.tray) {
      const kind = pick(['fruit', 'fruit', 'bags', 'bottles']), b = pick(BASINS);
      const t = mesh(lowGeo('tray', () => lathe([[0, 0], [0.085, 0.24], [0.13, 0.14], [0.16, 0]], 6)),
        kind === 'fruit' ? plain(pick(GOODS.fruit)) : b === 'weave' ? fabric('weave') : plain(b));
      t.position.y = 1.745;
    } else if (hat) {
      const h = mesh(lowGeo('h_' + (hat === 'kufi' ? 'kufi' : 'cap'), () => lowShell(hat === 'kufi' ? 'kufi' : 'cap')), hatMat);
      if (hat === 'capBack') h.rotation.y = Math.PI;
    } else mesh(lowGeo('h_' + hair, () => lowShell(hair)), hairMat);
    // engine-facing pivots (dummies: arms/legs are merged)
    const sx = (female ? 0.168 : 0.188) * wide * sc, sy = (female ? 1.385 : 1.40) * sc;
    const armL = new THREE.Object3D(), armR = new THREE.Object3D(), legL = new THREE.Object3D(), legR = new THREE.Object3D();
    armL.position.set(-sx, sy, 0); armR.position.set(sx, sy, 0); g.add(armL, armR);
    legL.position.set(-0.08, 0.88, 0); legR.position.set(0.08, 0.88, 0); body.add(legL, legR);
    Object.assign(g.userData, {
      armL, armR, legL, legR, body, upper: body, head: body, lod: 'low',
      role, female, seated, height, stride: 0, phase: rand(0, TAU),
      seatY: seated ? 0.81 * sc : undefined, footY: seated ? 0.44 * sc : 0,
    });
    return g;
  }

  // simple walk cycle: legs swing at the hip, arms counter-swing, slight bob
  function walk(person, t) {
    const u = person.userData;
    if (!u.legL || u.seated) return;
    const ph = t * 6.5 + u.phase, s = Math.sin(ph), st = u.stride;
    u.legL.rotation.x = s * st; u.legR.rotation.x = -s * st;
    u.armL.rotation.x = -s * st * 0.75; u.armR.rotation.x = s * st * 0.75;
    const bob = Math.abs(Math.cos(ph)) * 0.022;
    u.armL.position.y += bob - u.body.position.y; u.armR.position.y += bob - u.body.position.y;
    u.body.position.y = bob;
  }

  PEOPLE.make = make;
  if (PEOPLE.lodDefault === undefined) PEOPLE.lodDefault = null;   // engine sets 'low' while filling chunks
  PEOPLE.walk = walk;
})();
