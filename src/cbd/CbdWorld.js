/* Freetown CBD scenery, built once at boot from src/cbd/data/cbd-data.json.

   Everything here is static and sits in real plan coordinates (x east, z
   south, metres from the OSM Cotton Tree node). Geometry is merged per
   material into a few meshes per 200 m tile so the whole CBD costs a few dozen
   draw calls, and tiles outside the view frustum are culled by Three.js.

   What is surveyed and what is estimated is kept explicit:
   - road alignment, junction positions, footprints: OpenStreetMap
   - building heights: estimated (no CBD footprint in OSM carries levels)
   - landmark massing/colour: see docs/cbd/05-landmark-inventory.md */
import { LANDMARKS, buildLandmark } from './landmarks.js';

const TILE = 100;                    // metres; small enough that shadow and frustum culling skip most of the CBD
const FLOOR_H = 3.2, SHOP_H = 3.6;

/* Deterministic per-footprint randomness, so the CBD is identical every run. */
function hashRandom(id) {
  let s = (id % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/* Estimated storeys. The distribution is a judgement from street photography of
   the CBD (docs/cbd/06): mostly two to four storeys, a scattering of mid-rise
   blocks, more height on large plots. Every value is an estimate. */
function estimateLevels(b, area, rnd) {
  if (b.levels) return b.levels;
  if (b.height) return Math.max(1, Math.round(b.height / FLOOR_H));
  const r = rnd();
  let levels = r < 0.12 ? 1 : r < 0.42 ? 2 : r < 0.72 ? 3 : r < 0.88 ? 4 : r < 0.96 ? 5 : 6;
  if (area > 400 && rnd() < 0.5) levels += 2;
  if (area < 25) levels = Math.min(levels, 2);               // kiosks, sheds and lean-tos
  return levels;
}

/* ---------- merged-geometry builder ---------- */
function createBuilder(THREE) {
  const buckets = new Map();
  const bucket = key => {
    if (!buckets.has(key)) buckets.set(key, { pos: [], nor: [], uv: [], col: [] });
    return buckets.get(key);
  };
  const colour = new THREE.Color();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
  /** One triangle; winding is fixed up so its front faces the given normal. */
  function tri(key, A, B, C, uvA, uvB, uvC, col, normal) {
    const b = bucket(key);
    _a.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]); _b.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
    _n.crossVectors(_a, _b);
    if (normal && _n.dot(_c.set(...normal)) < 0) { [B, C] = [C, B]; [uvB, uvC] = [uvC, uvB]; }
    const n = normal ? _c.set(...normal).normalize() : _n.normalize();
    colour.set(col).convertSRGBToLinear();
    for (const [p, uv] of [[A, uvA], [B, uvB], [C, uvC]]) {
      b.pos.push(p[0], p[1], p[2]); b.nor.push(n.x, n.y, n.z);
      b.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0); b.col.push(colour.r, colour.g, colour.b);
    }
  }
  function quad(key, A, B, C, D, uv, col, normal) {          // A B C D around the face
    uv = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    tri(key, A, B, C, uv[0], uv[1], uv[2], col, normal);
    tri(key, A, C, D, uv[0], uv[2], uv[3], col, normal);
  }
  /** Axis box rotated by yaw about y, centred at (x, y, z). */
  function box(key, x, y, z, w, h, d, yaw, col) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];
    const hx = w / 2, hy = h / 2, hz = d / 2;
    const v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const N = (dx, dy, dz) => [dx * c + dz * s, dy, -dx * s + dz * c];
    quad(key, v[0], v[1], v[2], v[3], null, col, N(0, 0, -1));
    quad(key, v[5], v[4], v[7], v[6], null, col, N(0, 0, 1));
    quad(key, v[4], v[0], v[3], v[7], null, col, N(-1, 0, 0));
    quad(key, v[1], v[5], v[6], v[2], null, col, N(1, 0, 0));
    quad(key, v[3], v[2], v[6], v[7], null, col, N(0, 1, 0));
    quad(key, v[4], v[5], v[1], v[0], null, col, N(0, -1, 0));
  }
  /** Append any BufferGeometry (e.g. a cylinder) transformed by matrix. */
  function geometry(key, geo, matrix, col) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const b = bucket(key);
    colour.set(col).convertSRGBToLinear();
    for (let i = 0; i < P.count; i++) {
      b.pos.push(P.getX(i), P.getY(i), P.getZ(i)); b.nor.push(N.getX(i), N.getY(i), N.getZ(i));
      b.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); b.col.push(colour.r, colour.g, colour.b);
    }
    g.dispose();
  }
  function build(materials, parent, { cast = false, receive = true } = {}) {
    const meshes = [];
    for (const [key, b] of buckets) {
      if (!b.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, materials[key.split(':')[0]]);
      mesh.castShadow = cast && key !== 'road'; mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      parent.add(mesh); meshes.push(mesh);
    }
    buckets.clear();
    return meshes;
  }
  return { tri, quad, box, geometry, build };
}

/* ---------- façade textures (original artwork, drawn at boot) ---------- */
const SHOP_NAMES = ['JALLOH & SONS ENT.', 'GOD IS GOOD PHARMACY', 'SWEET SALONE PROVISIONS', 'KAMARA ELECTRICALS', 'BLESSED HARDWARE', 'FINE FINE FASHION', 'MAMA KADI COOL ROOM', 'NEVER DISCOURAGE PHONES', 'SESAY STATIONERY', 'TRUST IN GOD TAILORING', 'KOROMA BUREAU', 'SALONE BOOKSHOP'];
function makeTextures(kit) {
  const { canvasTex, fitText } = kit;
  // Upper floors: one 4 m bay × one storey. Light background so the vertex colour paints the wall.
  const windows = canvasTex(256, 205, (g, w, h) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,60,50,.18)'; g.fillRect(0, h - 10, w, 10);                   // slab line
    const wx = 58, wy = 46, ww = 140, wh = 104;
    g.fillStyle = 'rgba(60,50,40,.22)'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);    // reveal
    g.fillStyle = '#27323a'; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = 'rgba(160,190,200,.35)'; g.fillRect(wx + 8, wy + 8, ww / 2 - 12, wh - 16);
    for (let y = wy + 6; y < wy + wh - 4; y += 9) { g.fillStyle = 'rgba(210,205,190,.55)'; g.fillRect(wx + ww / 2 + 4, y, ww / 2 - 10, 4); } // louvres
    g.fillStyle = 'rgba(70,55,40,.35)';
    for (let i = 0; i < 6; i++) g.fillRect(wx + 10 + Math.random() * (ww - 20), wy + wh + 6, 2 + Math.random() * 3, 20 + Math.random() * 40); // rain streaks
    g.fillStyle = '#d9d4c8'; g.fillRect(wx - 10, wy + wh, ww + 20, 8);                    // sill
  });
  windows.wrapS = windows.wrapT = kit.THREE.RepeatWrapping;
  // Ground floors: an atlas of 8 shop bays (4 m × 3.6 m each), 4 columns × 2 rows.
  const COLS = 4, ROWS = 2, CW = 256, CH = 230;
  const shops = canvasTex(CW * COLS, CH * ROWS, (g) => {
    const boards = [['#1e6e55', '#fff6df'], ['#215b82', '#ffffff'], ['#b8892a', '#1d2a2e'], ['#a3401f', '#fff6df'], ['#f1e8d2', '#1d2a2e'], ['#3f5ea8', '#ffffff'], ['#6e456c', '#ffd25e'], ['#2f6a3a', '#ffffff']];
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
      g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CW, CH); g.clip();
      g.fillStyle = '#ece6d8'; g.fillRect(0, 0, CW, CH);
      const [bg, fg] = boards[i];
      g.fillStyle = bg; g.fillRect(8, 10, CW - 16, 48);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, SHOP_NAMES[i], CW - 30, 26, 'Bungee, Impact, sans-serif'); g.fillText(SHOP_NAMES[i], CW / 2, 35);
      const open = i % 3 !== 2;
      if (open) {
        g.fillStyle = '#1d1a17'; g.fillRect(24, 70, CW - 48, CH - 70);
        const goods = ['#d8333a', '#ffc23d', '#1eb53a', '#0072c6', '#f2f2f2', '#ff7a29'];
        g.fillStyle = '#3a2f26'; for (const sy of [118, 166]) g.fillRect(28, sy, CW - 56, 5);                       // shelving
        for (let k = 0; k < 18; k++) { g.fillStyle = goods[(k + i) % goods.length]; g.globalAlpha = 0.55; g.fillRect(32 + (k % 9) * ((CW - 70) / 9), (k < 9 ? 96 : 144), (CW - 90) / 10, 20); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(120,120,115,.9)'; g.fillRect(24, 64, CW - 48, 14);              // rolled-up shutter
      } else {
        g.fillStyle = '#8f9396'; g.fillRect(24, 64, CW - 48, CH - 64);
        for (let yy = 70; yy < CH; yy += 7) { g.fillStyle = 'rgba(40,40,40,.35)'; g.fillRect(24, yy, CW - 48, 2); }
      }
      g.fillStyle = 'rgba(40,30,20,.22)'; g.fillRect(0, CH - 12, CW, 12);                 // splash grime at the kerb
      g.restore();
    }
  });
  return { windows, shops, shopCells: { COLS, ROWS } };
}

/* ---------- world ---------- */
export function createCbdWorld({ THREE, kit, data, route, textures: baseTex, bake }) {
  const group = new THREE.Group();
  group.name = 'cbd-world';
  const B = createBuilder(THREE);
  const tex = makeTextures(kit);
  const clone = t => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(1, 1); c.offset.set(0, 0); return c; };
  const roadMap = clone(baseTex.road), roadDetail = clone(baseTex.roadDetail), walkMap = clone(baseTex.walk);
  const materials = {
    road: new THREE.MeshStandardMaterial({ map: roadMap, bumpMap: roadDetail, bumpScale: 0.05, roughnessMap: roadDetail, roughness: 0.9, metalness: 0, vertexColors: true }),
    walk: new THREE.MeshStandardMaterial({ map: walkMap, roughness: 1, vertexColors: true }),
    vc: new THREE.MeshLambertMaterial({ vertexColors: true }),
    win: new THREE.MeshLambertMaterial({ map: tex.windows, vertexColors: true }),
    shop: new THREE.MeshLambertMaterial({ map: tex.shops, vertexColors: true }),
  };
  const { path } = route;
  const RH = 3.4 * 1.5 + 0.35;                               // ROAD_HALF, as main.js
  const stats = { buildings: 0, moved: 0, dropped: 0, maxShift: 0, shifts: [], landmarks: [] };

  /* --- 1. ground and sea --- */
  const xs = data.route.points.map(p => p[0]), zs = data.route.points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(maxX-minX+1200, maxZ-minZ+1200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: new THREE.Color(0x8f8474).convertSRGBToLinear() }));   // dusty concrete and compacted laterite
  ground.position.set((minX+maxX)/2, -0.04, (minZ+maxZ)/2); ground.receiveShadow = true; group.add(ground);
  const coast = [];
  for (const line of data.coast) for (const p of line) if (!coast.length || coast.at(-1)[0] !== p[0] || coast.at(-1)[1] !== p[1]) coast.push(p);
  if (coast.length > 2) {
    const shape = new THREE.Shape();
    shape.moveTo(coast[0][0], -coast[0][1]);
    for (const p of coast) shape.lineTo(p[0], -p[1]);
    shape.lineTo(coast.at(-1)[0], 4000); shape.lineTo(coast[0][0], 4000); shape.closePath();
    const sea = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: new THREE.Color(0x3f7f93).convertSRGBToLinear() }));
    sea.position.y = 0.02; group.add(sea);
  }

  /* --- 2. the loop: carriageway, drains, kerbs, footways --- */
  // Footway gaps where real side streets open onto the loop.
  const gaps = [];
  for (const st of data.sideStreets) {
    if (st.name === 'Wallace Johnson Street') continue;       // the other carriageway of the dual section
    const a = st.points[0], b = st.points[Math.min(2, st.points.length - 1)];
    const n = route.lateral(a[0], a[1]);
    const far = route.lateral(b[0], b[1]);
    if (!n || !far) continue;
    gaps.push({ s: path.nearest(a[0], a[1]).s, side: Math.sign(far.offset) || 1, half: 5.5 });
  }
  const inGap = (s, side) => gaps.some(g => g.side === side && (path.closed ? Math.abs(path.wrap(s - g.s + path.length / 2) - path.length / 2) : Math.abs(s-g.s)) < g.half);
  const f0 = {}, f1 = {};
  const STEP = path.closed ? 1.5 : 2.5;
  for (let s = 0; s < path.length; s += STEP) {
    const s1 = Math.min(s + STEP, path.length);
    path.frameAt(s, f0); path.frameAt(s1, f1);
    const at = (f, x, y) => [f.x - f.dz * x, y, f.z + f.dx * x];
    const quad = (material, ...args) => B.quad(`${material}:road-${Math.floor(s / 150)}`, ...args);
    const v0 = s / 20, v1 = s1 / 20;
    quad('road', at(f0, -RH, 0), at(f0, RH, 0), at(f1, RH, 0), at(f1, -RH, 0), [[0, v0], [1, v0], [1, v1], [0, v1]], 0xffffff, [0, 1, 0]);
    for (const side of [-1, 1]) {
      const gap = inGap(s, side);
      const x0 = side * RH, x1 = side * (RH + 0.36), x2 = side * (RH + 0.36 + 2.64);
      quad('vc', at(f0, x0, 0.02), at(f0, x1, 0.02), at(f1, x1, 0.02), at(f1, x0, 0.02), null, 0x343a36, [0, 1, 0]);
      if (gap) {
        quad('road', at(f0, x1, 0), at(f0, x2 + side * 2, 0), at(f1, x2 + side * 2, 0), at(f1, x1, 0), [[0, v0], [1, v0], [1, v1], [0, v1]], 0xffffff, [0, 1, 0]);
        continue;
      }
      quad('vc', at(f0, x0, 0), at(f1, x0, 0), at(f1, x0, 0.22), at(f0, x0, 0.22), null, 0x89867b, [f0.dz * side, 0, -f0.dx * side]);
      quad('vc', at(f0, x0, 0.22), at(f0, x0 + side * 0.12, 0.22), at(f1, x0 + side * 0.12, 0.22), at(f1, x0, 0.22), null, 0x9a978b, [0, 1, 0]);
      quad('walk', at(f0, x1, 0.2), at(f0, x2, 0.2), at(f1, x2, 0.2), at(f1, x1, 0.2), [[0, s / 4], [1, s / 4], [1, s1 / 4], [0, s1 / 4]], 0xffffff, [0, 1, 0]);
      quad('vc', at(f0, x1, 0.02), at(f1, x1, 0.02), at(f1, x1, 0.2), at(f0, x1, 0.2), null, 0x75766b, [-f0.dz * side, 0, f0.dx * side]);
      // Paved forecourt behind the footway: CBD frontages meet hard standing, not bare ground.
      quad('vc', at(f0, x2, 0.012), at(f0, x2 + side * 14, 0.012), at(f1, x2 + side * 14, 0.012), at(f1, x2, 0.012), null, 0xa29b8c, [0, 1, 0]);
    }
  }
  // The undriven quarter of the roundabout ring, so the junction reads as a full circle.
  for (const rb of data.roundabouts || [data.roundabout]) {
    for (let i = 0; i < rb.points.length; i++) {
      const a = rb.points[i], b = rb.points[(i + 1) % rb.points.length];
      const out = p => { const dx = p[0] - rb.centre[0], dz = p[1] - rb.centre[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; };
      const na = out(a), nb = out(b);
      B.quad('road', [a[0] - na[0] * RH, -0.006, a[1] - na[1] * RH], [a[0] + na[0] * RH, -0.006, a[1] + na[1] * RH], [b[0] + nb[0] * RH, -0.006, b[1] + nb[1] * RH], [b[0] - nb[0] * RH, -0.006, b[1] - nb[1] * RH], [[0, 0], [1, 0], [1, 1], [0, 1]], 0xffffff, [0, 1, 0]);
    }
  }
  /* Side-street stubs: real OSM alignment, width estimated (7 m) — none of these
     streets carries a width tag. They sit a hair below the loop's surface. */
  for (const st of data.sideStreets) {
    if (st.name === 'Wallace Johnson Street') continue;
    const half = st.highway === 'primary' || st.highway === 'secondary' ? 4.2 : 3.5;
    for (let i = 0; i < st.points.length - 1; i++) {
      const a = st.points[i], b = st.points[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 0.2) continue;
      const nx = -dz / l, nz = dx / l;
      B.quad('road', [a[0] + nx * half, -0.012, a[1] + nz * half], [a[0] - nx * half, -0.012, a[1] - nz * half], [b[0] - nx * half, -0.012, b[1] - nz * half], [b[0] + nx * half, -0.012, b[1] + nz * half], [[0, 0], [1, 0], [1, l / 20], [0, l / 20]], 0xe8e8e8, [0, 1, 0]);
      for (const side of [-1, 1]) {
        for (const { pts, from, to } of route.sideFootway(a, b, half, side)) {
          B.quad('walk', ...pts.map(([x, z]) => [x, 0.18, z]), [[0, from / 4], [1, from / 4], [1, to / 4], [0, to / 4]], 0xffffff, [0, 1, 0]);
        }
      }
    }
  }
  B.build(materials, group, { receive: true });

  /* --- 3. buildings from footprints --- */
  const landmarkIds = new Set(LANDMARKS.flatMap(l => l.osmWays || []));
  const tiles = new Map();
  const tileOf = (x, z) => Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
  const WALLS = [0xf1e9d6, 0xe8d9b0, 0xf3f1ea, 0xd9cdb5, 0xc9d6d3, 0xe7c9a6, 0xf0dca0, 0xd7b9a2, 0xbfcbd8, 0xe9e2cf];
  const ZINC = [0x8a8f91, 0x9a7a63, 0x716a5e, 0x7f4a32, 0x6e7276];
  const area = pts => Math.abs(pts.reduce((s, a, i) => { const b = pts[(i + 1) % pts.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
  const shopsPerRow = tex.shopCells.COLS, shopRows = tex.shopCells.ROWS;
  function extrude(key, pts, y0, y1, col, uvMode, rnd) {
    const signed = pts.reduce((s, a, i) => { const b = pts[(i + 1) % pts.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez);
      if (len < 0.05) continue;
      const n = signed > 0 ? [ez / len, 0, -ex / len] : [-ez / len, 0, ex / len];
      // Seen from outside, texture u must run left→right: along up × n = (nz, 0, -nx).
      const flip = ex * n[2] - ez * n[0] < 0;
      if (uvMode === 'shop') {
        // Faces that look onto the loop get shop bays; the rest a plain plinth.
        const mid = route.lateral((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        const facing = mid && mid.distance < 28 && (n[0] * -mid.nx * Math.sign(mid.offset) + n[2] * -mid.nz * Math.sign(mid.offset)) > 0.4;
        if (facing) {
          const bays = Math.max(1, Math.round(len / 4));
          for (let k = 0; k < bays; k++) {
            const t0 = k / bays, t1 = (k + 1) / bays, cell = Math.floor(rnd() * shopsPerRow * shopRows);
            let u0 = (cell % shopsPerRow) / shopsPerRow, u1 = u0 + 1 / shopsPerRow;
            if (flip) [u0, u1] = [u1, u0];
            const v1 = 1 - Math.floor(cell / shopsPerRow) / shopRows, v0 = v1 - 1 / shopRows;
            const P = (t, y) => [a[0] + ex * t, y, a[1] + ez * t];
            B.quad(key.replace('win', 'shop'), P(t0, y0), P(t1, y0), P(t1, y1), P(t0, y1), [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 0xffffff, n);
          }
          continue;
        }
      }
      const u0 = flip ? len / 4 : 0, u1 = flip ? 0 : len / 4, v0 = uvMode === 'plain' ? 0.02 : (y0 - SHOP_H) / FLOOR_H, v1 = uvMode === 'plain' ? 0.04 : (y1 - SHOP_H) / FLOOR_H;
      B.quad(key, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], col, n);
    }
  }
  function roofCap(key, pts, y, col) {
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [i, j, k] of tris) B.tri(key, [pts[i][0], y, pts[i][1]], [pts[j][0], y, pts[j][1]], [pts[k][0], y, pts[k][1]], null, null, null, col, [0, 1, 0]);
  }
  function hipRoof(key, pts, y, rise, col) {
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    const inner = pts.map(p => [c[0] + (p[0] - c[0]) * 0.35, c[1] + (p[1] - c[1]) * 0.35]);
    const over = pts.map(p => [c[0] + (p[0] - c[0]) * 1.06, c[1] + (p[1] - c[1]) * 1.06]);
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const A = [over[i][0], y, over[i][1]], Bp = [over[j][0], y, over[j][1]], C = [inner[j][0], y + rise, inner[j][1]], D = [inner[i][0], y + rise, inner[i][1]];
      const ex = Bp[0] - A[0], ez = Bp[2] - A[2], mx = (A[0] + Bp[0]) / 2 - c[0], mz = (A[2] + Bp[2]) / 2 - c[1];
      const out = Math.sign(ez * mx - ex * mz) || 1;
      const normal = [ez * out, Math.hypot(ex, ez) * 0.6, -ex * out];
      if (mx * normal[0] + mz * normal[2] < 0) { normal[0] *= -1; normal[2] *= -1; }
      B.quad(key, A, Bp, C, D, null, col, normal);
    }
    roofCap(key, inner, y + rise, col);
  }
  const buildingOut = [];
  for (const b of data.buildings) {
    if (landmarkIds.has(b.id)) continue;
    const fit = route.fitFootprint(b.pts);
    if (fit.dropped) { stats.dropped++; continue; }
    if (fit.shift > 0) { stats.moved++; stats.shifts.push(fit.shift); stats.maxShift = Math.max(stats.maxShift, fit.shift); }
    const pts = fit.pts, rnd = hashRandom(b.id), a = area(pts);
    const levels = estimateLevels(b, a, rnd);
    const top = levels === 1 ? 3.4 : SHOP_H + (levels - 1) * FLOOR_H;
    const wall = WALLS[Math.floor(rnd() * WALLS.length)];
    const c = pts.reduce((acc, p) => [acc[0] + p[0] / pts.length, acc[1] + p[1] / pts.length], [0, 0]);
    const key = tileOf(c[0], c[1]);
    tiles.set(key, true);
    if (a < 12) {                                            // sheds and kiosks: plain walls, zinc roof
      extrude('vc:' + key, pts, 0, 2.6, wall, 'plain', rnd);
      hipRoof('vc:' + key, pts, 2.6, 0.5, ZINC[Math.floor(rnd() * ZINC.length)]);
    } else {
      extrude('win:' + key, pts, 0, Math.min(top, SHOP_H), wall, 'shop', rnd);
      if (top > SHOP_H) extrude('win:' + key, pts, SHOP_H, top, wall, 'win', rnd);
      if (levels <= 2 && rnd() < 0.45) hipRoof('vc:' + key, pts, top, Math.min(2.4, Math.sqrt(a) * 0.18), ZINC[Math.floor(rnd() * ZINC.length)]);
      else {
        roofCap('vc:' + key, pts, top, 0xb9b3a6);
        extrude('vc:' + key, pts, top, top + 0.9, wall, 'plain', rnd);            // parapet
        if (rnd() < 0.35) B.box('vc:' + key, c[0], top + 0.9 + 0.5, c[1], 1.2, 1.0, 1.2, 0, 0x497486);   // water tank
      }
    }
    stats.buildings++;
    buildingOut.push({ id: b.id, levels, estimated: !b.levels && !b.height });
  }
  const buildingMeshes = B.build(materials, group, { cast: true, receive: true });

  /* --- 3b. mapped trees (OSM natural=tree). Species and size are not mapped: a
     generic broadleaf canopy, 5–10 m, varied deterministically per tree. --- */
  const inside = (p, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  const fitted = data.buildings.map(b => route.fitFootprint(b.pts)).filter(f => !f.dropped).map(f => f.pts);
  const treeSpots = (data.trees || []).filter(t => {
    const l = route.lateral(t[0], t[1]);
    if (l && l.distance < RH + 1.4) return false;            // never in the carriageway
    if (Math.hypot(t[0], t[1]) < 6) return false;            // the Cotton Tree's own node: drawn as the landmark
    return !fitted.some(poly => inside(t, poly));
  });
  if (treeSpots.length) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 1, 6), new THREE.MeshLambertMaterial({ color: new THREE.Color(0x6b4f37).convertSRGBToLinear() }), treeSpots.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), treeSpots.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    const greens = [0x2f6e33, 0x3b7d3a, 0x2a5f2f, 0x4a8a3c];
    treeSpots.forEach(([x, z], i) => {
      const r = hashRandom(i * 7919 + 13), h = 5 + r() * 5, w = 3.5 + r() * 3.5;
      trunk.setMatrixAt(i, m.compose(new THREE.Vector3(x, h * 0.3, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.6, 1)));
      crown.setMatrixAt(i, m.compose(new THREE.Vector3(x, h * 0.72, z), new THREE.Quaternion(), new THREE.Vector3(w, h * 0.55, w)));
      crown.setColorAt(i, col.set(greens[Math.floor(r() * greens.length)]).convertSRGBToLinear());
    });
    crown.castShadow = trunk.castShadow = true;
    group.add(trunk, crown);
  }
  stats.trees = treeSpots.length;

  /* --- 4. landmarks --- */
  for (const def of LANDMARKS) {
    const res = buildLandmark(def, { THREE, B, data, route, kit, helpers: { extrude: (k, p, y0, y1, c, m) => extrude(k, p, y0, y1, c, m, () => 0.5), roofCap, hipRoof } });
    if (res) stats.landmarks.push(res);
  }
  B.build(materials, group, { cast: true, receive: true });

  /* --- 5. street furniture: lamps on the main streets, umbrellas near the market --- */
  const furniture = new THREE.Group();
  const lamp = (s, side) => {
    const f = path.toWorld(s, side * (RH + 0.9), {});
    B.box('vc', f.x, 3.5, f.z, 0.16, 7, 0.16, 0, 0x6f7377);
    const arm = path.toWorld(s, side * (RH - 0.4), {});
    B.box('vc', (f.x + arm.x) / 2, 6.95, (f.z + arm.z) / 2, 0.1, 0.1, 1.4, f.heading + Math.PI / 2, 0x6f7377);
    B.box('vc', arm.x, 6.85, arm.z, 0.5, 0.16, 0.28, f.heading, 0xe9e5cf);
  };
  const turns = route.turns;
  const nearTurn = s => turns.some(t => path.closed ? path.wrap(s - t.sStart + 20) < t.sEnd - t.sStart + 40 : s >= t.sStart - 20 && s <= t.sEnd + 40);
  for (let s = 6, k = 0; s < path.length; s += 34, k++) {
    if (nearTurn(s)) continue;
    const side = k % 2 ? 1 : -1;
    if (!inGap(s, side)) lamp(s, side);
  }
  // Market activity concentrates on Wallace Johnson Street by Big Market (docs/cbd/06).
  const market = route.stops.find(st => st.name === 'Big Market');
  if (market) {
    for (let k = -6; k <= 6; k++) {
      const s = path.wrap(market.s + k * 7.5);
      if (nearTurn(s) || Math.abs(k) < 2) continue;          // keep the stop's own kerb clear
      for (const side of [-1, 1]) {
        if (inGap(s, side) || (k + side) % 2 === 0) continue;
        const f = path.toWorld(s, side * (RH + 1.9), {});
        const v = new THREE.Group();
        kit.addVendor(v, 0, 0, side);
        v.position.set(f.x, 0.2, f.z); v.rotation.y = f.heading;
        furniture.add(v);
      }
    }
  }
  B.build(materials, group, {});
  group.add(furniture);
  if (bake) bake(furniture);

  return { group, stats, buildings: buildingOut, buildingMeshes, materials };
}
