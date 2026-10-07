window.PODA = window.PODA || { vehicles: {}, districts: {} };
window.PODA.vehicles = window.PODA.vehicles || {};
window.PODA.districts = window.PODA.districts || {};

/* ================================================================
   West Freetown: Goderich, Lumley Beach Road, Chapter One, Aberdeen,
   Lumley, Wilberforce, IMATT. Modelled from photos in research/refs/
   (see research/west-notes.md). Built around a handful of shared,
   parametrised helpers so each place stays cheap and distinct.
   ================================================================ */
(function () {
  'use strict';

  // ---- palettes pulled from the reference photos (module-level, no per-fill alloc) ----
  const SEA = 0x3f7f93, FOAM = 0xe8f1ee, SAND = 0xd8c48a, WET_SAND = 0xab9468;
  const CREEK = 0x56726b, CREEK_GREEN = 0x5c6a46, MANGROVE = 0x3c6b43;
  const ZINC = [0x8a8f91, 0x9a7a63, 0x716a5e, 0xb5a98f, 0x6e7276];
  const BOARD_WALL = [0xf4ede0, 0xcf9a3e, 0x5e7a72, 0xdacb9e, 0xbfb196];
  const TRIM = [0x5a2a22, 0x7f4a32, 0x2e3a2c];
  const RESORT_WALL = [0xf7f2e6, 0xf0e3c6, 0xe9d9b8];
  const THATCH = 0xc9a469;
  const CANOE = [0xd8333a, 0x1eb53a, 0x0072c6, 0xf2c230, 0xf2f2f2, 0x1c3f8a];
  const WALL_COL = 0xcac2ad, GATE_DARK = 0x2b2b2b;
  const C1_DARK = 0x3a3d42, C1_WOOD = 0xc9a06a, C1_POOL = 0x1c8f8a;

  // a unit horizontal plane (x,z extents via scale), reused for sand/sea/pool/decks
  const GP = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  // ---- all signage packed into ONE atlas texture + ONE material, so every sign in a
  // chunk (however many different places they advertise) bakes into a single draw call
  // instead of one per distinct texture. Each row is a 512x160 sign; geometries are
  // built once with their UVs remapped to their row, then just scaled per use.
  const SIGN_ROWS = ['chapterOne', 'imatt', 'goderich', 'lumley', 'aberdeen', 'wilberforce', 'lumleyBeach', 'bar0', 'bar1', 'bar2', 'bar3', 'bar4'];
  const BAR_NAMES = ['bar0', 'bar1', 'bar2', 'bar3', 'bar4'];
  let texReady = false, atlasMat = null, lumleyWallMats = [];
  let lumleyShopMat = null, lumleyShutterMat = null, lumleyRoofMat = null;
  const lumleyShopGeos = [];
  const signGeo = {};
  function signMesh(name, w, h) {
    const m = new THREE.Mesh(signGeo[name], atlasMat);
    m.scale.set(w, h, 1);
    return m;
  }
  function ensureTex(kit) {
    if (texReady) return; texReady = true;
    const rowW = 512, rowH = 160, n = SIGN_ROWS.length;
    const draw1 = (bg, fg, big, small) => (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.textAlign = 'center';
      kit.fitText(g, big, w - 50, 54, 'Bungee, Impact, sans-serif'); g.fillText(big, w / 2, h / 2 + 8);
      if (small) { g.font = '22px Outfit, sans-serif'; g.fillText(small, w / 2, h / 2 + 42); }
    };
    const drawers = {
      chapterOne: draw1('#15171a', '#d4af37', 'CHAPTER ONE', 'BEACH CLUB'),
      imatt: draw1('#5c5a4e', '#e9e4d2', 'IMATT', 'JUNCTION'),
      goderich: draw1('#163b57', '#ffffff', 'GODERICH', 'FISH LANDING'),
      lumley: draw1('#0a6b34', '#ffffff', 'LUMLEY', null),
      aberdeen: draw1('#2a4a63', '#ffffff', 'ABERDEEN', 'BRIDGE'),
      wilberforce: draw1('#4a3b2a', '#f0e6cf', 'WILBERFORCE', null),
      lumleyBeach: draw1('#1f5f8a', '#ffffff', 'LUMLEY BEACH', null),
      bar0: draw1('#1e6e55', '#fff6df', 'SUNSET BAR', null),
      bar1: draw1('#a3401f', '#fff6df', 'ATLANTIC BAR', null),
      bar2: draw1('#1f5f8a', '#fff6df', 'COOL BEACH SPOT', null),
      bar3: draw1('#8a6a1f', '#fff6df', 'OCEAN VIEW GRILL', null),
      bar4: draw1('#1e6e55', '#fff6df', 'PALM BAR', null),
    };
    const atlasTex = kit.canvasTex(rowW, rowH * n, (g, w, h) => {
      SIGN_ROWS.forEach((name, i) => { g.save(); g.translate(0, i * rowH); drawers[name](g, rowW, rowH); g.restore(); });
    });
    atlasMat = new THREE.MeshLambertMaterial({ map: atlasTex });
    // One atlas keeps every storefront sign in a chunk in one baked draw call,
    // while each shop can still have a different name and paint colour.
    const shopNames = kit.DATA.shops;
    const shopColours = ['#176b43', '#215b82', '#a43d29', '#b68a27', '#285a5b', '#6e456c'];
    const shopAtlas = kit.canvasTex(512, 112 * shopNames.length, (g, w) => {
      shopNames.forEach((name, i) => {
        const y = i * 112;
        g.fillStyle = shopColours[i % shopColours.length]; g.fillRect(0, y, w, 112);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y + 7, w, 4);
        g.fillStyle = '#f6edd5'; g.textAlign = 'center'; g.textBaseline = 'middle';
        kit.fitText(g, name, w - 28, 45, 'Bungee, Impact, sans-serif');
        g.fillText(name, w / 2, y + 56);
        g.fillStyle = 'rgba(20,30,27,.32)'; g.fillRect(0, y + 106, w, 6);
      });
    });
    lumleyShopMat = new THREE.MeshLambertMaterial({ map: shopAtlas });
    shopNames.forEach((_, i) => {
      const geo = new THREE.PlaneGeometry(2.6, 2.6 * 112 / 512);
      const uv = geo.attributes.uv;
      const top = 1 - i / shopNames.length, bottom = 1 - (i + 1) / shopNames.length;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) === 1 ? top : bottom);
      uv.needsUpdate = true; lumleyShopGeos.push(geo);
    });
    const shutterTex = kit.canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#3e4a49'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 9) {
        g.fillStyle = 'rgba(9,20,20,.36)'; g.fillRect(0, y + 7, w, 2);
        g.fillStyle = 'rgba(187,194,176,.16)'; g.fillRect(0, y + 1, w, 1);
      }
      g.fillStyle = 'rgba(91,65,42,.27)'; g.fillRect(8, 0, 14, h);
      g.fillRect(w - 20, h * .42, 11, h * .58);
    });
    lumleyShutterMat = new THREE.MeshLambertMaterial({ map: shutterTex });
    const roofTex = kit.canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#77766d'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 12) {
        g.fillStyle = 'rgba(235,227,206,.17)'; g.fillRect(x, 0, 2, h);
        g.fillStyle = 'rgba(34,42,40,.27)'; g.fillRect(x + 8, 0, 3, h);
      }
      let seed = 9281;
      const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 95; i++) {
        const x = next() * w, y = next() * h, r = 2 + next() * 12;
        const rust = g.createRadialGradient(x, y, 0, x, y, r);
        rust.addColorStop(0, 'rgba(119,67,43,.44)'); rust.addColorStop(1, 'rgba(119,67,43,0)');
        g.fillStyle = rust; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    });
    lumleyRoofMat = new THREE.MeshLambertMaterial({ map: roofTex });
    // Shared plaster maps add weather and colour variation without a mesh per stain.
    // The base colours echo painted concrete, dust and coastal humidity in Lumley.
    ['#a98e70', '#c1aa8b', '#9f9b86'].forEach((base, variant) => {
      const wallTex = kit.canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = base; g.fillRect(0, 0, w, h);
        const shade = g.createLinearGradient(0, 0, 0, h);
        shade.addColorStop(0, 'rgba(255,246,221,.13)');
        shade.addColorStop(.58, 'rgba(95,77,62,.02)');
        shade.addColorStop(1, 'rgba(56,52,46,.25)');
        g.fillStyle = shade; g.fillRect(0, 0, w, h);
        let seed = 317 + variant * 541;
        const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < 1500; i++) {
          const x = next() * w, y = next() * h, size = .4 + next() * 2.1;
          g.fillStyle = next() > .48 ? 'rgba(255,244,222,.13)' : 'rgba(58,53,45,.12)';
          g.fillRect(x, y, size, size * (1 + next()));
        }
        for (let i = 0; i < 22; i++) {
          const x = next() * w, y = next() * h;
          const stain = g.createRadialGradient(x, y, 0, x, y, 5 + next() * 21);
          stain.addColorStop(0, 'rgba(66,62,54,.12)');
          stain.addColorStop(1, 'rgba(66,62,54,0)');
          g.fillStyle = stain; g.fillRect(x - 25, y - 25, 50, 50);
        }
        g.strokeStyle = 'rgba(65,58,49,.16)'; g.lineWidth = .7;
        for (let i = 0; i < 5; i++) {
          const x = next() * w, y = next() * h;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + next() * 18 - 9, y + 10 + next() * 25); g.stroke();
        }
      });
      lumleyWallMats.push(new THREE.MeshLambertMaterial({ map: wallTex }));
    });
    SIGN_ROWS.forEach((name, i) => {
      const geo = new THREE.PlaneGeometry(1, 1);
      const uv = geo.attributes.uv, vTop = 1 - i / n, vBot = 1 - (i + 1) / n;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) === 1 ? vTop : vBot);
      uv.needsUpdate = true;
      signGeo[name] = geo;
    });
  }

  // ======================= shared build helpers =======================

  // a Krio-style veranda board house: solid walls, patched zinc roof, white balustrade porch
  function boardHouse(parent, kit, x, z, side, opts) {
    opts = opts || {};
    const { add, G, pick, rand } = kit;
    const w = rand(4.2, 6.4), d = rand(3.6, 5.2), h = rand(2.8, 4);
    // on a hillside, sink the house so its walls reach at least 1m below the slope
    // height at its downhill (nearest-to-road) edge, not its centre, so nothing floats.
    const baseY = opts.hillAx != null ? kit.hy(Math.max(0, opts.hillAx - d / 2)) - 1 : (opts.baseY || 0);
    const wall = opts.wall || pick(BOARD_WALL);
    const roof = opts.roof || pick(ZINC);
    add(parent, G.box, wall, d, h, w, x, baseY + h / 2, z);
    add(parent, G.box, roof, d * 1.1, 0.4, w * 1.14, x, baseY + h + 0.22, z);
    if (Math.random() < 0.35) add(parent, G.box, pick(ZINC), d * 0.5, 0.1, w * 0.5, x, baseY + h + 0.44, z + rand(-0.6, 0.6)); // weathered patch
    if (opts.veranda !== false) {
      const fx = x - side * (d / 2 + 0.8);
      add(parent, G.box, opts.trim || pick(TRIM), d * 0.9, 0.12, w * 0.92, fx, baseY + h * 0.95, z); // porch roof slab
      add(parent, G.box, 0xf4f0e6, 0.08, 0.9, w * 0.86, fx, baseY + h * 0.5, z); // white balustrade band
      add(parent, G.cyl6, 0xf4f0e6, 0.07, h * 0.9, 0.07, fx, baseY + h * 0.45, z - w * 0.4);
      add(parent, G.cyl6, 0xf4f0e6, 0.07, h * 0.9, 0.07, fx, baseY + h * 0.45, z + w * 0.4);
    }
  }

  // low resort/beach building: flat or thatch roof, pastel wall, optional bar signage
  function beachBuilding(parent, kit, x, z, side, signName) {
    const { add, G, pick, rand } = kit;
    const w = rand(4, 6.5), d = rand(3.5, 5), h = rand(2.4, 3.2);
    const wall = pick(RESORT_WALL);
    add(parent, G.box, wall, d, h, w, x, h / 2, z);
    if (Math.random() < 0.55) add(parent, G.cone, THATCH, w * 1.3, 1.6, w * 1.3, x, h + 0.55, z, true);
    else add(parent, G.box, pick(ZINC), d * 1.1, 0.3, w * 1.1, x, h + 0.2, z);
    add(parent, G.box, 0x2b2b2b, 0.06, 1.7, 1.3, x - side * (d / 2 + 0.02), 0.9, z); // dark doorway
    if (signName) {
      const s = signMesh(signName, w * 0.72, w * 0.72 * 160 / 512);
      s.position.set(x - side * (d / 2 + 0.03), Math.min(h - 0.4, 2.4), z); s.rotation.y = -side * Math.PI / 2; parent.add(s);
    }
    // plastic chairs around a table
    if (Math.random() < 0.6) {
      const tx = x + side * (d / 2 + rand(1, 1.8)), tz = z + rand(-1, 1);
      add(parent, G.cyl6, 0xf2f2f2, 0.5, 0.55, 0.5, tx, 0.3, tz);
      for (let i = 0; i < 2; i++) add(parent, G.box, pick([0x0072c6, 0xd8333a, 0x1eb53a]), 0.4, 0.5, 0.4, tx + rand(-0.8, 0.8), 0.25, tz + rand(-0.8, 0.8));
    }
  }

  // a beached or moored dugout canoe
  function canoe(parent, kit, x, z, rotY, opts) {
    opts = opts || {};
    const { G, pick, rand } = kit;
    const g = new THREE.Group();
    const hull = opts.color || pick(CANOE);
    const len = opts.len || rand(3, 5.2);
    kit.add(g, G.box, hull, 0.58, 0.4, len, 0, 0.2, 0);
    kit.add(g, G.box, 0xf2f2f2, 0.6, 0.1, len * 0.9, 0, 0.4, 0);
    if (opts.mast !== false) {
      kit.add(g, G.cyl6, 0x8a7558, 0.035, 1.5, 0.035, 0, 0.95, len * 0.3);
      kit.add(g, G.box, pick([0xd8333a, 0x1eb53a, 0x1c3f8a]), 0.42, 0.26, 0.02, 0.22, 1.5, len * 0.3);
    }
    g.position.set(x, opts.y ?? 0, z); g.rotation.y = rotY; parent.add(g);
  }

  // roadside market/food stall with a fabric-coloured awning
  function stall(parent, kit, x, z, opts) {
    opts = opts || {};
    const { add, G, pick } = kit;
    const roof = opts.roof || pick([0xd8333a, 0x1eb53a, 0x0072c6, 0xffc23d, 0xf2f2f2, 0x7a3fa0]);
    add(parent, G.box, 0x8a6a4a, 1.5, 0.85, 0.9, x, 0.42, z);
    add(parent, G.cyl6, 0x3b3b3b, 0.045, 1.9, 0.045, x - 0.65, 1.35, z - 0.35);
    add(parent, G.cyl6, 0x3b3b3b, 0.045, 1.9, 0.045, x + 0.65, 1.35, z - 0.35);
    add(parent, G.box, roof, 1.85, 0.08, 1.25, x, 2.3, z - 0.15);
    if (opts.smoke) add(parent, G.sph, 0xcfcac2, 0.5, 0.4, 0.5, x, 2.7, z - 0.1);
  }

  // long compound wall segment (barracks / villa compound), spans the given z-range.
  // xAbs overrides the default kerb-prop offset, for use outside the bus-stop clear zone.
  function compoundWall(parent, kit, side, z0, z1, color, xAbs) {
    const { add, G } = kit;
    const x = xAbs != null ? xAbs : side * (kit.ROAD_HALF + 2.0);
    const len = Math.abs(z1 - z0), mz = (z0 + z1) / 2;
    add(parent, G.box, color || WALL_COL, 0.25, 1.65, len, x, 0.82, mz);
    add(parent, G.box, 0x8a2f2f, 0.28, 0.14, len, x, 1.72, mz);
  }

  // a gate: two pillars + lintel/boom, optional signboard
  function gateStructure(parent, kit, x, z, signName) {
    const { add, G } = kit;
    add(parent, G.box, 0x6e6a5e, 0.55, 2.5, 0.55, x - 1.3, 1.25, z);
    add(parent, G.box, 0x6e6a5e, 0.55, 2.5, 0.55, x + 1.3, 1.25, z);
    add(parent, G.box, GATE_DARK, 3.0, 0.22, 0.22, x, 2.35, z);
    if (signName) {
      const s = signMesh(signName, 2.1, 2.1 * 160 / 512);
      s.position.set(x, 2.75, z); parent.add(s);
    }
  }

  // dense overhead wires on wooden poles, spanning the full 30 m chunk so they butt seamlessly
  function denseWires(parent, kit, side) {
    const { add, G, CH, ROAD_HALF, rand } = kit;
    const x = side * (ROAD_HALF + 2.5);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const z = -CH * (i + 0.5) / n;
      const h = rand(7.4, 8.0);
      add(parent, G.cyl6, 0x6b4f37, 0.16, h, 0.16, x, h / 2, z);
      add(parent, G.box, 0x6b4f37, 1.6, 0.1, 0.1, x, h, z);
    }
    for (let k = 0; k < 3; k++) add(parent, G.box, 0x1c1c1c, 0.03, 0.03, CH, x, 7.1 + k * 0.16, -CH / 2);
  }

  // a water plane that starts at x=inner and reaches all the way to the world edge
  // (the static laterite ground plane spans x ±250), so nothing bare shows on the
  // horizon once a hillside is hidden. One stretched shared unit plane, cheap.
  function farWater(group, kit, side, inner, color, y) {
    const { CH, add } = kit;
    const outer = side * 260;
    const len = Math.abs(outer - inner), cx = (inner + outer) / 2;
    add(group, GP, color, len, 1, CH, cx, y, -CH / 2);
  }

  // hide one hillside and lay sand + sea spanning the full chunk, with palms along the verge
  function seaSide(group, kit, ctx, side) {
    const { CH, add } = kit;
    const slope = side < 0 ? ctx.slopeL : ctx.slopeR;
    slope.visible = false;
    const edge = side * 8.6, sandW = 3.4;
    add(group, GP, SAND, sandW, 1, CH, edge + side * sandW / 2, 0.03, -CH / 2);
    add(group, GP, FOAM, 0.55, 1, CH, edge + side * (sandW - 0.25), 0.032, -CH / 2);
    farWater(group, kit, side, edge + side * sandW, SEA, 0.02);
    let z = -kit.rand(1, 4);
    while (z > -CH + 1) {
      kit.addTree(group, edge + side * kit.rand(0.6, 2.2), z, 0.2, true);
      z -= kit.rand(4, 7);
    }
  }

  // ======================= districts =======================

  const D = {};

  // ---- Goderich: fishing town on a mangrove creek, bright canoes, smokehouses ----
  D['Goderich'] = {
    fill(group, kit, ctx) {
      ensureTex(kit);
      const { rand, randi, add, G } = kit;
      ctx.slopeL.visible = false;
      ctx.slopeL.material = kit.M(MANGROVE);
      const edge = -8.6, shoreW = 2.2;
      add(group, GP, MANGROVE, shoreW, 1, kit.CH, edge - shoreW / 2, 0.04, -kit.CH / 2); // muddy mangrove fringe
      farWater(group, kit, -1, edge - shoreW, CREEK_GREEN, 0.03); // creek, all the way to the horizon
      // canoes pulled up / moored along the creek
      let z = -rand(1, 4);
      while (z > -kit.CH + 1) { canoe(group, kit, edge + rand(-1.6, 0.4), z, rand(-0.3, 0.3)); z -= rand(3.5, 6); }
      // fishing-village houses + smokehouses on the landward side
      z = -rand(0.5, 3);
      while (z > -kit.CH + 3) {
        if (Math.random() < 0.3) {
          add(group, G.pyr, 0x6b5a46, 2.2, 1.8, 2.2, 13.2, 1.1, z, true); // smokehouse hut
          add(group, G.sph, 0xcfcac2, 0.7, 0.55, 0.7, 13.2, 2.3, z); // smoke puff
        } else boardHouse(group, kit, 13 + rand(-0.6, 0.8), z, 1, { veranda: Math.random() < 0.4 });
        z -= rand(5, 7.5);
      }
      for (let i = randi(3, 5); i > 0; i--) add(group, G.box, 0x8a6a4a, rand(1.2, 2), 0.1, rand(1.5, 2.5), rand(14, 20), 0.4, rand(-kit.CH, 0)); // net racks
      denseWires(group, kit, 1);
    },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      for (let i = 0; i < 6; i++) canoe(group, kit, 10.5 + (i % 3) * 1.1, 2 - Math.floor(i / 3) * 4.2, kit.rand(-0.4, 0.4));
      kit.add(group, kit.G.pyr, 0x6b5a46, 2.6, 2.0, 2.6, 11, 1.2, -7, true);
      kit.add(group, kit.G.sph, 0xcfcac2, 0.8, 0.6, 0.8, 11, 2.45, -7);
      const s = signMesh('goderich', 2.4, 2.4 * 160 / 512);
      s.position.set(9.8, 2.6, -2); s.rotation.y = -0.5; group.add(s);
    },
  };

  // ---- shared beach-road fill: ocean on the kerb-left, bars/resort strip on the right ----
  function beachFill(group, kit, ctx) {
    ensureTex(kit);
    seaSide(group, kit, ctx, -1);
    let z = -kit.rand(1, 4);
    while (z > -kit.CH + 2) {
      beachBuilding(group, kit, kit.rand(10.5, 12.5), z, 1, kit.pick(BAR_NAMES));
      z -= kit.rand(6, 9);
    }
    denseWires(group, kit, 1);
  }

  // ---- Lumley Beach Road: the long straight beach strip with palms + bars ----
  D['Lumley Beach Road'] = {
    fill(group, kit, ctx) { beachFill(group, kit, ctx); },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      const { add, G } = kit;
      add(group, G.box, 0xf7f2e6, 5, 2.6, 4, 12, 1.3, -4, true);
      add(group, G.cone, THATCH, 5.6, 2.2, 5.6, 12, 3.5, -4, true);
      for (let i = 0; i < 4; i++) kit.addTree(group, 10.3 + kit.rand(-0.4, 0.4), 2 - i * 3.5, 0.2, true);
      const s = signMesh('lumleyBeach', 2.3, 2.3 * 160 / 512);
      s.position.set(9.8, 2.7, -1); s.rotation.y = -0.5; group.add(s);
    },
  };

  // ---- Chapter One: the beach club itself at 30 Lumley Beach Road ----
  D['Chapter One'] = {
    fill(group, kit, ctx) { beachFill(group, kit, ctx); },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      const { add, G } = kit;
      const x = 13, z = -3;
      add(group, G.box, C1_DARK, 6, 2.2, 7, x, 1.1, z, true);
      add(group, G.box, C1_WOOD, 6.2, 1.8, 7.2, x, 3.1, z, true);
      add(group, G.box, C1_DARK, 5.6, 1.6, 6.6, x, 4.8, z, true);
      for (const dx of [-2, 0, 2]) add(group, G.box, 0xffffff, 0.06, 0.06, 3.4, x + dx, 6.1, z).rotation.z = 0.12;
      const sign = signMesh('chapterOne', 2.2, 2.2 * 160 / 512);
      sign.position.set(x + 3.05, 4.6, z); sign.rotation.y = -Math.PI / 2; group.add(sign);
      // pool deck beside the building (kept clear of the bus-stop zone at x<9.2)
      const px = x + 6;
      add(group, GP, 0xe4ddc9, 5.2, 1, 7, px, 0.03, z);
      add(group, GP, C1_POOL, 4.2, 1, 6, px, 0.05, z);
      for (let i = 0; i < 5; i++) add(group, G.box, 0xffffff, 0.5, 0.12, 1.2, px - 2.3, 0.25, z - 3 + i * 1.4);
      kit.addTree(group, x + 4.2, z + 4, 0.2, true); kit.addTree(group, x + 4.2, z - 4, 0.2, true);
    },
  };

  // ---- Aberdeen: creek with a fishing village on one side, hotels on the other, the bridge ----
  D['Aberdeen'] = {
    fill(group, kit, ctx) {
      ensureTex(kit);
      const { add, G, rand, pick } = kit;
      ctx.slopeL.visible = false; ctx.slopeL.material = kit.M(CREEK);
      const edge = -8.6, shoreW = 1.6;
      add(group, GP, WET_SAND, shoreW, 1, kit.CH, edge - shoreW / 2, 0.028, -kit.CH / 2);
      farWater(group, kit, -1, edge - shoreW, CREEK, 0.03); // creek, all the way to the horizon
      let z = -rand(2, 5);
      while (z > -kit.CH + 1) { canoe(group, kit, edge + rand(-2.6, -0.8), z, rand(-0.4, 0.4)); z -= rand(5, 8); }
      z = -rand(0.5, 3);
      while (z > -kit.CH + 3) {
        const h = rand(3.2, 7.5);
        add(group, G.box, pick([0xf7f2e6, 0xf0e3c6, 0x9fd3e6, 0xb9e0a5]), 4.6, h, 4.2, 12.6, h / 2, z, true);
        add(group, G.box, pick([0x8f9396, 0x9a5a3a]), 5.0, 0.3, 4.6, 12.6, h + 0.2, z);
        if (Math.random() < 0.5) add(group, G.box, 0x24292c, 0.06, 0.9, 3.2, 12.6 - 2.32, h * 0.55, z); // balcony rail
        z -= rand(5.5, 8);
      }
      denseWires(group, kit, 1);
    },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      const { add, G } = kit;
      // the Aberdeen bridge, set to the side as a backdrop set-piece spanning the creek
      const bx = 10.5, bz = 0, blen = 16;
      for (let i = 0; i < 4; i++) add(group, G.box, 0x9a9a92, 0.6, 3.2, 0.6, bx + 3 + i * 4, 1.6, bz, true);
      add(group, G.box, 0xaaa89c, 2.2, 0.35, blen, bx + 9, 3.3, bz, true);
      add(group, G.box, 0x2b2b2b, 0.1, 0.9, blen, bx + 9 - 1.05, 3.75, bz);
      add(group, G.box, 0x2b2b2b, 0.1, 0.9, blen, bx + 9 + 1.05, 3.75, bz);
      add(group, GP, CREEK, 10, 1, blen + 4, bx + 9, 0.03, bz);
      canoe(group, kit, bx + 5, bz + 3, 0.6); canoe(group, kit, bx + 13, bz - 3, -0.4);
      const sign = signMesh('aberdeen', 2.4, 2.4 * 160 / 512);
      sign.position.set(9.8, 2.5, 5); sign.rotation.y = -0.5; group.add(sign);
    },
  };

  // ---- Lumley: the busy roundabout/market junction ----
  D['Lumley'] = {
    fill(group, kit, ctx) {
      ensureTex(kit);
      const { add, G, pick, rand, randi } = kit;
      for (const side of [-1, 1]) {
        let z = -rand(0.5, 2.5);
        while (z > -kit.CH + 2) {
          const h = rand(3, 7.5);
          const bx = rand(12.4, 13.8), face = side * (bx - 2.24);
          add(group, G.box, pick(lumleyWallMats), 4.4, h, 4.6, side * bx, h / 2, z, true);
          add(group, G.box, h > 5 ? 0xa7a296 : lumleyRoofMat, 4.8, h > 5 ? 0.5 : 0.3, 5.0, side * bx, h + (h > 5 ? 0.25 : 0.15), z);
          add(group, G.box, 0x777568, 4.85, .09, 5.02, side * bx, h + .05, z); // shadow under eave
          if (h > 5) {
            add(group, G.box, 0x716a5e, 0.13, 0.58, 4.45, face - side * .24, h * .72, z); // veranda rail
            for (const dz of [-1.85, 0, 1.85]) add(group, G.box, 0x8c8373, .12, .68, .1, face - side * .28, h * .72, z + dz);
          }
          // A recessed shutter, upper windows and an uneven zinc awning give each frontage depth.
          add(group, G.box, 0x302d27, .09, 1.82, 2.12, face - side * .02, 1.08, z); // recessed opening
          add(group, G.box, lumleyShutterMat, .07, 1.65, 1.94, face - side * .09, 1.07, z);
          add(group, G.box, 0x6d695e, .12, 1.87, .1, face - side * .13, 1.08, z - 1.04);
          add(group, G.box, 0x6d695e, .12, 1.87, .1, face - side * .13, 1.08, z + 1.04);
          if (h > 4.4) for (const dz of [-1.2, 1.2]) {
            add(group, G.box, 0x394746, .075, .95, .75, face - side * .04, h - 1.65, z + dz);
            add(group, G.box, 0xc2b9a1, .09, .12, .9, face - side * .09, h - 2.17, z + dz);
          }
          for (let i = 0; i < 3; i++) {
            const stainY = rand(.4, h - .4), stainZ = z + rand(-2, 2);
            add(group, G.box, pick([0x8b806e, 0x988976, 0xa79b86]), .02, rand(.12, .52), rand(.18, .7), face - side * .07, stainY, stainZ);
          }
          add(group, G.box, lumleyRoofMat, 1.3, .1, 3.6, face - side * .45, 2.25, z + rand(-.3, .3));
          if (Math.random() < .6) {
            add(group, G.box, 0x8b765b, .65, .55, .7, face - side * .8, .28, z - 1.3);
            add(group, G.box, 0x6a7167, .58, .4, .55, face - side * .9, .2, z - .55);
          }
          const sign = new THREE.Mesh(pick(lumleyShopGeos), lumleyShopMat);
          sign.position.set(face - side * .09, 2.68, z); sign.rotation.y = -side * Math.PI / 2; group.add(sign);
          z -= rand(5.5, 7.5);
        }
        for (let i = randi(2, 3); i > 0; i--) stall(group, kit, side * rand(9.6, 10.6), rand(-kit.CH + 3, -3));
        denseWires(group, kit, side);
      }
    },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      const { add, G } = kit;
      add(group, G.cyl, 0x8a8678, 3.4, 0.3, 3.4, 10.5, 0.15, -2);
      add(group, G.cyl6, 0xe9e4d2, 0.5, 2.6, 0.5, 10.5, 1.45, -2);
      add(group, G.cyl6, 0x1c1c1c, 0.1, 4.2, 0.1, 10.5, 3.3, -2);
      add(group, G.box, 0x0a6b34, 0.8, 0.5, 0.06, 10.5 + 0.45, 4.9, -2);
      const s = signMesh('lumley', 2.4, 2.4 * 160 / 512);
      s.position.set(9.8, 2.5, 4); s.rotation.y = -0.5; group.add(s);
      kit.addVendor(group, 9.8, -5.5, 1);
    },
  };

  // ---- Wilberforce: hilly residential, villa compounds, barracks ----
  D['Wilberforce'] = {
    fill(group, kit, ctx) {
      ensureTex(kit);
      const { rand, randi, hy } = kit;
      for (const side of [-1, 1]) {
        let z = -rand(0.5, 3);
        while (z > -kit.CH + 3) {
          if (Math.random() < 0.4) { compoundWall(group, kit, side, z + 2.4, z - 2.4); }
          else boardHouse(group, kit, side * rand(12.6, 13.6), z, side);
          z -= rand(5.5, 8);
        }
        for (let i = randi(4, 6); i > 0; i--) {
          const ax = rand(18, 48);
          boardHouse(group, kit, side * ax, rand(-kit.CH + 2, -2), side, { hillAx: ax });
        }
        if (Math.random() < 0.3) kit.addTree(group, side * rand(17, 46), rand(-kit.CH, 0), hy(rand(17, 46)), false);
        denseWires(group, kit, side);
      }
    },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      const gx = 11.5;
      gateStructure(group, kit, gx, -2, 'wilberforce');
      compoundWall(group, kit, 1, -2 - 7, -2 + 7, 0xb9b2a0, gx);
      const { add, G } = kit;
      add(group, G.box, 0xdedad0, 1.6, 2.0, 1.6, gx + 3.4, 1.0, -2, true); // sentry booth
      add(group, G.pyr, 0x8f9396, 2.0, 0.9, 2.0, gx + 3.4, 2.3, -2, true);
    },
  };

  // ---- IMATT: the old military-compound junction, now known for its food stalls ----
  D['IMATT'] = {
    fill(group, kit, ctx) {
      ensureTex(kit);
      const { rand, randi } = kit;
      for (const side of [-1, 1]) {
        let z = -rand(1, 3);
        while (z > -kit.CH + 3) {
          compoundWall(group, kit, side, z + 3, z - 3, WALL_COL);
          z -= rand(7, 9);
        }
        for (let i = randi(2, 3); i > 0; i--) stall(group, kit, side * rand(9.4, 10.4), rand(-kit.CH + 3, -3), { smoke: Math.random() < 0.6 });
        denseWires(group, kit, side);
      }
    },
    landmark(group, kit, ctx) {
      ensureTex(kit);
      const gx = 11.5;
      gateStructure(group, kit, gx, -5, 'imatt');
      compoundWall(group, kit, 1, -5 - 6, -5 + 6, WALL_COL, gx);
      stall(group, kit, 9.6, 3, { smoke: true });
      stall(group, kit, 10.4, 6, { smoke: true });
      kit.addVendor(group, 9.8, 1, 1);
    },
  };

  Object.assign(window.PODA.districts, D);
})();
