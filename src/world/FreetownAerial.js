/**
 * A stylised bird's-eye diorama of the Freetown peninsula for the title screen.
 *
 * Everything here is generated: there is no satellite imagery or map data in the
 * build. The shape follows the real geography — the city runs west to east along
 * the north shore of the peninsula, the Sierra Leone River estuary and its
 * natural harbour lie to the north with Lungi on the far bank, the Atlantic and
 * Lumley Beach are to the west, and the Peninsula Mountains rise behind the
 * city to the south. Those are the same places the routes in GameConfig drive
 * between, so the map and the game agree.
 *
 * One unit is roughly 100 m. The city strip spans about 16 km.
 *
 * Renders in its own scene so the title costs nothing once a run starts: call
 * dispose() and every buffer and texture is released.
 */

/* Deterministic pseudo-random, so the skyline is identical on every load and
 * the title does not flicker between different cities on refresh. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Landmarks, placed by eye against the real layout. x east, z south. */
const PLACES = [
  { name: 'Lungi',            x: -14, z: -46, kind: 'far' },
  { name: 'Aberdeen',         x: -48, z: 1 },
  { name: 'Lumley Beach',     x: -58, z: 20, kind: 'coast' },
  { name: 'Goderich',         x: -60, z: 44, kind: 'coast' },
  { name: 'Congo Cross',      x: -24, z: 11 },
  { name: 'Cotton Tree',      x: 2,   z: 6,  kind: 'city' },
  { name: 'Freetown Harbour', x: 16,  z: -8, kind: 'water' },
  { name: 'Fourah Bay College', x: 14, z: 22, kind: 'hill' },
  // Hill labels sit high, which lifts them up the screen; they need extra
  // southward separation or they collide with the coast names in front.
  { name: 'Hill Station',     x: -22, z: 46, kind: 'hill' },
  { name: 'Kissy',            x: 36,  z: 9 },
  { name: 'Wellington',       x: 58,  z: 16 },
  { name: 'Sugar Loaf',       x: 6,   z: 62, kind: 'hill' },
];

export function createFreetownAerial(THREE, { canvasTex, fitText }) {
  const random = seeded(20_26_10_09);
  const scene = new THREE.Scene();
  const owned = [];                       // disposed on teardown
  const track = o => (owned.push(o), o);

  /* ---------- terrain ----------
     Height is a coastal plain along the north shore that climbs into the
     Peninsula Mountains inland, with a notch for the estuary and a headland
     pushed out to the north-west for Aberdeen. */
  // Several frequencies, so ridges and valleys break the slope up instead of it
  // climbing as one smooth ramp. Flat shading then has facets to catch light on.
  const hillNoise = (x, z) =>
    Math.sin(x * 0.08 + 1.3) * Math.cos(z * 0.07) * 2.6 +
    Math.sin(x * 0.19 + z * 0.13) * 1.5 +
    Math.cos(x * 0.33 - z * 0.21) * 0.9 +
    Math.sin(z * 0.31 + 2.1) * 0.7;

  /* The peninsula has water on two sides: the estuary along the north shore and
     the Atlantic down the west. Land is whatever lies inland of both, which
     gives the tapering shape rather than an open plain. Vertical scale is
     exaggerated about three times so the mountains read from above. */
  const northShoreZ = x => -1 + Math.sin(x * 0.055) * 4.5 + Math.sin(x * 0.13 + 1.7) * 2.2;
  const westShoreX = z => -60 + Math.sin(z * 0.075) * 6 + Math.sin(z * 0.18 + 0.6) * 2.4;

  function landHeight(x, z) {
    const dNorth = z - northShoreZ(x);
    const dWest = x - westShoreX(z);
    const inland = Math.min(dNorth, dWest);
    if (inland <= 0) return Math.max(-3, inland * 0.5);       // sea bed
    // A coastal shelf, then the Peninsula Mountains rising along the spine.
    const spine = Math.max(0, 1 - Math.abs(x + 6) / 66);
    const climb = Math.pow(Math.min(1, inland / 40), 1.5);
    let y = Math.min(1, inland / 7) * 1.3 + climb * 20 * (0.35 + spine * 1.0);
    y += hillNoise(x, z) * Math.min(1, inland / 10) * 2.2;
    // Aberdeen reaches out past the north shore, with its creek cut in behind.
    const head = 1 - Math.min(1, Math.hypot((x + 46) / 14, (z - 1) / 8));
    if (head > 0) y = Math.max(y, head * 3.2);
    const creek = 1 - Math.min(1, Math.hypot((x + 38) / 10, (z - 12) / 4.5));
    if (creek > 0) y -= creek * 4.5;
    return y;
  }

  const SPAN_X = 190, SPAN_Z = 150, SEG = 150;
  const land = new THREE.PlaneGeometry(SPAN_X, SPAN_Z, SEG, SEG);
  land.rotateX(-Math.PI / 2);
  {
    const pos = land.attributes.position;
    const colour = new Float32Array(pos.count * 3);
    // Elevation needs real separation between bands or, seen from almost
    // overhead, the whole peninsula reads as one flat green mass.
    const sand = new THREE.Color(0xe0cfa0).convertSRGBToLinear();
    const town = new THREE.Color(0xa89a79).convertSRGBToLinear();
    const green = new THREE.Color(0x3c6b3d).convertSRGBToLinear();
    const high = new THREE.Color(0x97a567).convertSRGBToLinear();
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = landHeight(x, z);
      pos.setY(i, y);
      // Shore sand, then the built-up strip, then forest climbing the hills.
      if (y < 0.5) c.copy(sand);
      else if (y < 3.5) c.copy(town).lerp(green, (y - 0.5) / 3);
      else c.copy(green).lerp(high, Math.min(1, (y - 3.5) / 14));
      colour[i * 3] = c.r; colour[i * 3 + 1] = c.g; colour[i * 3 + 2] = c.b;
    }
    land.setAttribute('color', new THREE.BufferAttribute(colour, 3));
    land.computeVertexNormals();
  }
  const landMesh = new THREE.Mesh(land, track(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  scene.add(landMesh); track(land);

  /* ---------- water ----------
     One plane for the estuary and ocean; the land simply rises out of it. */
  const sea = new THREE.Mesh(
    track(new THREE.PlaneGeometry(460, 420)),
    track(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x2d6f86).convertSRGBToLinear() })),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05; scene.add(sea);

  /* ---------- the built-up strip ----------
     Instanced blocks hugging the shore, densest around the centre and thinning
     out east and west, so the city reads as a ribbon rather than a grid. */
  const BLOCKS = 1400;
  const blockGeo = track(new THREE.BoxGeometry(1, 1, 1));
  // Per-instance colour comes from setColorAt, which the renderer multiplies by
  // the material colour. Setting vertexColors here instead would make the shader
  // look for a per-vertex attribute the box geometry does not have, and every
  // block would draw black.
  const blocks = new THREE.InstancedMesh(
    blockGeo,
    track(new THREE.MeshLambertMaterial({ color: 0xffffff })),
    BLOCKS,
  );
  {
    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const tint = new THREE.Color();
    const palette = [0xcdbf9c, 0xc3b291, 0xb9ad93, 0xd4c7a4, 0xa89c82, 0xc9b58d];
    let n = 0;
    while (n < BLOCKS) {
      // Bias toward the centre of the city and the first kilometre inland.
      const x = -64 + random() * 128 + (random() - 0.5) * 14;
      const z = 1 + Math.pow(random(), 1.9) * 22;
      const y = landHeight(x, z);
      if (y < 0.3 || y > 6.5) continue;                       // not in the sea, not up the mountain
      const centre = 1 - Math.min(1, Math.abs(x - 2) / 64);
      if (random() > 0.25 + centre * 0.8) continue;
      const h = 0.35 + random() * (0.5 + centre * 2.4);
      const w = 0.5 + random() * 0.8, d = 0.5 + random() * 0.8;
      pos.set(x, y + h / 2, z); s.set(w, h, d);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 0.5 - 0.25);
      blocks.setMatrixAt(n, m.compose(pos, q, s));
      tint.setHex(palette[(random() * palette.length) | 0]).convertSRGBToLinear();
      blocks.setColorAt(n, tint);
      n++;
    }
    blocks.count = n;
    blocks.instanceMatrix.needsUpdate = true;
    if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
  }
  scene.add(blocks);

  /* ---------- the corridor the routes drive ----------
     A single ribbon west to east along the shore, matching the order the game's
     stops run in: Goderich and Lumley in the west through to Wellington east. */
  {
    const pts = [];
    for (let x = -62; x <= 64; x += 2) {
      const z = 9 + Math.sin(x * 0.05) * 3.5 + Math.sin(x * 0.11 + 1) * 1.6;
      pts.push(new THREE.Vector3(x, landHeight(x, z) + 0.12, z));
    }
    const road = new THREE.Mesh(
      track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.34, 4, false)),
      track(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x3b3a37).convertSRGBToLinear() })),
    );
    scene.add(road);
  }

  /* ---------- place labels ----------
     Screen-fixed sprites so names stay readable from any camera distance, each
     with a pin dropped on the spot it names. */
  const pinGeo = track(new THREE.SphereGeometry(0.42, 8, 6));
  const pinMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc23d).convertSRGBToLinear() }));
  const labels = [];
  for (const place of PLACES) {
    const y = place.kind === 'water' || place.kind === 'far' ? 0.6 : landHeight(place.x, place.z) + 0.6;

    if (place.kind !== 'far' && place.kind !== 'water') {
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(place.x, y, place.z);
      scene.add(pin);
    }

    const tex = canvasTex(512, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(12,24,28,.82)';
      const pad = 10;
      g.beginPath(); g.roundRect(pad, 30, w - pad * 2, 68, 16); g.fill();
      g.strokeStyle = place.kind === 'hill' ? '#8fd7a0' : place.kind === 'water' ? '#8ecbe6' : '#ffc23d';
      g.lineWidth = 4; g.stroke();
      g.fillStyle = '#fff6df'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, place.name.toUpperCase(), w - 56, 44, 'Bungee, Impact, sans-serif');
      g.fillText(place.name.toUpperCase(), w / 2, 65);
    });
    const sprite = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: track(tex), sizeAttenuation: false, depthTest: false })));
    sprite.position.set(place.x, y + 1.4, place.z);
    sprite.scale.set(0.17, 0.0425, 1);
    sprite.renderOrder = 10;
    scene.add(sprite);
    labels.push(sprite);
  }

  /* ---------- light and sky ---------- */
  // A raking low sun, not an overhead one: from almost directly above, relief is
  // only legible through the shading on the slopes facing away from the light.
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x55492f, 0.62));
  const sun = new THREE.DirectionalLight(0xffe4b4, 1.5);
  sun.position.set(-120, 52, -40);
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(0xbcd2d8, 150, 330);

  /* ---------- camera ----------
     A slow drift around the city rather than a full orbit, so the view stays
     oriented with the sea to the north and the mountains behind. */
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 600);
  const focus = new THREE.Vector3(-4, 0, 14);

  function update(seconds, aspect, reduceMotion) {
    // Steep enough to read as a map rather than a hillside, with only a gentle
    // drift so north stays at the top and the mountains stay behind the city.
    const a = reduceMotion ? -0.18 : -0.18 + Math.sin(seconds * 0.035) * 0.22;
    const radius = aspect < 0.8 ? 112 : 100;
    const height = aspect < 0.8 ? 138 : 112;
    camera.position.set(focus.x + Math.sin(a) * radius, height, focus.z + Math.cos(a) * radius);
    camera.lookAt(focus);
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 52 : 42;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    for (const o of owned) o.dispose?.();
    scene.clear();
  }

  return { scene, camera, update, dispose, labels };
}
