window.PODA = window.PODA || { vehicles: {}, districts: {} };
window.PODA.vehicles = window.PODA.vehicles || {};
window.PODA.districts = window.PODA.districts || {};

/* ================================================================
   Vehicles plug-in: Freetown traffic modelled from reference photos
   (see research/vehicles-notes.md).
   Every vehicle faces -z, sits on y = 0 and is centred on the origin.
   Side profiles are written as (s, y) points with s = -z (forward = +s).
   All geometry and textures are built once, lazily, and cached here;
   colour-only parts use kit.M() so the engine can bake them together.
   ================================================================ */
(() => {
  const V = window.PODA.vehicles;
  let K, T;
  const geoC = {}, matC = {};
  const once = (key, fn) => geoC[key] || (geoC[key] = fn());
  const FONT = 'Bungee, Impact, sans-serif';
  const PI = Math.PI;

  function init(kit) { if (!K) { K = kit; T = kit.THREE; } }

  /* ---------------- small helpers ---------------- */
  function mesh(parent, geo, mat, x, y, z, cast) {
    const m = new T.Mesh(geo, typeof mat === 'number' ? K.M(mat) : mat);
    m.position.set(x, y, z);
    if (cast) m.castShadow = true;
    parent.add(m);
    return m;
  }
  const box = (p, c, sx, sy, sz, x, y, z, cast) => K.add(p, K.G.box, c, sx, sy, sz, x, y, z, cast);
  function texMat(key, w, h, draw) {
    return matC[key] || (matC[key] = new T.MeshLambertMaterial({ map: K.canvasTex(w, h, draw) }));
  }
  function mapMat(tex) {
    return matC[tex.uuid] || (matC[tex.uuid] = new T.MeshLambertMaterial({ map: tex }));
  }
  // cylinder lying along x (wheels, rolls) / along z (lamps, exhausts)
  const cylX = (r, w, seg) => once(`cx${r}_${w}_${seg}`, () => new T.CylinderGeometry(r, r, w, seg).rotateZ(PI / 2));
  const cylZ = (r, w, seg) => once(`cz${r}_${w}_${seg}`, () => new T.CylinderGeometry(r, r, w, seg).rotateX(PI / 2));
  // side-profile extrusion across the width (x); caps land at +-(depth/2 + bevel)
  function extrudeX(key, pts, depth, bevel) {
    return once(key, () => {
      const sh = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
      const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 2 });
      g.rotateY(PI / 2); g.translate(-depth / 2, 0, 0);
      return g;
    });
  }
  // flat livery panel shaped like the side profile, facing +x (side 1) or -x (side -1).
  // UVs come from the box [s0, s1, y0, y1]; u runs rear->front on the right side and
  // front->rear on the left so painted text reads correctly from both sides.
  function sideGeo(key, pts, side, bb) {
    return once(key + side, () => {
      const sh = new T.Shape(pts.map(p => new T.Vector2(side > 0 ? p[0] : -p[0], p[1])));
      const g = new T.ShapeGeometry(sh);
      const P = g.attributes.position, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) {
        const s = side > 0 ? P.getX(i) : -P.getX(i);
        U.setXY(i, side > 0 ? (s - bb[0]) / (bb[1] - bb[0]) : (bb[1] - s) / (bb[1] - bb[0]), (P.getY(i) - bb[2]) / (bb[3] - bb[2]));
      }
      g.rotateY(side * PI / 2);
      return g;
    });
  }
  // plane or box showing one row of a texture atlas
  function rowGeo(key, geoFn, row, rows) {
    return once(`${key}_${row}`, () => {
      const g = geoFn(), U = g.attributes.uv;
      for (let i = 0; i < U.count; i++) U.setY(i, 1 - (row + 1) / rows + U.getY(i) / rows);
      return g;
    });
  }
  // lay a box/plane flat on a sloped panel of the side profile (F, R in (s, y))
  function onSlope(o, F, R, off) {
    const ds = R[0] - F[0], dy = R[1] - F[1], len = Math.hypot(ds, dy);
    let ns = dy / len, ny = -ds / len;
    if (ny < 0) { ns = -ns; ny = -ny; }
    o.position.set(o.position.x, (F[1] + R[1]) / 2 + ny * off, -((F[0] + R[0]) / 2 + ns * off));
    if (ns >= 0) o.rotation.set(Math.atan2(ny, ns), PI, 0);
    else o.rotation.set(Math.atan2(-ny, -ns), 0, 0);
    return o;
  }
  function wheel(g, x, y, z, r, w, hubR, hubCol, seg) {
    mesh(g, cylX(r, w, seg || 10), 0x1b1b1b, x, y, z);
    mesh(g, cylX(hubR, w + 0.02, 8), hubCol || 0xb4b8bc, x, y, z);
  }
  function txt(c, text, x, y, maxW, size, fill, stroke, lw) {
    K.fitText(c, text, maxW, size, FONT);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (stroke) { c.lineWidth = lw || 6; c.strokeStyle = stroke; c.strokeText(text, x, y); }
    c.fillStyle = fill; c.fillText(text, x, y);
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  // people: seated riders face forward (-z); seatY comes from people.js
  function seatPerson(g, role, x, seatH, z, opt) {
    const p = K.makePerson(Object.assign({ role, cast: true }, opt));
    const sy = p.userData.seatY != null ? p.userData.seatY : 0.8;
    p.rotation.y = PI; p.position.set(x, seatH - sy, z); g.add(p);
    return p;
  }
  function helmet(p, col) {
    const h = p.userData.head;
    if (h) {
      mesh(h, K.G.sph, col, 0, 1.645, -0.005).scale.set(0.27, 0.25, 0.29);
      box(h, 0x15181b, 0.19, 0.035, 0.05, 0, 1.67, 0.125);
    } else mesh(p, K.G.sph, col, 0, 1.74, 0).scale.set(0.4, 0.36, 0.42);
  }

  /* ================================================================
     PODA-PODA: Mercedes-Benz Sprinter T1N high-roof minibus
     ================================================================ */
  const PB = 0.06, PD = 1.88;                    // bevel, depth -> body sides at x = +-1.0
  const ARCH = (a, r, y0) => [[a + r + 0.02, y0], [a + r - 0.02, y0 + 0.16], [a + r * 0.55, y0 + 0.3], [a, y0 + 0.35], [a - r * 0.55, y0 + 0.3], [a - r + 0.02, y0 + 0.16], [a - r - 0.02, y0]];
  const P_BOTTOM = [...ARCH(1.75, 0.44, 0.48), ...ARCH(-1.55, 0.44, 0.48)];
  const PODA_PTS = [[-2.64, 0.48], [-2.64, 2.46], [-2.56, 2.52], [1.0, 2.52], [1.26, 2.27], [1.36, 2.16], [2.02, 1.26], [2.56, 1.05], [2.64, 0.94], [2.64, 0.48], ...P_BOTTOM];
  // painted lower side (below the window sill), same outline
  const PODA_LIV = [[-2.64, 0.48], [-2.64, 1.38], [1.932, 1.38], [2.02, 1.26], [2.56, 1.05], [2.64, 0.94], [2.64, 0.48], ...P_BOTTOM];
  const PODA_LIV_BB = [-2.64, 2.64, 0.48, 1.38];
  const CAB_GLASS = [[1.81, 1.44], [1.31, 2.12], [1.0, 2.12], [1.0, 1.44]];
  const WHITE = 0xf2efe6, SILVER = 0xc3c8cc, GLASS = 0x22313a;

  const COMPANIES = ['KAMARA TOURS', 'SESAY TRANSPORT', 'BANGURA TOURS', 'KOROMA & SONS', 'CONTEH TRAVELS', 'JALLOH EXPRESS',
    'TURAY TOURS', 'MANSARAY TRANSPORT', 'KARGBO & BROS', 'FOFANAH TOURS', 'BAH TRANSPORT', 'KANU EXPRESS'];
  const FRONT_SLOGANS = ['GOD IS GREAT', 'TRUST IN ALLAH', 'GOD WILL PROVIDE', 'NEVER DISCOURAGE', 'DONE DEM ALL', 'BLESSED', "GOD'S GIFT"];

  // liveries drawn from the photos; R(y0, y1, colour) paints a band in metres
  const LIVERIES = [
    { id: 'tricolour', body: WHITE, draw(c, W, H, R) {           // Salone flag stripes
      R(0.84, 0.95, '#1eb53a'); R(0.95, 0.99, hex(WHITE)); R(0.99, 1.1, '#0072c6');
    } },
    { id: 'redskirt', body: WHITE, draw(c, W, H, R) {            // poda-02: red lower body
      R(0.48, 0.8, '#c8242b'); R(0.8, 0.83, '#6e1418'); R(0.95, 0.975, '#1d4f9c');
    } },
    { id: 'flame', body: WHITE, draw(c, W, H, R, py) {           // poda-04: pinstripes, swoosh, sawtooth
      R(0.98, 1.015, '#f08a1c'); R(1.035, 1.06, '#1d4f9c');
      R(0.56, 0.68, '#15181b');
      c.fillStyle = hex(WHITE);
      for (let x = 0; x < W; x += 24) { c.beginPath(); c.moveTo(x, py(0.58)); c.lineTo(x + 12, py(0.66)); c.lineTo(x + 24, py(0.58)); c.fill(); }
      for (const end of [0, 1]) {
        c.save(); if (end) { c.translate(W, 0); c.scale(-1, 1); }
        c.beginPath(); c.moveTo(0, py(0.93)); c.bezierCurveTo(90, py(0.97), 120, py(0.72), 230, py(0.8));
        c.bezierCurveTo(150, py(0.84), 110, py(0.7), 0, py(0.72)); c.closePath();
        c.fillStyle = '#c8242b'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#1d4f9c'; c.stroke();
        c.restore();
      }
    } },
    { id: 'bluelower', body: WHITE, draw(c, W, H, R) {           // older vans: blue lower half
      R(0.48, 0.93, '#1d4f9c'); R(0.93, 0.955, hex(WHITE)); R(0.955, 0.995, '#c8242b');
    } },
    { id: 'silver', body: SILVER, draw(c, W, H, R) {             // factory silver with yellow band
      R(0.8, 0.93, '#f2c230'); R(0.95, 0.98, '#c8242b');
    } },
  ];
  function liveryMat(L) {
    const W = 1056, H = 180, py = y => H - (y - 0.48) / 0.9 * H;
    return texMat('liv_' + L.id, W, H, (c) => {
      const R = (y0, y1, col) => { c.fillStyle = col; c.fillRect(0, py(y1), W, py(y0) - py(y1)); };
      R(0.48, 1.38, hex(L.body));
      L.draw(c, W, H, R, py);
      R(0.48, 0.56, '#45484c');                                   // grey sill moulding
    });
  }
  function windowMat(body) {
    return texMat('podaWin' + body, 680, 152, (c, w, h) => {
      c.fillStyle = hex(body); c.fillRect(0, 0, w, h);
      const pil = 18, pw = (w - pil * 5) / 4;
      for (let i = 0; i < 4; i++) {
        const x = pil + i * (pw + pil);
        rrect(c, x, 8, pw, h - 16, 12); c.fillStyle = '#121a1f'; c.fill();
        rrect(c, x + 4, 12, pw - 8, h - 24, 9);
        const gr = c.createLinearGradient(0, 12, 0, h - 12); gr.addColorStop(0, '#2f4552'); gr.addColorStop(1, '#1b272e');
        c.fillStyle = gr; c.fill();
        c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.09)';
        c.beginPath(); c.moveTo(x + pw * 0.25, 0); c.lineTo(x + pw * 0.5, 0); c.lineTo(x + pw * 0.2, h); c.lineTo(x - pw * 0.05, h); c.fill();
        c.restore();
      }
    });
  }
  const nameMat = () => texMat('podaNames', 1024, 1024, (c, w, h) => {
    const rh = h / COMPANIES.length, cols = ['#c8242b', '#1d4f9c', '#17703a', '#7a1f2b'];
    c.fillStyle = hex(WHITE); c.fillRect(0, 0, w, h);
    COMPANIES.forEach((n, i) => txt(c, n, w / 2, (i + 0.55) * rh, w - 70, rh * 0.74, cols[i % 4], '#0f1d26', 7));
  });
  const bonnetMat = () => texMat('podaBonnet', 640, 1400, (c, w, h) => {
    const rh = h / FRONT_SLOGANS.length;
    c.fillStyle = hex(WHITE); c.fillRect(0, 0, w, h);
    FRONT_SLOGANS.forEach((s, i) => {
      txt(c, s, w / 2, (i + 0.5) * rh, w - 50, 118, i % 2 ? '#1d4f9c' : '#c8242b', '#0f1d26', 9);
    });
  });
  const routeMat = () => texMat('podaRoute', 512, 1040, (c, w, h) => {
    const names = K.DATA.route, rh = h / names.length;
    c.fillStyle = '#111518'; c.fillRect(0, 0, w, h);
    names.forEach((n, i) => txt(c, n.toUpperCase(), w / 2, (i + 0.54) * rh, w - 40, 54, '#ffb326'));
  });
  function routeRow(routeText) {
    const names = K.DATA.route.map(n => n.toUpperCase());
    const parts = String(routeText || '').toUpperCase().split(/[–—-]/).map(s => s.trim()).filter(Boolean);
    for (let k = parts.length - 1; k >= 0; k--) { const i = names.indexOf(parts[k]); if (i >= 0) return i; }
    return Math.max(0, names.indexOf('PZ'));
  }

  // roof-rack loads seen on Freetown podas
  const CARGO = [
    (g, x, y, z) => { box(g, 0xebe6d8, 0.72, 0.28, 0.5, x, y + 0.14, z, true); box(g, 0xd6cdb5, 0.68, 0.26, 0.48, x + 0.03, y + 0.41, z - 0.02, true); }, // rice sacks
    (g, x, y, z) => { box(g, 0x2f6fb5, 1.1, 0.46, 0.9, x, y + 0.23, z, true); box(g, 0x1c1c1c, 1.14, 0.04, 0.06, x, y + 0.47, z); },                       // tarp bundle + rope
    (g, x, y, z) => { box(g, 0x8a5a33, 0.6, 0.5, 0.6, x, y + 0.25, z, true).rotation.y = K.rand(-0.3, 0.3); },                                             // carton
    (g, x, y, z) => { box(g, 0xf2c230, 0.24, 0.36, 0.34, x - 0.14, y + 0.18, z, true); box(g, 0xf2c230, 0.24, 0.36, 0.34, x + 0.14, y + 0.18, z + 0.04, true); }, // jerrycans
    (g, x, y, z) => { mesh(g, cylX(0.24, 1.4, 8), 0xd8c39a, 0, y + 0.24, z, true); },                                                                      // rolled foam mattress
    (g, x, y, z) => { box(g, 0x9c2a2a, 0.8, 0.42, 0.56, x, y + 0.21, z, true); box(g, 0x2d4f8a, 0.82, 0.06, 0.58, x, y + 0.3, z); },                         // "Ghana must go" bag
  ];

  V.podapoda = function (kit, opt) {
    init(kit);
    opt = opt || {};
    const g = new T.Group();
    const L = opt.scheme === K.SCHEMES[0] ? LIVERIES[0] : K.pick(LIVERIES);
    const crew = !!opt.withCrew;

    mesh(g, extrudeX('podaBody', PODA_PTS, PD, PB), L.body, 0, 0, 0, true);
    box(g, 0x1e2124, 1.72, 0.4, 4.6, 0, 0.62, 0.1);                         // underbody / wheel wells
    const liv = liveryMat(L), win = windowMat(L.body);
    const nameRow = K.randi(0, COMPANIES.length - 1);
    for (const s of [1, -1]) {
      mesh(g, sideGeo('podaLiv', PODA_LIV, s, PODA_LIV_BB), liv, s * 1.004, 0, 0);
      mesh(g, once('podaWinG', () => new T.PlaneGeometry(3.4, 0.76)), win, s * 1.004, 1.82, 0.8).rotation.y = s * PI / 2;
      const nx = s > 0 && crew ? 1.053 : 1.007;
      mesh(g, rowGeo('podaName', () => new T.PlaneGeometry(2.7, 0.27), nameRow, COMPANIES.length), nameMat(), s * nx, 1.21, s > 0 && crew ? 1.3 : 1.05).rotation.y = s * PI / 2;
      box(g, 0x1a1a1a, 0.2, 0.34, 0.07, s * 1.1, 1.72, -1.88);                // big Sprinter mirror
    }
    mesh(g, extrudeX('podaCab', CAB_GLASS, 2.012, 0), GLASS, 0, 0, 0);
    // windscreen, route board along its top, painted bonnet slogan
    onSlope(mesh(g, K.G.box, GLASS, 0, 0, 0), [2.02, 1.26], [1.36, 2.16], PB + 0.01).scale.set(1.82, 1.04, 0.02);
    onSlope(mesh(g, rowGeo('podaRouteG', () => new T.PlaneGeometry(1.5, 0.22), routeRow(opt.routeText), K.DATA.route.length), routeMat(), 0, 0, 0),
      [1.52, 1.94], [1.4, 2.11], PB + 0.025);
    const slogan = opt.withCrew || Math.random() < 0.75 ? 0 : K.randi(1, FRONT_SLOGANS.length - 1); // the player's poda always says GOD IS GREAT
    onSlope(mesh(g, rowGeo('podaBonnetG', () => new T.PlaneGeometry(1.8, 0.56), slogan, FRONT_SLOGANS.length), bonnetMat(), 0, 0, 0),
      [2.56, 1.05], [2.02, 1.26], PB + 0.004);
    // nose: bumper, grille + star, headlights, plate
    box(g, 0x3b3e42, 2.04, 0.24, 0.18, 0, 0.44, -2.72);
    box(g, 0x2a2d30, 0.86, 0.3, 0.04, 0, 0.78, -2.705);
    mesh(g, cylZ(0.075, 0.03, 10), 0xc9cdd1, 0, 0.8, -2.73);
    for (const s of [1, -1]) {
      box(g, 0x2f3236, 0.5, 0.3, 0.03, s * 0.7, 0.8, -2.702);                // headlight housing
      box(g, 0xe9eef0, 0.4, 0.22, 0.04, s * 0.68, 0.81, -2.71);
    }
    box(g, 0xf4f4f0, 0.5, 0.12, 0.02, 0, 0.44, -2.82);
    // rear: slogan + route (engine texture), tall Sprinter tail lights, bumper, plate
    mesh(g, once('podaRearG', () => new T.PlaneGeometry(1.76, 0.88)), mapMat(K.getSloganTex(opt.slogan || 'GOD IS GREAT', opt.routeText || 'LUMLEY – PZ')), 0, 1.9, 2.705);
    for (const s of [1, -1]) { box(g, 0xc0161b, 0.14, 0.62, 0.04, s * 0.9, 0.98, 2.705); box(g, 0xf0a020, 0.14, 0.14, 0.04, s * 0.9, 1.37, 2.705); }
    box(g, 0x2b2e31, 0.025, 0.95, 0.012, 0, 0.98, 2.706);
    box(g, 0x3b3e42, 2.0, 0.22, 0.16, 0, 0.45, 2.74);
    box(g, 0xf4f4f0, 0.5, 0.13, 0.02, 0, 0.75, 2.71);
    // wheels: steel rims with hub caps
    for (const [x, z] of [[0.87, -1.75], [-0.87, -1.75], [0.87, 1.55], [-0.87, 1.55]]) wheel(g, x, 0.36, z, 0.36, 0.26, 0.21, 0xa9adb1);
    // roof rack and load
    const ry = 2.58;
    for (const s of [1, -1]) box(g, 0x2a2a2a, 0.06, 0.12, 3.4, s * 0.86, ry + 0.06, 0.85);
    for (const z of [-0.7, 0.85, 2.4]) box(g, 0x2a2a2a, 1.78, 0.05, 0.06, 0, ry + 0.02, z);
    const slots = [-0.4, 0.5, 1.4, 2.2], n = crew ? 2 : K.randi(2, 4);
    K.pick([0, 1]) && slots.reverse();
    for (let i = 0; i < n; i++) K.pick(CARGO)(g, K.rand(-0.25, 0.25), ry + 0.04, slots[i]);

    if (crew) {
      // sliding door open on the right: dark doorway, door slid back along the body
      box(g, 0x0d1215, 0.012, 1.72, 1.1, 1.008, 1.34, -0.3);
      box(g, L.body, 0.035, 1.76, 1.12, 1.03, 1.34, 0.86, true);
      box(g, GLASS, 0.01, 0.64, 0.86, 1.05, 1.82, 0.86);
      const piv = new T.Group(); piv.position.set(1.04, 0.4, -0.25); piv.rotation.z = -0.34; g.add(piv);
      const app = K.makePerson({ lappa: false, role: 'apprentice', cast: true });
      app.rotation.y = 0.42 * PI; piv.add(app);
      const u = app.userData;
      if (u.armR) u.armR.rotation.z = 2.3;
      if (u.armL) u.armL.rotation.z = -1.45;
      g.userData.apprentice = app;
    }
    return g;
  };

  /* ================================================================
     KEKEH: Bajaj RE / TVS King auto-rickshaw
     ================================================================ */
  const KEKE_REAR = [[-1.38, 0.26], [-1.38, 0.98], [-0.98, 0.98], [-0.92, 0.7], [0.55, 0.7], [0.55, 0.26], ...ARCH(-0.8, 0.28, 0.26)];
  const KEKE_COWL = [[0.42, 0.26], [0.42, 0.98], [0.84, 1.12], [1.2, 1.08], [1.38, 0.92], [1.44, 0.6], [1.42, 0.34], [1.36, 0.34],
    [1.32, 0.46], [1.22, 0.53], [1.1, 0.55], [0.98, 0.53], [0.88, 0.46], [0.84, 0.26]];
  const KEKE_COLS = [
    { body: 0xf2b705, accent: 0x1e8c3a },   // keke-01/03: yellow with green
    { body: 0x1e8c3a, accent: 0xf2c230 },   // keke-02/04: green with yellow
    { body: 0x1f6fd1, accent: 0xf2c230 },   // keke-02/06: TVS blue, yellow bumpers
    { body: 0xf29a05, accent: 0x1b1b1b },   // keke-05: orange-yellow with black
  ];
  const KEKE_TEXT = ['EXECUTIVE TRANSPORTATION', 'GOD IS GREAT', 'NO JEALOUSY'];
  const kekeRearMat = () => texMat('kekeRear', 512, 1023, (c, w) => {
    const rh = 1023 / KEKE_TEXT.length;
    KEKE_TEXT.forEach((t, i) => {
      const y0 = i * rh;
      c.fillStyle = '#1b1b1b'; c.fillRect(0, y0, w, rh);
      c.setLineDash([10, 8]); c.strokeStyle = '#555'; c.lineWidth = 4; c.strokeRect(14, y0 + 14, w - 28, rh - 28); c.setLineDash([]);
      rrect(c, w * 0.28, y0 + rh * 0.14, w * 0.44, rh * 0.38, 18); c.fillStyle = '#6f8b97'; c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(w * 0.34, y0 + rh * 0.17, w * 0.06, rh * 0.32);
      const words = t.split(' ');
      if (words.length > 2 || t.length > 14) {
        txt(c, words[0], w / 2, y0 + rh * 0.66, w - 70, 64, '#f4f4f0');
        txt(c, words.slice(1).join(' '), w / 2, y0 + rh * 0.82, w - 70, 48, '#ffc23d');
      } else txt(c, t, w / 2, y0 + rh * 0.72, w - 70, 72, '#ffc23d');
    });
  });
  const canopyGeo = () => once('kekeCanopy', () => {
    const pts = [[-0.73, 1.7], [-0.73, 1.86], [-0.52, 1.95], [0, 1.99], [0.52, 1.95], [0.73, 1.86], [0.73, 1.7],
      [0.69, 1.7], [0.69, 1.83], [0.49, 1.91], [0, 1.95], [-0.49, 1.91], [-0.69, 1.83], [-0.69, 1.7]];
    const g = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))), { depth: 2.22, bevelEnabled: false });
    return g.translate(0, 0, -0.8);
  });

  V.kekeh = function (kit) {
    init(kit);
    const g = new T.Group(), C = K.pick(KEKE_COLS);
    mesh(g, extrudeX('kekeRear', KEKE_REAR, 1.28, 0.04), C.body, 0, 0, 0, true);
    mesh(g, extrudeX('kekeCowl', KEKE_COWL, 0.92, 0.04), C.body, 0, 0, 0, true);
    box(g, C.accent, 1.38, 0.08, 1.95, 0, 0.6, 0.445);                       // side + rear accent band
    box(g, C.accent, 0.78, 0.1, 0.12, 0, 0.32, -1.47);                       // front nose bumper
    onSlope(mesh(g, K.G.box, 0x86a6b4, 0, 0, 0), [0.84, 1.12], [0.72, 1.72], 0.01).scale.set(0.84, 0.6, 0.02);
    for (const s of [1, -1]) {
      box(g, 0x1b1b1b, 0.04, 0.66, 0.04, s * 0.44, 1.4, -0.79);              // windscreen pillars
      box(g, 0xc4c8cc, 0.03, 0.88, 0.03, s * 0.69, 1.28, 0.95);              // canopy posts
      box(g, 0xc4c8cc, 0.03, 0.03, 0.95, s * 0.7, 1.06, 0.45);               // grab rails
      box(g, 0x1b1b1b, 0.02, 0.2, 0.02, s * 0.44, 1.2, -0.88);               // mirror stalk
      box(g, 0x1b1b1b, 0.11, 0.07, 0.03, s * 0.5, 1.32, -0.88);              // mirror
      box(g, 0xc0161b, 0.14, 0.12, 0.03, s * 0.5, 0.82, 1.435);              // tail light
    }
    mesh(g, canopyGeo(), 0x1b1b1b, 0, 0, 0, true);
    mesh(g, rowGeo('kekeRearG', () => new T.BoxGeometry(1.36, 0.86, 0.03), K.randi(0, KEKE_TEXT.length - 1), KEKE_TEXT.length), kekeRearMat(), 0, 1.42, 1.405);
    box(g, 0x222222, 0.5, 0.1, 0.36, 0, 0.86, -0.22);                        // driver seat
    box(g, 0x1b1b1b, 0.62, 0.04, 0.04, 0, 1.1, -0.62);                       // handlebar
    box(g, 0x2a2a2a, 1.2, 0.12, 0.42, 0, 0.86, 0.72);                        // rear bench
    box(g, 0x2a2a2a, 1.2, 0.42, 0.08, 0, 1.15, 0.97);
    box(g, 0x2a2a2a, 1.3, 0.06, 0.06, 0, 0.36, 1.45);                        // rear bar
    mesh(g, cylZ(0.09, 0.04, 10), 0xfff3c0, 0, 0.86, -1.48);                 // headlight
    wheel(g, 0, 0.22, -1.1, 0.22, 0.13, 0.1);
    for (const s of [1, -1]) wheel(g, s * 0.6, 0.24, 0.8, 0.24, 0.16, 0.1);
    seatPerson(g, 'driver', 0, 0.92, -0.2, { lappa: false });
    if (Math.random() < 0.6) seatPerson(g, 'rider', K.pick([-0.32, 0.32]), 0.93, 0.7, {});
    return { g, wid: 1.5, len: 2.8 };
  };

  /* ================================================================
     OKADA: commuter motorbike taxi (Bajaj Boxer / TVS / Haojue)
     ================================================================ */
  const OKADA_TANK = [[0.52, 0.8], [0.5, 0.98], [0.3, 1.03], [0.06, 0.96], [0.02, 0.8]];
  const OKADA_COLS = [0xc8242b, 0x1b1b1b, 0x1f4fa8, 0xb9bec2, 0x7a1f2b];
  const HELMETS = [0xc8242b, 0xf4f4f0, 0x1b1b1b, 0xf2c230, 0x1f4fa8];
  V.okada = function (kit) {
    init(kit);
    const g = new T.Group(), col = K.pick(OKADA_COLS), chrome = 0xc4c8cc;
    for (const z of [-0.64, 0.62]) wheel(g, 0, 0.3, z, 0.3, 0.1, 0.12, chrome, 12);
    const fork = box(g, chrome, 0.14, 0.64, 0.06, 0, 0.64, -0.57); fork.rotation.x = 0.3;
    box(g, col, 0.13, 0.04, 0.42, 0, 0.64, -0.66);                           // front mudguard
    box(g, 0x1b1b1b, 0.26, 0.24, 0.18, 0, 0.98, -0.74);                      // headlight cowl
    box(g, 0xfff3c8, 0.16, 0.13, 0.02, 0, 0.98, -0.835);
    box(g, 0x1b1b1b, 0.74, 0.035, 0.035, 0, 1.1, -0.6);                      // handlebar
    for (const s of [1, -1]) { box(g, 0x1b1b1b, 0.02, 0.22, 0.02, s * 0.27, 1.22, -0.6); box(g, 0x1b1b1b, 0.11, 0.07, 0.02, s * 0.29, 1.34, -0.6); }
    mesh(g, extrudeX('okadaTank', OKADA_TANK, 0.24, 0.03), col, 0, 0, 0, true);
    box(g, col, 0.28, 0.2, 0.32, 0, 0.7, 0.12);                              // side covers
    box(g, K.pick([0x1b1b1b, 0x1b1b1b, 0x6e1418, 0x3a2a20]), 0.3, 0.1, 0.8, 0, 0.86, 0.26, true); // seat
    box(g, 0x4a4d50, 0.24, 0.3, 0.38, 0, 0.45, -0.06);                       // engine
    mesh(g, cylZ(0.04, 0.62, 6), chrome, 0.15, 0.36, 0.36);                  // exhaust
    box(g, chrome, 0.3, 0.03, 0.3, 0, 0.88, 0.78);                           // rear carrier
    box(g, col, 0.14, 0.04, 0.4, 0, 0.7, 0.68).rotation.x = -0.25;           // rear mudguard
    box(g, 0xc0161b, 0.12, 0.06, 0.04, 0, 0.8, 0.94);
    box(g, 0xf4f4f0, 0.17, 0.1, 0.01, 0, 0.69, 0.93);                        // plate
    const rider = seatPerson(g, 'rider', 0, 0.92, 0.1, { lappa: false });
    if (Math.random() < 0.85) helmet(rider, K.pick(HELMETS));
    if (Math.random() < 0.8) {
      const pass = seatPerson(g, 'rider', 0, 0.96, 0.5, {});
      if (Math.random() < 0.15) helmet(pass, K.pick(HELMETS));
    }
    return { g, wid: 0.9, len: 1.9, weave: true };
  };

  /* ================================================================
     TAXI: Nissan Sunny saloon in Freetown taxi yellow
     ================================================================ */
  const TB = 0.05, TAXI_Y = 0xf0c21b;
  const T_BOTTOM = [...ARCH(1.3, 0.38, 0.33), ...ARCH(-1.3, 0.38, 0.33)];
  const TAXI_LOW = [[-2.05, 0.33], [-2.05, 0.86], [-1.95, 0.93], [-1.3, 0.95], [1.25, 0.95], [1.95, 0.84], [2.05, 0.74], [2.05, 0.33], ...T_BOTTOM];
  const TAXI_LOW_BB = [-2.05, 2.05, 0.33, 0.95];
  const TAXI_CAB = [[1.25, 0.9], [0.42, 1.36], [-0.72, 1.36], [-1.3, 0.9]];
  function taxiSideMat(ward, side) {
    const W = 820, H = 124, px = s => side > 0 ? (s + 2.05) * 200 : (2.05 - s) * 200, py = y => (0.95 - y) * 200;
    return texMat(`taxi_${ward}_${side}`, W, H, c => {
      c.fillStyle = hex(TAXI_Y); c.fillRect(0, 0, W, H);
      c.fillStyle = '#7d8185'; c.fillRect(0, py(0.4), W, H);                 // grey sills
      c.fillStyle = '#16181a'; c.fillRect(0, py(0.705), W, 9);              // waist stripe
      c.fillStyle = '#b08a12';
      for (const s of [1.02, -0.06, -1.12]) c.fillRect(px(s) - 1.5, py(0.93), 3, py(0.42) - py(0.93));
      c.fillStyle = '#2a2a2a';
      for (const s of [0.1, -0.98]) c.fillRect(Math.min(px(s), px(s - 0.16)), py(0.82), 32, 7);
      const cx = (px(-0.12) + px(-1.04)) / 2;
      txt(c, ward + ' WARD', cx, py(0.62), 170, 24, '#16181a');
    });
  }
  V.taxi = function (kit) {
    init(kit);
    const g = new T.Group(), ward = K.pick(['WEST', 'EAST']);
    mesh(g, extrudeX('taxiLow', TAXI_LOW, 1.8, TB), TAXI_Y, 0, 0, 0, true);
    mesh(g, extrudeX('taxiCab', TAXI_CAB, 1.5, TB), TAXI_Y, 0, 0, 0, true);
    box(g, 0x1e2124, 1.6, 0.3, 3.4, 0, 0.5, 0);
    mesh(g, once('taxiGlass', () => {
      const a = new T.Shape([[1.05, 0.98], [0.4, 1.3], [-0.02, 1.3], [-0.02, 0.98]].map(p => new T.Vector2(p[0], p[1])));
      const b = new T.Shape([[-0.1, 0.98], [-0.1, 1.3], [-0.66, 1.3], [-1.1, 0.98]].map(p => new T.Vector2(p[0], p[1])));
      const geo = new T.ExtrudeGeometry([a, b], { depth: 1.612, bevelEnabled: false });
      return geo.rotateY(PI / 2).translate(-0.806, 0, 0);
    }), GLASS, 0, 0, 0);
    onSlope(mesh(g, K.G.box, GLASS, 0, 0, 0), [1.25, 0.9], [0.42, 1.36], TB + 0.01).scale.set(1.42, 0.86, 0.02);
    onSlope(mesh(g, K.G.box, GLASS, 0, 0, 0), [-1.3, 0.9], [-0.72, 1.36], TB + 0.01).scale.set(1.42, 0.62, 0.02);
    if (Math.random() < 0.25) onSlope(mesh(g, K.G.box, K.pick([0xa9b4bd, 0xe9e9e4]), 0, 0, 0), [1.95, 0.84], [1.25, 0.95], TB + 0.006).scale.set(1.62, 0.66, 0.012);
    for (const s of [1, -1]) {
      mesh(g, sideGeo('taxiLiv', TAXI_LOW, s, TAXI_LOW_BB), taxiSideMat(ward, s), s * 0.954, 0, 0);
      box(g, 0x1b1b1b, 0.14, 0.09, 0.05, s * 0.86, 1.0, -0.98);               // mirror
      box(g, 0xeeeedd, 0.42, 0.13, 0.04, s * 0.6, 0.72, -2.105);             // headlight
      box(g, 0xc0161b, 0.44, 0.15, 0.04, s * 0.6, 0.8, 2.105);               // tail light
    }
    box(g, 0x2a2a2a, 0.6, 0.1, 0.04, 0, 0.7, -2.105);                        // grille
    box(g, 0x262626, 1.86, 0.2, 0.16, 0, 0.42, -2.1);                        // bumpers
    box(g, 0x262626, 1.86, 0.2, 0.16, 0, 0.42, 2.1);
    box(g, 0xf4f4f0, 0.46, 0.12, 0.02, 0, 0.62, 2.11);                       // plate
    for (const [x, z] of [[0.83, -1.3], [-0.83, -1.3], [0.83, 1.3], [-0.83, 1.3]]) wheel(g, x, 0.31, z, 0.31, 0.2, 0.17, 0xc9cdd1);
    return { g, wid: 1.95, len: 4.2 };
  };

  /* ================================================================
     WAKA FINE: 2024 government city bus in national colours
     ================================================================ */
  const WB = 0.1, WD = 2.3;                                                   // sides at x = +-1.25
  const W_ARCH = (a) => [[a + 0.66, 0.42], [a + 0.62, 0.7], [a + 0.4, 1.02], [a, 1.16], [a - 0.4, 1.02], [a - 0.62, 0.7], [a - 0.66, 0.42]];
  const WAKA_PTS = [[-4.4, 0.42], [-4.4, 2.9], [4.4, 2.9], [4.4, 0.42], ...W_ARCH(2.3), ...W_ARCH(-2.4)];
  const WAKA_BB = [-4.4, 4.4, 0.42, 2.9];
  const WG = '#1eb53a', WBL = '#1f6fc0', WY = '#f2c230', WW = '#f4f4f0';
  function wakaLogo(c, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, PI * 2); c.lineWidth = r * 0.16; c.strokeStyle = '#2b3a44'; c.stroke();
    c.fillStyle = '#2b3a44'; c.fillRect(x - r * 0.5, y - r * 0.42, r, r * 0.7);
    c.fillStyle = WW; c.fillRect(x - r * 0.38, y - r * 0.3, r * 0.76, r * 0.24);
    c.fillStyle = '#2b3a44'; c.beginPath(); c.arc(x - r * 0.3, y + r * 0.34, r * 0.13, 0, PI * 2); c.arc(x + r * 0.3, y + r * 0.34, r * 0.13, 0, PI * 2); c.fill();
  }
  function wakaSideMat(side) {
    const k = 120, W = Math.round(8.8 * k), H = Math.round(2.48 * k);
    const px = s => side > 0 ? (s + 4.4) * k : (4.4 - s) * k, py = y => (2.9 - y) * k;
    const R = (c, s0, s1, y0, y1, col) => { c.fillStyle = col; const a = px(s0), b = px(s1); c.fillRect(Math.min(a, b), py(y1), Math.abs(b - a), py(y0) - py(y1)); };
    return texMat('wakaSide' + side, W, H, c => {
      R(c, -4.4, 4.4, 0.42, 2.9, WW);
      R(c, -4.4, 4.4, 0.42, 0.5, WY);
      R(c, -4.4, 4.4, 0.5, 1.22, WBL);
      R(c, -4.4, 4.4, 2.66, 2.9, WG);
      // front swoop of green down the windscreen corner
      c.fillStyle = WG; c.beginPath(); c.moveTo(px(3.1), py(2.9)); c.bezierCurveTo(px(3.9), py(2.85), px(4.2), py(2.4), px(4.4), py(1.62));
      c.lineTo(px(4.4), py(2.9)); c.closePath(); c.fill();
      // window band: black frames, tinted panes
      R(c, -4.25, 4.3, 1.6, 2.56, '#121416');
      for (let s = -4.2; s < 4.2; s += 1.3) {
        const s1 = Math.min(s + 1.22, 4.25);
        const a = px(s), b = px(s1);
        const gr = c.createLinearGradient(0, py(2.5), 0, py(1.66)); gr.addColorStop(0, '#34495a'); gr.addColorStop(1, '#1b262e');
        c.fillStyle = gr; c.fillRect(Math.min(a, b), py(2.5), Math.abs(b - a), py(1.66) - py(2.5));
      }
      if (side > 0) for (const [d0, d1] of [[3.0, 4.1], [-0.6, 0.6]]) {               // glass doors (right side)
        R(c, d0, d1, 0.5, 2.56, '#2a2d30');
        const m = (d0 + d1) / 2;
        R(c, d0 + 0.07, m - 0.03, 0.62, 2.48, '#2c4150'); R(c, m + 0.03, d1 - 0.07, 0.62, 2.48, '#2c4150');
      }
      // WAKA FINE band under the windows
      const tx = px(-1.9);
      txt(c, 'WAKA FINE', tx, py(1.44), 3.2 * k, 30, '#2b3a44');
      K.fitText(c, 'Moving more people faster', 3.2 * k, 15, 'Outfit, sans-serif'); c.fillStyle = '#2b3a44'; c.fillText('Moving more people faster', tx, py(1.28));
      wakaLogo(c, px(side > 0 ? -0.2 : -3.6), py(1.4), 15);
    });
  }
  const wakaFrontMat = () => texMat('wakaFront', 460, 496, (c, w, h) => {
    const px = x => (x + 1.15) * 200, py = y => (2.9 - y) * 200;
    c.fillStyle = WW; c.fillRect(0, 0, w, h);
    c.fillStyle = WBL; c.fillRect(0, py(0.95), w, h); c.fillStyle = WY; c.fillRect(0, py(0.5), w, h);
    c.fillStyle = WG; c.fillRect(0, 0, w, py(2.5));
    rrect(c, px(-0.85), py(2.86), px(0.85) - px(-0.85), py(2.6) - py(2.86), 6); c.fillStyle = '#0b0d0f'; c.fill();
    txt(c, 'WAKA FINE', w / 2, py(2.73), px(0.75) - px(-0.75), 34, '#ffb326');
    rrect(c, px(-1.08), py(2.47), px(1.08) - px(-1.08), py(1.2) - py(2.47), 16); c.fillStyle = '#0f1214'; c.fill();
    const gr = c.createLinearGradient(0, py(2.4), 0, py(1.26)); gr.addColorStop(0, '#3a5160'); gr.addColorStop(1, '#1c2830');
    rrect(c, px(-1.02), py(2.42), px(1.02) - px(-1.02), py(1.26) - py(2.42), 12); c.fillStyle = gr; c.fill();
    c.fillStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(px(-0.6), py(2.42)); c.lineTo(px(-0.25), py(2.42)); c.lineTo(px(-0.7), py(1.26)); c.lineTo(px(-1.02), py(1.26)); c.fill();
    for (const s of [-1, 1]) { rrect(c, px(s * 0.82) - 34, py(0.85), 68, 26, 10); c.fillStyle = '#f3f0dc'; c.fill(); }
    wakaLogo(c, w / 2, py(1.08), 18);
  });
  const wakaRearMat = () => texMat('wakaRear', 460, 496, (c, w, h) => {
    const px = x => (x + 1.15) * 200, py = y => (2.9 - y) * 200;
    c.fillStyle = WW; c.fillRect(0, 0, w, h);
    c.fillStyle = WG; c.fillRect(0, 0, w, py(2.62));
    c.fillStyle = WBL; c.fillRect(0, py(1.05), w, h); c.fillStyle = WY; c.fillRect(0, py(0.5), w, h);
    rrect(c, px(-0.85), py(2.5), px(0.85) - px(-0.85), py(1.95) - py(2.5), 10); c.fillStyle = '#1b262e'; c.fill();
    txt(c, 'WAKA FINE', w / 2, py(1.66), px(0.8) - px(-0.8), 46, '#2b3a44');
    K.fitText(c, 'Moving more people faster', px(0.8) - px(-0.8), 20, 'Outfit, sans-serif'); c.fillStyle = '#2b3a44'; c.fillText('Moving more people faster', w / 2, py(1.4));
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0.62; y < 0.98; y += 0.07) c.fillRect(px(-0.6), py(y), px(0.6) - px(-0.6), 5);
    for (const s of [-1, 1]) { c.fillStyle = '#c0161b'; c.fillRect(px(s * 1.04) - 14, py(1.75), 28, py(0.75) - py(1.75)); c.fillStyle = '#f0a020'; c.fillRect(px(s * 1.04) - 14, py(1.0), 28, py(0.75) - py(1.0)); }
    c.fillStyle = '#f4f4f0'; c.fillRect(px(-0.25), py(0.95), px(0.25) - px(-0.25), 24);
  });
  V.wakaFine = function (kit) {
    init(kit);
    const g = new T.Group();
    mesh(g, extrudeX('wakaBody', WAKA_PTS, WD, WB), 0xf4f4f0, 0, 0, 0, true);
    box(g, 0x1e2124, 2.1, 0.62, 8.2, 0, 0.74, 0);
    for (const s of [1, -1]) {
      mesh(g, sideGeo('wakaSide', WAKA_PTS, s, WAKA_BB), wakaSideMat(s), s * 1.255, 0, 0);
      const arm = box(g, 0x1b1b1b, 0.05, 0.05, 0.5, s * 1.27, 2.66, -4.62); arm.rotation.x = 0.5; arm.rotation.y = s * 0.25;
      box(g, 0x1b1b1b, 0.08, 0.42, 0.2, s * 1.36, 2.28, -4.86);
    }
    const face = once('wakaFaceG', () => new T.PlaneGeometry(2.3, 2.48));
    mesh(g, face, wakaFrontMat(), 0, 1.66, -4.505).rotation.y = PI;
    mesh(g, face, wakaRearMat(), 0, 1.66, 4.505);
    box(g, 0x1eb53a, 2.3, 0.02, 8.8, 0, 3.005, 0);                            // green roof
    box(g, 0xe6e6e1, 1.5, 0.24, 2.2, 0, 3.13, -0.6, true);                    // roof A/C pod
    box(g, 0x3a3d40, 2.42, 0.28, 0.14, 0, 0.48, -4.56);
    box(g, 0x3a3d40, 2.42, 0.28, 0.14, 0, 0.48, 4.56);
    for (const s of [1, -1]) {
      wheel(g, s * 1.0, 0.5, -2.3, 0.5, 0.32, 0.26, 0xb4b8bc, 12);
      wheel(g, s * 0.95, 0.5, 2.4, 0.5, 0.45, 0.26, 0xb4b8bc, 12);
    }
    return { g, wid: 2.5, len: 9 };
  };
})();
