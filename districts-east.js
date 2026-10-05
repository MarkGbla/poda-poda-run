window.PODA = window.PODA || { vehicles: {}, districts: {} };
window.PODA.vehicles = window.PODA.vehicles || {};
window.PODA.districts = window.PODA.districts || {};

/* Central + east Freetown: Congo Cross, Cotton Tree, PZ, Abacha Street, Eastern Police, FBC.
   Modelled from photos; see research/east-notes.md. Everything is kit.M() colours or one of a
   small set of module-cached canvas textures so the engine's bake can merge each chunk. */
(() => {
const D = window.PODA.districts;
const CH = 30, PI = Math.PI;
let K = null;          // kit, captured on first call
let T = null;          // textures + textured materials, built once

/* ---------- textures (built once): two atlases, one material each, UV-mapped geometry per tile ---------- */
const PAD = 2;                                   // gutter so mipmaps don't bleed between tiles
let LOD = 'low';                                 // makePerson detail: 'low' in fill(), 'full' at landmarks
function build(kit) {
  K = kit;
  // atlas 0 = shopfronts + signs + clock/umbrella/stone (1024²); atlas 1 = upper-storey façades (1024×512)
  const atl = [[1024, 1024], [1024, 512]].map(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d'), x: 0, y: 0, rowH: 0 }; });
  const tile = (a, w, h, draw) => {              // shelf-pack a w×h tile into atlas a, draw into it, return its UV rect
    const A = atl[a];
    if (A.x + w + PAD > A.c.width) { A.x = 0; A.y += A.rowH + PAD; A.rowH = 0; }
    if (A.y + h > A.c.height) throw new Error('districts-east: atlas ' + a + ' full');
    const x = A.x, y = A.y; A.x += w + PAD; A.rowH = Math.max(A.rowH, h);
    A.g.save(); A.g.translate(x, y); A.g.beginPath(); A.g.rect(0, 0, w, h); A.g.clip(); draw(A.g, w, h); A.g.restore();
    const W = A.c.width, H = A.c.height, e = 1.5;  // inset UVs by 1.5 px
    return { a, u0: (x + e) / W, u1: (x + w - e) / W, v0: 1 - (y + h - e) / H, v1: 1 - (y + e) / H };
  };
  const grime = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(40,30,20,${a * Math.random()})`; const x = Math.random() * w; g.fillRect(x, Math.random() * h * 0.5, 3 + Math.random() * 10, h); } };
  const txt = (g, s, x, y, maxW, size, font, col) => { g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; kit.fitText(g, s, maxW, size, font); g.fillText(s, x, y); };

  // ground-floor shopfront: sign band + shutters/doors. 6 m x 3.6 m
  const shop = (name, wall, bg, fg, shutter) => tile(0, 252, 126, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 14, w, 14);
    const n = 2 + Math.floor(Math.random() * 2), dw = 44;
    for (let i = 0; i < n; i++) {
      const x = 18 + i * ((w - 36 - dw) / Math.max(1, n - 1));
      g.fillStyle = shutter; g.fillRect(x, 52, dw, h - 52);
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 56; y < h; y += 8) g.fillRect(x, y, dw, 2);
    }
    g.fillStyle = bg; g.fillRect(6, 8, w - 12, 36);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(6, 8, w - 12, 36);
    txt(g, name, w / 2, 27, w - 30, 26, 'Bungee, Impact, sans-serif', fg);
    grime(g, w, h, 6, 0.12);
  });
  // upper storey: 3 windows + a rail/grid/stripe treatment. 6 m x 3.2 m
  const upper = (wall, kind, trim) => tile(1, 252, 126, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    if (kind === 'stripes') { g.fillStyle = trim; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 16); }
    if (kind === 'grid') {
      g.fillStyle = '#4a5a68'; g.fillRect(8, 8, w - 16, h - 16);
      g.fillStyle = trim; for (let x = 8; x < w - 8; x += 16) g.fillRect(x, 8, 6, h - 16); for (let y = 8; y < h - 8; y += 16) g.fillRect(8, y, w - 16, 6);
      g.fillStyle = 'rgba(255,255,255,.25)'; for (let x = 14; x < w - 8; x += 16) for (let y = 14; y < h - 8; y += 16) g.fillRect(x, y, 10, 3);
    } else {
      for (let i = 0; i < 3; i++) {
        const x = 22 + i * 78;
        g.fillStyle = '#f0ece0'; g.fillRect(x - 3, 30, 56, 62);
        g.fillStyle = '#243744'; g.fillRect(x, 33, 50, 56);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, 33, 22, 56);
        if (kind === 'shutter') { g.fillStyle = trim; g.fillRect(x - 12, 30, 10, 62); g.fillRect(x + 55, 30, 10, 62); }
      }
      if (kind === 'balcony' || kind === 'wood') {
        g.fillStyle = kind === 'wood' ? trim : 'rgba(0,0,0,.14)'; g.fillRect(0, 96, w, 32);
        g.fillStyle = kind === 'wood' ? 'rgba(0,0,0,.35)' : trim; for (let x = 6; x < w; x += 14) g.fillRect(x, 98, 4, 26);
        g.fillStyle = kind === 'wood' ? '#3a2616' : '#d9d2c0'; g.fillRect(0, 94, w, 5);
      }
      if (Math.random() < 0.7) { g.fillStyle = '#b9b9b4'; g.fillRect(170 + Math.random() * 40, 60, 22, 16); }
    }
    grime(g, w, h, 5, 0.1);
  });
  const board = (s, bg, fg, w = 252, h = 96, font = 'Bungee, Impact, sans-serif') => tile(0, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); txt(g, s, w / 2, h / 2, w - 24, h * 0.55, font, fg);
  });

  const S = {
    jalloh:   shop('S. JALLOH ENTERPRISES', '#e9e3d2', '#f6f3ea', '#b4261f', '#2457a6'),
    mohsen:   shop('IBRAHIM MOHSEN & SONS', '#f1ead7', '#b4261f', '#ffffff', '#5b4a3a'),
    rokel:    shop('ROKEL COMMERCIAL BANK', '#f4f3ee', '#1b3f8f', '#ffffff', '#1d2a33'),
    choith:   shop('CHOITHRAM SUPERMARKET', '#efe7cf', '#e8c33d', '#1b1b1b', '#2f4f6f'),
    africell: shop('AFRICELL', '#e4ddd0', '#7a2a9e', '#ffffff', '#3a3a3a'),
    orange:   shop('ORANGE MONEY', '#ddd6c5', '#ff7900', '#ffffff', '#3a3a3a'),
    kings:    shop('KINGS PHARMACY', '#efe9dc', '#1a8a3c', '#ffffff', '#2457a6'),
    photo:    shop('UNIQUE PHOTO STUDIO', '#e3b86a', '#ffd200', '#141414', '#6b4a2e'),
    musanta:  shop('MUSANTA STORE', '#c9b79a', '#8c1d14', '#f3e7c6', '#6b4a2e'),
    gtco:     shop('GTCO', '#f0ece2', '#e8541f', '#ffffff', '#2a2a2a'),
    provis:   shop('GOD WILL PROVIDE PROVISIONS', '#dfd3b8', '#1eb53a', '#ffffff', '#2457a6'),
    cool:     shop('SWEET SALONE COOL ROOM', '#e8e2d0', '#0072c6', '#ffffff', '#6b4a2e'),
  };
  const U = {
    cream:  upper('#ece2c6', 'balcony', '#8c8678'),
    rokel:  upper('#f5f3ec', 'grid', '#1b4f9c'),
    grey:   upper('#cfc9bb', 'grid', '#a9a398'),
    pink:   upper('#e4a890', 'balcony', '#8a6a5a'),
    yellow: upper('#e2c777', 'wood', '#6b4a2e'),
    stripe: upper('#f6f1e4', 'stripes', '#e77d2b'),
    blue:   upper('#a9c8d9', 'shutter', '#2457a6'),
    fbc:    upper('#efe9d6', 'balcony', '#1f4d3a'),
    east:   upper('#e0893a', 'balcony', '#6b4a2e'),
    oldblue: upper('#4c76a8', 'wood', '#5a3d26'),
    white:  upper('#f4f1ea', 'shutter', '#cfcac0'),
    fbcGround: upper('#efe9d6', 'shutter', '#1f4d3a'),
  };
  const B = {
    ecobank: board('ECOBANK', '#004c97', '#ffffff'),
    gulf:    board('GULF OIL', '#f26522', '#1b2f6e'),
    airtel:  board('airtel', '#e4002b', '#ffffff', 252, 96, '800 60px Outfit, sans-serif'),
    africell: board('AFRICELL', '#7a2a9e', '#ffffff'),
    orange:  board('orange', '#ff7900', '#ffffff', 252, 96, '800 60px Outfit, sans-serif'),
    gtco:    board('GTCO', '#e8541f', '#ffffff', 124, 96),
    continental: board('Continental', '#f2efe6', '#1b1b1b', 504, 126, '900 80px Outfit, sans-serif'),
    siaka:   board('SIAKA STEVENS STREET', '#e7dcc4', '#2f5a3a', 252, 48),
    state:   board('STATE HOUSE', '#e7dcc4', '#2f5a3a', 252, 48),
    bank:    board('COMMERCIAL BANK', '#e7dcc4', '#2f5a3a', 252, 48),
    abacha:  board('ABACHA STREET', '#1f4fa3', '#ffffff', 252, 48),
    peace:   board('PEACE BRIDGE  2003', '#d9d2c0', '#2b2b2b', 252, 64, '700 40px Outfit, sans-serif'),
    fbcgate: tile(0, 504, 96, (g, w, h) => {
      g.fillStyle = '#1f4d3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e9c9'; g.fillRect(0, h - 10, w, 10);
      txt(g, 'FOURAH BAY COLLEGE', w / 2, 34, w - 40, 44, 'Bungee, Impact, sans-serif', '#f6efd8');
      txt(g, 'UNIVERSITY OF SIERRA LEONE  ·  EST. 1827', w / 2, 70, w - 40, 22, '700 22px Outfit, sans-serif', '#d9e6c8');
    }),
    nassit: board('NASSIT HOUSE', '#f4f4f2', '#1f4fa3', 252, 64, '800 36px Outfit, sans-serif'),
    courts: board('LAW COURTS', '#efe4c6', '#4a3a2a', 252, 48, '700 30px Outfit, sans-serif'),
  };
  const clock = tile(0, 124, 124, (g, w, h) => {
    g.fillStyle = '#f3efe6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(62, 62, 50, 0, PI * 2); g.fill();
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#1b1b1b'; g.font = 'bold 15px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('XII', 62, 22); g.fillText('III', 102, 62); g.fillText('VI', 62, 102); g.fillText('IX', 22, 62);
    g.lineWidth = 4; g.beginPath(); g.moveTo(62, 62); g.lineTo(62, 28); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(62, 62); g.lineTo(86, 74); g.stroke();
  });
  const umb = tile(0, 124, 32, (g, w, h) => {
    const c = ['#d8333a', '#f2c230', '#1eb53a', '#0072c6']; for (let i = 0; i < 8; i++) { g.fillStyle = c[i % 4]; g.fillRect(i * 15.5, 0, 16, h); }
  });
  const stone = tile(0, 124, 124, (g, w, h) => {
    g.fillStyle = '#8a5e44'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `hsl(${18 + Math.random() * 10},${35 + Math.random() * 20}%,${30 + Math.random() * 22}%)`; const s = 10 + Math.random() * 16; g.fillRect(Math.random() * w, Math.random() * h, s, s * 0.7); }
    g.fillStyle = '#1f5fb5'; g.fillRect(0, 54, w, 20);
  });
  // one texture + one material per atlas (kit.canvasTex so anisotropy matches the engine)
  const mats = atl.map(A => new THREE.MeshLambertMaterial({ map: kit.canvasTex(A.c.width, A.c.height, g => g.drawImage(A.c, 0, 0)) }));
  T = { mats, S, U, B, clock, umb, stone, shops: Object.values(S), uppers: Object.values(U), geo: new Map() };
  return T;
}
// Cached geometry whose UVs point at one atlas tile. kind: 'box' (all faces) or 'cone' (umbrella canopy).
function TG(r, kind = 'box') {
  const key = kind + r.a + r.u0 + r.v0;
  let g = T.geo.get(key);
  if (!g) {
    g = (kind === 'cone' ? K.G.cone : K.G.box).clone();
    const uv = g.attributes.uv, du = r.u1 - r.u0, dv = r.v1 - r.v0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * du, r.v0 + uv.getY(i) * dv);
    T.geo.set(key, g);
  }
  return g;
}
const TM = r => T.mats[r.a];
// textured box: same signature as kit.add minus the geometry/material
const tbox = (g, r, sx, sy, sz, x, y, z) => add(g, TG(r), TM(r), sx, sy, sz, x, y, z);

/* ---------- shared builders ---------- */
const add = (...a) => K.add(...a);
const rand = (a, b) => K.rand(a, b), randi = (a, b) => K.randi(a, b), pick = a => K.pick(a);
const G = () => K.G;

// Multi-storey block. x is the absolute kerb distance of the facade; building extends away from the road.
function block(g, side, x, z, w, d, floors, shopT, upT, opt = {}) {
  const t = T, cx = side * (x + d / 2), b = opt.base || 0;
  tbox(g, shopT, d, 3.6, w, cx, b + 1.8, z);
  for (let f = 1; f < floors; f++) {
    const y = b + 3.6 + (f - 1) * 3.2;
    tbox(g, upT, d, 3.2, w, cx, y + 1.6, z);
    if (opt.balcony) {
      add(g, G().box, opt.balcony, 0.7, 0.14, w * 0.92, side * (x - 0.35), y + 0.07, z);
      add(g, G().box, opt.rail || 0x3b3b3b, 0.06, 0.9, w * 0.92, side * (x - 0.68), y + 0.55, z);
    }
  }
  const top = b + 3.6 + (floors - 1) * 3.2;
  if (opt.pitched) add(g, G().pyr, opt.pitched, d * 1.5, 1.6, w * 1.5, cx, top + 0.7, z);
  else {
    add(g, G().box, opt.roof || 0xd6cfbf, d + 0.3, 0.5, w + 0.3, cx, top + 0.1, z);
    if (Math.random() < 0.45) add(g, G().cyl6, 0x1e1e1e, 1.2, 1.1, 1.2, cx + rand(-d / 4, d / 4), top + 0.9, z + rand(-w / 4, w / 4)); // water tank
    if (Math.random() < 0.3) add(g, G().box, 0x6a6e70, 0.1, 2.2, 0.1, cx + rand(-d / 3, d / 3), top + 1.3, z + rand(-w / 3, w / 3)); // mast / rebar
  }
  return top;
}
// A row of blocks down one side of the chunk.
function blockRow(g, side, opt) {
  let z = -rand(0.2, 1.5);
  while (z > -CH + 2) {
    const w = rand(opt.wMin, opt.wMax), d = rand(7, 10);
    const floors = randi(opt.fMin, opt.fMax);
    const old = Math.random() < (opt.oldFrac || 0);
    const o = { balcony: Math.random() < (opt.balcony ?? 0.35) ? pick([0xd9d2c0, 0xe8e2d0, 0xbfb8a8]) : null, rail: pick([0x3b3b3b, 0x1f4fa3, 0x7a5a3a]) };
    if (old) o.pitched = pick([0x8a4a35, 0x6f6a62, 0x9a5a3a, 0x5a5a58]);
    block(g, side, opt.x, z - w / 2, w, d, floors, pick(opt.shops || T.shops), pick(old ? opt.oldUppers : opt.uppers), o);
    if (opt.billboard && Math.random() < opt.billboard && floors > 1) {
      tbox(g, pick(Object.values(T.B).slice(0, 5)), 0.12, 1.5, 3.2, side * (opt.x - 0.1), 3.6 + rand(0.8, 1.6), z - w / 2);
    }
    z -= w + rand(0.1, opt.gap || 0.6);
  }
}
// Concrete poles with wires along the kerb; optional cross-road wires (specificity: the tangle).
function wires(g, cross) {
  for (const s of [-1, 1]) {
    for (const z of [-6, -21]) {
      add(g, G().cyl6, 0x9a9a92, 0.28, 8.5, 0.28, s * 8.1, 4.25, z);
      add(g, G().box, 0x7a7a72, 1.6, 0.12, 0.12, s * 8.1, 7.8, z);
      if (cross) for (const dy of [0, -0.5]) add(g, G().box, 0x1c1c1c, 16.4, 0.035, 0.035, 0, 7.3 + dy, z + dy);
    }
    for (const dx of [-0.6, 0.6]) add(g, G().box, 0x1c1c1c, 0.035, 0.035, CH, s * 8.1 + dx, 7.7 + Math.abs(dx) * 0.2, -CH / 2);
    add(g, G().box, 0x1c1c1c, 0.035, 0.035, CH, s * 8.1, 7.25, -CH / 2);
  }
}
function person(g, x, z, ry) {
  const p = K.makePerson({ lod: LOD });
  p.position.set(x, 0.2, z); p.rotation.y = ry ?? pick([0, PI]) + rand(-0.4, 0.4); g.add(p); return p;
}
function crowd(g, n, zMin = -CH + 1, zMax = -1) {
  for (let i = 0; i < n; i++) { const s = Math.random() < 0.5 ? -1 : 1; person(g, s * rand(6.1, 8.2), rand(zMin, zMax)); }
}
function umbrella(g, x, z, mat, h = 2.3) {
  add(g, G().cyl6, 0x3a3a3a, 0.06, h, 0.06, x, h / 2 + 0.2, z);
  if (mat.isMaterial) add(g, G().cone, mat, rand(2.1, 2.6), 0.6, rand(2.1, 2.6), x, h + 0.2, z);
  else add(g, TG(mat, 'cone'), TM(mat), rand(2.1, 2.6), 0.6, rand(2.1, 2.6), x, h + 0.2, z);
}
function goods(g, x, z) {
  add(g, G().box, pick([0x2457a6, 0xd8333a, 0xf2c230, 0xffffff]), 1.8, 0.05, 1.4, x, 0.23, z); // tarp
  for (let i = 0; i < 3; i++) add(g, G().box, pick([0xff7a29, 0xe8b52a, 0x6dbb3c, 0xf6efe1, 0xd8333a, 0x2457a6]), 0.4, 0.3, 0.35, x + rand(-0.6, 0.6), 0.4, z + rand(-0.45, 0.45));
}
function table(g, x, z, side) {
  add(g, G().box, 0x8a6a4a, 1.0, 0.08, 1.6, x, 0.95, z);
  for (const dz of [-0.6, 0.6]) add(g, G().box, 0x6b4f37, 0.08, 0.75, 0.08, x, 0.57, z + dz);
  for (let i = 0; i < 4; i++) add(g, G().box, pick([0xe24f8f, 0x0072c6, 0xf2f2f2, 0x1eb53a, 0xffc23d]), 0.25, 0.25, 0.2, x + rand(-0.35, 0.35), 1.12, z + rand(-0.65, 0.65));
  person(g, x + side * 0.9, z, -side * PI / 2);
}
function wheelbarrow(g, x, z) {
  add(g, G().box, 0x3a6fb0, 0.7, 0.35, 1.1, x, 0.55, z);
  add(g, G().cyl6, 0x1b1b1b, 0.4, 0.1, 0.4, x, 0.4, z - 0.6).rotation.z = PI / 2;
  for (let i = 0; i < 3; i++) add(g, G().ico, pick([0xff7a29, 0x6dbb3c, 0xf2c230]), 0.3, 0.3, 0.3, x + rand(-0.15, 0.15), 0.8, z + rand(-0.3, 0.3));
}
function conifer(g, x, z, base) {
  const h = rand(7, 11);
  add(g, G().cyl6, 0x5a3d26, 0.3, h * 0.3, 0.3, x, base + h * 0.15, z);
  add(g, G().cone, pick([0x2f5a2a, 0x27512a, 0x386633]), 1.6, h, 1.6, x, base + h / 2 + 0.6, z);
}
function hillHouses(g, n, colourSlopes, ctx) {
  if (colourSlopes) ctx.slopeL.material = ctx.slopeR.material = K.M(colourSlopes);
  for (let i = 0; i < n; i++) { const s = Math.random() < 0.5 ? -1 : 1, ax = rand(20, 48); K.addHouse(g, s * ax, rand(-CH + 2, -2), K.hy(ax), false, s); }
  for (let i = 0; i < 3; i++) { const s = Math.random() < 0.5 ? -1 : 1, ax = rand(18, 46); K.addTree(g, s * ax, rand(-CH, 0), K.hy(ax), Math.random() < 0.4); }
}
// Kerb vendor built from our own cheap parts (kit.addVendor spawns a full-detail person).
function kerbVendors(g, n) {
  for (let i = 0; i < n; i++) {
    const s = Math.random() < 0.5 ? -1 : 1, x = s * 7.4, z = rand(-CH + 3, -3);
    umbrella(g, x, z, K.M(pick([0xd8333a, 0x1eb53a, 0xffc23d, 0x0072c6])), 2.4);
    add(g, G().box, 0x8a6a4a, 1.4, 0.8, 0.9, x, 0.6, z);
    for (let k = 0; k < 4; k++) add(g, G().ico, pick([0xff7a29, 0xe8b52a, 0x6dbb3c, 0xf6efe1]), 0.22, 0.22, 0.22, x + rand(-0.55, 0.55), 1.1, z + rand(-0.3, 0.3));
    person(g, x + s * 0.9, z + 0.4, -s * PI / 2);
  }
}

/* ---------- PZ: downtown CBD ---------- */
const PZ_UP = () => [T.U.cream, T.U.rokel, T.U.grey, T.U.white, T.U.cream, T.U.pink];
D['PZ'] = {
  fill(g, kit, ctx) {
    if (!T) build(kit);
    LOD = 'low';
    for (const s of [-1, 1]) blockRow(g, s, { x: 9.3, wMin: 6, wMax: 10, fMin: 2, fMax: 5, uppers: PZ_UP(), billboard: 0.5 });
    wires(g, true);
    crowd(g, 4); kerbVendors(g, 1);
    if (Math.random() < 0.5) table(g, pick([-1, 1]) * 7.2, rand(-26, -4), Math.random() < 0.5 ? -1 : 1);
    hillHouses(g, 5, 0x8c7a62, ctx);
  },
  landmark(g, kit) {
    if (!T) build(kit);
    LOD = 'full';
    // Sierra Leone Commercial Bank tower: tan ribs, arched base, masts
    const x = -16.5, z = -4, w = 13, h = 44;
    add(g, G().box, 0xc8b07a, w, h, w, x, h / 2, z);
    for (let i = 0; i < 6; i++) { add(g, G().box, 0xa88f5c, 0.5, h - 6, 0.6, x + w / 2 + 0.2, h / 2 + 2, z - w / 2 + 1.2 + i * 2.1); add(g, G().box, 0xa88f5c, 0.6, h - 6, 0.5, x - w / 2 + 1.2 + i * 2.1, h / 2 + 2, z + w / 2 + 0.2); }
    for (let i = 0; i < 4; i++) { add(g, G().box, 0x2a2a2a, 0.3, 4.2, 2.0, x + w / 2 + 0.1, 2.1, z - 4.5 + i * 3); add(g, G().box, 0x2a2a2a, 2.0, 4.2, 0.3, x - 4.5 + i * 3, 2.1, z + w / 2 + 0.1); }
    for (let f = 1; f < 14; f++) { add(g, G().box, 0x2c3a44, 0.2, 1.3, w - 1.5, x + w / 2 + 0.05, 5 + f * 2.8, z); add(g, G().box, 0x2c3a44, w - 1.5, 1.3, 0.2, x, 5 + f * 2.8, z + w / 2 + 0.05); }
    add(g, G().box, 0xb59c66, w + 0.6, 0.8, w + 0.6, x, h + 0.2, z);
    for (const dx of [-3, 2]) add(g, G().box, 0x8a8a8a, 0.25, 6, 0.25, x + dx, h + 3.4, z + dx);
    // Rokel Commercial Bank beside it: white with blue grid
    block(g, -1, 9.3, 10 + 7, 14, 10, 4, T.S.rokel, T.U.rokel, { roof: 0x1b4f9c });
    // weathered three-way signpost on the right, past the shelter
    const sx = 6.6, sz = 11.5;
    add(g, G().cyl6, 0x5a4a3a, 0.14, 4.4, 0.14, sx, 2.2, sz);
    tbox(g, T.B.siaka, 0.06, 0.45, 2.4, sx, 3.9, sz).rotation.y = 0.35;
    tbox(g, T.B.state, 2.2, 0.45, 0.06, sx, 3.3, sz).rotation.y = 0.2;
    tbox(g, T.B.bank, 0.06, 0.45, 2.2, sx, 2.7, sz).rotation.y = -0.9;
    crowd(g, 6, 10, 20);
  },
};

/* ---------- Abacha Street: the market ---------- */
D['Abacha Street'] = {
  fill(g, kit, ctx) {
    if (!T) build(kit);
    LOD = 'low';
    const shops = [T.S.jalloh, T.S.mohsen, T.S.musanta, T.S.photo, T.S.provis, T.S.cool, T.S.choith];
    for (const s of [-1, 1]) blockRow(g, s, { x: 9.3, wMin: 5, wMax: 8, fMin: 2, fMax: 3, shops, uppers: [T.U.yellow, T.U.oldblue, T.U.stripe, T.U.cream, T.U.blue], oldUppers: [T.U.yellow, T.U.oldblue, T.U.cream], oldFrac: 0.6, billboard: 0.25, balcony: 0 });
    // umbrellas crowd both pavements
    for (const s of [-1, 1]) {
      let z = -rand(0.5, 2);
      while (z > -CH + 1.5) {
        const x = s * rand(6.4, 7.6);
        umbrella(g, x, z, Math.random() < 0.65 ? T.umb : K.M(pick([0x2457a6, 0x1b1b1b, 0xd8333a, 0x3b3b3b])));
        if (Math.random() < 0.5) goods(g, x, z); else if (Math.random() < 0.4) table(g, x, z, s);
        z -= rand(3.4, 4.6);
      }
    }
    for (let i = 0; i < 2; i++) wheelbarrow(g, pick([-1, 1]) * rand(6.2, 7.0), rand(-27, -3));
    for (let i = 0; i < 6; i++) { const s = Math.random() < 0.5 ? -1 : 1; add(g, G().box, pick(K.CLOTH), 0.08, rand(0.5, 0.9), rand(0.4, 0.7), s * 9.2, rand(1.6, 2.9), rand(-28, -2)); } // clothes and bags hung on the fronts
    crowd(g, 4);
    // bunting across the street (green / white / blue)
    for (const z of [rand(-22, -8)]) {
      add(g, G().box, 0x1c1c1c, 16.4, 0.03, 0.03, 0, 6.6, z);
      for (let i = 0; i < 10; i++) { const f = add(g, G().pyr, [0x1eb53a, 0xf2f2f2, 0x0072c6][i % 3], 0.55, 0.6, 0.04, -7.2 + i * 1.6, 6.3, z); f.rotation.x = PI; }
    }
    wires(g, true);
    hillHouses(g, 3, 0x8c7a62, ctx);
  },
  landmark(g, kit) {
    if (!T) build(kit);
    LOD = 'full';
    // street-name plate by the stop, a container shop and an umbrella cluster on the left kerb
    add(g, G().cyl6, 0x5a5a58, 0.1, 3.2, 0.1, 6.4, 1.6, 10.5);
    tbox(g, T.B.abacha, 0.05, 0.4, 2.0, 6.4, 3.0, 10.5);
    add(g, G().box, 0xb4261f, 2.3, 2.5, 6.0, -7.1, 1.45, -14);
    add(g, G().box, 0x7a1a12, 2.4, 0.1, 6.1, -7.1, 2.75, -14);
    add(g, G().box, 0x1b1b1b, 0.1, 1.9, 1.4, -5.9, 1.15, -13);
    for (let i = 0; i < 4; i++) { const z = 10 + i * 2.6; umbrella(g, -7.0, z, i % 2 ? T.umb : K.M(0x2457a6)); goods(g, -7.0, z); }
    for (let i = 0; i < 5; i++) person(g, rand(-8.2, -6.1), rand(-22, -8));
  },
};

/* ---------- Eastern Police: East End + the clock tower ---------- */
D['Eastern Police'] = {
  fill(g, kit, ctx) {
    if (!T) build(kit);
    LOD = 'low';
    const shops = [T.S.africell, T.S.orange, T.S.provis, T.S.cool, T.S.kings, T.S.photo, T.S.musanta];
    for (const s of [-1, 1]) blockRow(g, s, { x: 9.3, wMin: 5, wMax: 9, fMin: 2, fMax: 4, shops, uppers: [T.U.east, T.U.yellow, T.U.cream, T.U.pink, T.U.blue], oldUppers: [T.U.yellow, T.U.east], oldFrac: 0.35, billboard: 0.35 });
    for (let i = 0; i < 4; i++) { const s = Math.random() < 0.5 ? -1 : 1, x = s * rand(6.4, 7.6), z = rand(-28, -2); umbrella(g, x, z, Math.random() < 0.5 ? T.umb : K.M(pick([0xd8333a, 0x1eb53a, 0x2457a6]))); if (Math.random() < 0.6) goods(g, x, z); }
    kerbVendors(g, 1); crowd(g, 4);
    if (Math.random() < 0.5) wheelbarrow(g, pick([-1, 1]) * 6.6, rand(-25, -5));
    wires(g, true);
    hillHouses(g, 6, 0x8c7a62, ctx);
  },
  landmark(g, kit) {
    if (!T) build(kit);
    LOD = 'full';
    // the clock tower stands in the junction; here it rises from the left kerb so the road stays clear
    const x = -7.3, z = -2;
    add(g, G().box, 0xd9d2c3, 3.0, 0.5, 3.0, x, 0.45, z); add(g, G().box, 0xd9d2c3, 2.7, 0.5, 2.7, x, 0.95, z);
    add(g, G().box, 0xf3efe6, 2.3, 12.4, 2.3, x, 7.4, z);                 // shaft
    for (const r of [0, PI / 2]) { const l = add(g, G().box, 0x2b2b2b, 2.4, 1.1, 0.7, x, 11.4, z); l.rotation.y = r; } // louvres
    tbox(g, T.clock, 2.5, 2.5, 2.5, x, 14.9, z);                 // clock stage, one face per side
    add(g, G().box, 0xd9d2c3, 2.9, 0.3, 2.9, x, 16.3, z);
    add(g, G().pyr, 0xcfc6b2, 3.1, 1.9, 3.1, x, 17.4, z);
    add(g, G().box, 0x8a8a8a, 0.08, 1.6, 0.08, x, 19.1, z);
    for (let i = 0; i < 6; i++) person(g, rand(-8.2, -6), z + pick([rand(-9, -2.5), rand(2.5, 9)]));
    for (let i = 0; i < 2; i++) umbrella(g, -7.2, z + pick([-6, 6]) + i * 2.4, T.umb);
  },
};

/* ---------- Cotton Tree: the roundabout, Law Courts, National Museum ---------- */
D['Cotton Tree'] = {
  fill(g, kit, ctx) {
    if (!T) build(kit);
    LOD = 'low';
    // left (-x): the low government quarter: fenced lawns, mature trees, cream colonial blocks set back from the road
    let z = -rand(0.5, 2);
    while (z > -CH + 3) {
      const w = rand(9, 14), zc = z - w / 2;
      add(g, G().box, 0x6a9a48, 7, 0.06, w, -12.5, 0.04, zc);
      add(g, G().box, 0x2b2b2b, 0.08, 1.2, w, -9.3, 0.8, zc);
      for (let i = 0; i < 3; i++) add(g, G().box, 0x2b2b2b, 0.1, 1.3, 0.1, -9.3, 0.85, zc - w / 2 + 0.3 + i * (w - 0.6) / 2);
      if (Math.random() < 0.7) K.addTree(g, -rand(11, 14), zc + rand(-w / 3, w / 3), 0, false);
      if (Math.random() < 0.8) { // colonial cream block with red roof and verandah columns, 8 m back
        const d = 8, cx = -(16 + d / 2);
        add(g, G().box, 0xefe4c6, d, 6.4, w - 2, cx, 3.2, zc);
        for (let i = 0; i < 4; i++) add(g, G().cyl6, 0xf8f3e4, 0.5, 6.2, 0.5, -15.7, 3.1, zc - (w - 2) * (0.38 - 0.25 * i));
        add(g, G().box, 0xefe4c6, 1.0, 0.4, w - 2, -15.9, 6.5, zc);
        add(g, G().pyr, 0xa3442e, d * 1.5, 2.4, (w - 2) * 1.45, cx, 7.6, zc);
        for (let i = 0; i < 3; i++) add(g, G().box, 0x2c3a44, 0.1, 2.0, 1.1, -15.95, 4.6, zc - (w - 2) * (0.25 - 0.25 * i));
      }
      z -= w + 0.8;
    }
    // right (+x): mid-rise office blocks and banks ring the roundabout
    blockRow(g, 1, { x: 9.6, wMin: 8, wMax: 12, fMin: 4, fMax: 8, shops: [T.S.rokel, T.S.africell, T.S.choith, T.S.kings, T.S.orange], uppers: [T.U.grey, T.U.white, T.U.rokel, T.U.cream], gap: 1.0 });
    wires(g, false);
    crowd(g, 4);
    hillHouses(g, 6, 0x8c7a62, ctx);
  },
  landmark(g, kit) {
    if (!T) build(kit);
    LOD = 'full';
    // The site today (2025): charred trunk spires with regrowth, wrapped in the flag, on a stepped dark plinth
    const x = -13.9, z = 0;
    add(g, G().cyl6, 0xf2f2f2, 9.8, 0.16, 9.8, x, 0.08, z);            // white kerb ring
    add(g, G().cyl, 0x3a3634, 9.2, 1.0, 9.2, x, 0.5, z);
    add(g, G().cyl, 0x4a4542, 7.4, 0.7, 7.4, x, 1.3, z);
    add(g, G().cyl, 0x2e2b29, 5.8, 0.5, 5.8, x, 1.9, z);
    // flag wrap: green / white / blue bands round the lower trunk
    add(g, G().cyl, 0x0072c6, 4.4, 1.4, 4.4, x, 2.8, z);
    add(g, G().cyl, 0xf2f2f2, 4.2, 1.4, 4.2, x, 4.2, z);
    add(g, G().cyl, 0x1eb53a, 4.0, 1.4, 4.0, x, 5.6, z);
    // jagged charred spires
    for (const [dx, dz, h, w] of [[0, 0, 16, 1.8], [-1.3, 0.6, 11, 1.2], [1.2, -0.7, 9, 1.1], [0.4, 1.3, 7, 0.9]]) {
      const c = add(g, G().cone, 0x1e1a17, w, h, w, x + dx, 6.3 + h / 2 - 0.5, z + dz); c.rotation.z = dx * 0.06; c.rotation.x = dz * 0.05;
    }
    // regrowth: fresh green sprouting from the trunk and its base
    for (let i = 0; i < 8; i++) add(g, G().ico, pick([0x4f9a3a, 0x5fae45, 0x3f8a3a]), rand(1.8, 3.4), rand(1.2, 2.6), rand(1.8, 3.4), x + rand(-2.4, 2.4), rand(6.5, 12), z + rand(-2.2, 2.2));
    for (let i = 0; i < 4; i++) add(g, G().ico, 0x4f9a3a, 1.6, 1.0, 1.6, x + rand(-2.6, 2.6), 2.4, z + rand(-2.6, 2.6));
    // Law Courts behind: cream, columned, red roof, with its sign
    const lx = -29.5, lw = 26;
    add(g, G().box, 0xefe4c6, 10, 9, lw, lx, 4.5, z);
    for (let i = 0; i < 7; i++) add(g, G().cyl6, 0xf8f3e4, 0.7, 8.6, 0.7, lx + 5.6, 4.3, z - lw / 2 + 2.5 + i * 3.5);
    add(g, G().box, 0xefe4c6, 2.0, 0.6, lw, lx + 5.2, 9.0, z);
    add(g, G().pyr, 0xa3442e, 16, 3.6, lw * 1.45, lx, 10.8, z);
    for (let i = 0; i < 6; i++) add(g, G().box, 0x2c3a44, 0.1, 2.4, 1.3, lx + 5.05, 5.6, z - lw / 2 + 4.2 + i * 3.5);
    tbox(g, T.B.courts, 0.08, 1.0, 5.4, lx + 5.1, 8.3, z);
    // National Museum: small cream block with red roof, on the lawn beyond the museum side
    add(g, G().box, 0xefe4c6, 6, 4.5, 8, -13.5, 2.25, 15); add(g, G().pyr, 0xa3442e, 9, 2.0, 12, -13.5, 5.4, 15);
    // NASSIT House across the road: tall white tower with a blue stripe, rising above the blocks
    add(g, G().box, 0xf4f4f2, 10, 30, 12, 22, 15, -20); add(g, G().box, 0x1f4fa3, 0.2, 29, 1.4, 16.9, 15, -20);
    for (let f = 0; f < 9; f++) add(g, G().box, 0x2c3a44, 0.15, 1.2, 8, 16.95, 2.4 + f * 3.3, -21.8);
    tbox(g, T.B.nassit, 0.1, 1.4, 6, 16.92, 27.5, -17);
    for (let i = 0; i < 5; i++) person(g, rand(-8.2, -6.2), rand(-8, 8));
  },
};

/* ---------- Congo Cross: the bridge and the junction strip ---------- */
D['Congo Cross'] = {
  fill(g, kit, ctx) {
    if (!T) build(kit);
    LOD = 'low';
    if (Math.floor((ctx.index || 0) / 2) % 3 === 1) { // bridge: two consecutive chunks in every six span the Congo stream valley
      for (const s of [-1, 1]) {
        add(g, G().box, 0xd8d2c0, 0.3, 0.18, CH, s * 8.6, 1.35, -CH / 2);
        add(g, G().box, 0xd8d2c0, 0.26, 0.3, CH, s * 8.6, 0.35, -CH / 2);
        for (let z = -0.6; z > -CH; z -= 0.75) add(g, G().box, 0xcfc8b4, 0.14, 0.9, 0.14, s * 8.6, 0.8, z);
        for (const z of [-8, -23]) {
          add(g, G().cyl6, 0x8a8f94, 0.22, 9, 0.22, s * 8.3, 4.5, z);
          add(g, G().box, 0x8a8f94, 2.4, 0.12, 0.12, s * 7.2, 8.9, z); add(g, G().box, 0xe8e8e0, 0.6, 0.18, 0.3, s * 6.1, 8.8, z);
          tbox(g, pick([T.B.africell, T.B.airtel, T.B.orange]), 0.08, 1.1, 0.7, s * 8.1, 3.4, z);  // poster board on the post
        }
        add(g, G().box, 0x5f7f78, 12, 0.04, CH, s * 15, 0.03, -CH / 2);          // stream + wet valley floor
        for (let i = 0; i < 7; i++) add(g, G().ico, pick([0x2f6e33, 0x3b7d3a, 0x2a5f2f]), rand(3, 6), rand(2, 4), rand(3, 6), s * rand(10, 20), rand(0.5, 1.5), rand(-CH, 0));
        add(g, G().box, 0x8a8f94, 0.2, 7, 0.2, s * 13, 3.5, -15);
        if (Math.random() < 0.7) tbox(g, pick([T.B.ecobank, T.B.gulf, T.B.orange, T.B.airtel, T.B.africell]), 0.15, 2.6, 6, s * 13, 7.8, -15);
      }
      crowd(g, 4); hillHouses(g, 8, null, ctx);
    } else { // commercial strip at the junction
      for (const s of [-1, 1]) {
        if (Math.random() < 0.4) { // laterite stone retaining wall with a blue band, hill behind
          tbox(g, T.stone, 1.2, 3.2, CH, s * 9.8, 1.6, -CH / 2);
          for (let i = 0; i < 3; i++) K.addHouse(g, s * rand(13, 16), rand(-CH + 3, -3), 2.6, false, s);
          if (s < 0) tbox(g, T.B.continental, 0.1, 1.6, 6.4, -9.15, 1.7, -12);
        } else blockRow(g, s, { x: 9.3, wMin: 6, wMax: 9, fMin: 2, fMax: 3, shops: [T.S.gtco, T.S.orange, T.S.africell, T.S.provis, T.S.cool, T.S.kings], uppers: [T.U.cream, T.U.white, T.U.pink, T.U.blue], billboard: 0.5 });
      }
      wires(g, true); crowd(g, 4); kerbVendors(g, 1);
      hillHouses(g, 6, null, ctx);
    }
  },
  landmark(g, kit) {
    if (!T) build(kit);
    LOD = 'full';
    // junction furniture on the left kerb: GTCO orange signs, the Peace Bridge plaque; a tall Ecobank hoarding on the right
    for (const z of [-11, -13.5]) { add(g, G().box, 0x3a3a3a, 0.1, 1.2, 0.1, -7.4, 0.8, z); tbox(g, T.B.gtco, 0.1, 1.0, 1.3, -7.4, 1.9, z); }
    add(g, G().box, 0xd8d2c0, 0.5, 1.6, 4, -7.8, 1.0, 11); tbox(g, T.B.peace, 0.05, 0.7, 2.8, -7.5, 1.2, 11);
    add(g, G().box, 0x8a8f94, 0.3, 14, 0.3, 11.5, 7, -14); tbox(g, T.B.ecobank, 0.25, 3.2, 7.5, 11.5, 14.5, -14);
    add(g, G().box, 0x8a8f94, 0.3, 13, 0.3, -11.5, 6.5, 14); tbox(g, T.B.gulf, 0.25, 3.0, 7, -11.5, 13.5, 14);
    for (let i = 0; i < 4; i++) person(g, rand(-8.2, -6.2), rand(-20, -10));
  },
};

/* ---------- FBC: Mount Aureol and the campus ---------- */
function fbcBlock(g, x, z, w, floors, sawtooth) {
  const base = K.hy(Math.abs(x)), d = 7;
  const top = block(g, Math.sign(x), Math.abs(x) - d / 2, z, w, d, floors, T.U.fbcGround, T.U.fbc, { balcony: null, roof: 0xd9d2c3, base });
  if (sawtooth) for (let i = 0; i < Math.floor(w / 2.2); i++) add(g, G().pyr, 0x1f4d3a, 2.4, 1.1, 2.4, x, top + 0.8, z - w / 2 + 1.2 + i * 2.2);
  add(g, G().box, 0x1f4d3a, d + 0.4, 0.5, w + 0.4, x, base + 3.6, z);  // dark-green band
  return top;
}
D['FBC'] = {
  fill(g, kit, ctx) {
    if (!T) build(kit);
    LOD = 'low';
    ctx.slopeL.material = ctx.slopeR.material = K.M(pick([0x3f6f33, 0x45743a, 0x3a6a32]));
    for (const s of [-1, 1]) {
      for (let z = 0; z > -CH; z -= 6) { const h = rand(0.6, 2.2); add(g, G().box, 0xa0583a, rand(1.2, 2.2), h, 6.2, s * 9.9, h / 2, z - 3); add(g, G().box, 0x3f6f33, 1.6, 0.25, 6.2, s * 10.3, h + 0.1, z - 3); } // laterite cutting
      for (let i = 0; i < 5; i++) { const ax = rand(11, 24); K.addTree(g, s * ax, rand(-CH, 0), K.hy(ax), Math.random() < 0.25); }
      for (let i = 0; i < 4; i++) { const ax = rand(14, 40); conifer(g, s * ax, rand(-CH, 0), K.hy(ax)); }
      for (let i = 0; i < 3; i++) { const ax = rand(26, 48); K.addTree(g, s * ax, rand(-CH, 0), K.hy(ax), false); }
      if (Math.random() < 0.5) { const ax = rand(16, 30); fbcBlock(g, s * ax, rand(-24, -6), rand(8, 12), randi(2, 3), false); }
    }
    for (let i = 0; i < 3; i++) { const s = Math.random() < 0.5 ? -1 : 1; person(g, s * rand(6.3, 7.5), rand(-27, -3)); }
    add(g, G().cyl6, 0x6b4f37, 0.22, 8, 0.22, -8.1, 4, -CH / 2); add(g, G().box, 0x1c1c1c, 0.04, 0.04, CH, -8.1, 7.6, -CH / 2);
  },
  landmark(g, kit) {
    if (!T) build(kit);
    LOD = 'full';
    // campus gate on the kerb side
    for (const z of [-15.5, -10.5]) add(g, G().box, 0xefe9d6, 0.9, 3.6, 0.9, 8.0, 1.8, z);
    add(g, G().box, 0x1f4d3a, 1.0, 0.25, 5.0, 8.0, 3.7, -13);
    tbox(g, T.B.fbcgate, 0.12, 1.2, 6.2, 7.7, 4.5, -13);
    add(g, G().box, 0x3b3b3b, 0.08, 1.6, 2.0, 8.0, 1.0, -14.2);  // gate leaf
    add(g, G().box, 0x9a6a4a, 5, 0.1, 4.0, 11, 0.07, -13);      // drive
    // the campus on the hill: admin block with sawtooth roof, two hostels, conifers, water tank
    fbcBlock(g, 24, -14, 16, 3, true);
    fbcBlock(g, 34, -30, 12, 4, false);
    fbcBlock(g, 30, 8, 10, 2, false);
    fbcBlock(g, 44, -8, 14, 3, true);
    for (let i = 0; i < 7; i++) conifer(g, 19 + i * 0.9, -26 + i * 5.5, K.hy(19 + i * 0.9));
    for (let i = 0; i < 4; i++) conifer(g, 29 + i * 2.2, -18 - i * 2, K.hy(29 + i * 2.2));
    add(g, G().cyl6, 0x1e1e1e, 2.2, 2.4, 2.2, 36, K.hy(36) + 15.5, -30);
    for (let i = 0; i < 4; i++) { const ax = rand(16, 40); K.addTree(g, ax, rand(-34, 12), K.hy(ax), false); }
    for (let i = 0; i < 4; i++) person(g, rand(10.5, 14), rand(-9, -14));
  },
};
})();
