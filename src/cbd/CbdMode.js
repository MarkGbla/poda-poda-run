/* Mapped Freetown Central route. The legacy ?cbd link selects this same route.

   The game's simulation already runs in road space: the player sits at z = 0,
   traffic, coins and stops move along -z, lanes are x. That is left exactly as
   it is — collisions, scoring, stops and traffic rules do not know the road
   bends. Just before each frame is drawn, every road-space object is mapped onto
   the real centreline (RoadPath) and put back straight after, so the next
   update() sees the values it wrote. The camera is mapped the same way, which
   makes it follow the curve: its target 16 m ahead is already round the bend.

   The old downtown loop remains in cbd-data.json for geometry tests; the game
   loads central-data.json so Congo Cross and Eastern Police share one run. */
import './geo.js';
import './RoadPath.js';
import './CbdRoute.js';
import data from './data/central-data.json';
import { createCbdWorld } from './CbdWorld.js';

export function createCbdMode({ THREE, kit, scene, world, textures, bake }) {
  const route = window.PODA_CbdRoute.create(data);
  const built = createCbdWorld({ THREE, kit, data, route, textures, bake });
  scene.add(built.group);
  const { path } = route;
  const panorama = makePanorama(THREE);
  scene.add(panorama);

  let s = route.startS;
  const tiles = built.group.children.filter(o => o.isMesh && o.geometry.boundingSphere && o.geometry.boundingSphere.radius < 400);
  const f = {}, q = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  const saved = [];
  let savedCoins = null, coinMesh = null;
  const camSave = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const sunSave = { p: new THREE.Vector3(), t: new THREE.Vector3() };
  const fwd = new THREE.Vector3(), target = new THREE.Vector3();
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  let mapped = false;

  function place(obj) {
    saved.push(obj, obj.position.x, obj.position.y, obj.position.z, obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
    path.toWorld(s - obj.position.z, obj.position.x, f);
    obj.position.set(f.x, obj.position.y, f.z);
    obj.quaternion.premultiply(q.setFromAxisAngle(yAxis, f.heading));
  }
  /** Road-space point → plan position (written into v). */
  function mapPoint(v) { path.toWorld(s - v.z, v.x, f); v.set(f.x, v.y, f.z); return v; }

  return {
    route, stats: built.stats, buildings: built.buildings, group: built.group,
    setVisible(visible) { built.group.visible = panorama.visible = visible; },
    stopNames: route.stops.map(st => st.name),
    get s() { return s; },
    reset() { s = route.startS; },
    advance(distance) { s += distance; },
    /** Metres from the vehicle to stop i of the route, along the road. */
    distanceToStop(i) { return route.stops[Math.min(i, route.stops.length - 1)].s - s; },
    speedCap() { return route.speedCap(s); },
    canSpawnAt(z) { return route.canSpawnStatic(s - z); },
    /** Is road-space z within `within` metres of any stop on the loop (not just the next one)? */
    nearStop(z, within) {
      const at = s - z;
      return route.stops.some(st => { const d = path.closed ? path.wrap(st.s - at + path.length / 2) - path.length / 2 : st.s - at; return Math.abs(d) < within; });
    },
    street() { return route.streetAt(s); },
    turnHint() {
      const t = route.nextTurn(s, 95);
      if (!t) return '';
      const m = Math.max(0, Math.round(t.metres / 5) * 5);
      if (t.onto === route.streetAt(s)) return `BEND ${t.direction.toUpperCase()} · ${m} m · EASE OFF`;
      return `TURN ${t.direction.toUpperCase()} ONTO ${t.onto.toUpperCase()} · ${m} m`;
    },
    /** Put road-space objects onto the real street. Pair every call with afterRender(). */
    beforeRender({ camera, sun, player, extras = [], coins = null, drawDistance = Infinity }) {
      if (mapped) return;
      mapped = true;
      saved.length = 0;
      for (const obj of [player, ...extras, ...world.children]) if (obj && obj.visible && !obj.isInstancedMesh) place(obj);
      if (coins && coins.mesh.count) {
        coinMesh = coins.mesh;
        savedCoins = savedCoins && savedCoins.length === coinMesh.instanceMatrix.array.length ? savedCoins : new Float32Array(coinMesh.instanceMatrix.array.length);
        savedCoins.set(coinMesh.instanceMatrix.array);
        for (const c of coins.list) {
          coinMesh.getMatrixAt(c.slot, _m); _m.decompose(_p, _q, _s);
          path.toWorld(s - _p.z, _p.x, f);
          _p.set(f.x, _p.y, f.z); _q.premultiply(q.setFromAxisAngle(yAxis, f.heading));
          coinMesh.setMatrixAt(c.slot, _m.compose(_p, _q, _s));
        }
        coinMesh.instanceMatrix.needsUpdate = true;
      }
      camSave.p.copy(camera.position); camSave.q.copy(camera.quaternion);
      fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      target.copy(camera.position).addScaledVector(fwd, 24);
      mapPoint(camera.position); mapPoint(target);
      camera.lookAt(target);
      // The sun stays fixed in the sky; only its shadow box follows the vehicle.
      sunSave.p.copy(sun.position); sunSave.t.copy(sun.target.position);
      path.toWorld(s - 10, 0, f); sun.target.position.set(f.x, 0, f.z);
      sun.position.copy(sun.target.position).add(_p.set(-24, 32, 26));
      panorama.position.set(camera.position.x, 0, camera.position.z);
      // Honour the quality profile's draw distance (fog hides the cut): whole tiles, by bounding sphere.
      for (const mesh of tiles) {
        const b = mesh.geometry.boundingSphere;
        mesh.visible = Math.hypot(b.center.x - camera.position.x, b.center.z - camera.position.z) - b.radius < drawDistance + 20;
      }
    },
    afterRender({ camera, sun }) {
      if (!mapped) return;
      mapped = false;
      for (let i = 0; i < saved.length; i += 8) {
        const o = saved[i];
        o.position.set(saved[i + 1], saved[i + 2], saved[i + 3]);
        o.quaternion.set(saved[i + 4], saved[i + 5], saved[i + 6], saved[i + 7]);
      }
      saved.length = 0;
      if (coinMesh && savedCoins) { coinMesh.instanceMatrix.array.set(savedCoins); coinMesh.instanceMatrix.needsUpdate = true; coinMesh = null; }
      camera.position.copy(camSave.p); camera.quaternion.copy(camSave.q);
      sun.position.copy(sunSave.p); sun.target.position.copy(sunSave.t);
    },
    /** Dev viewpoint for reference-photo comparisons: ?cbd&view=x,z,yawDeg,height */
    poseView(camera, spec) {
      const [x, z, yaw = 0, h = 1.7] = spec.split(',').map(Number);
      camera.position.set(x, h, z);
      const a = yaw * Math.PI / 180;
      camera.lookAt(x + Math.sin(a) * 50, h, z - Math.cos(a) * 50);
      panorama.position.set(x, 0, z);
    },
  };
}

/* A distant ring that stands in for the peninsula's hills to the south and the
   estuary horizon to the north. It follows the camera, so it only ever carries
   direction, never distance. Hill heights are a silhouette, not elevation data. */
function makePanorama(THREE) {
  const R = 560, N = 180, verts = [], cols = [];
  const near = new THREE.Color(0x617d73).convertSRGBToLinear(), far = new THREE.Color(0x7d97a0).convertSRGBToLinear();
  const ridge = (bearing, layer) => {
    // 0° north, 90° east. The high ground of the peninsula lies roughly south-west to south-east of the CBD.
    const south = Math.max(0, Math.cos((bearing - 185) * Math.PI / 180));
    const base = layer ? 34 : 18;
    return base * Math.pow(south, 0.6) * (1 + 0.35 * Math.sin(bearing * 0.11 + layer) + 0.18 * Math.sin(bearing * 0.37 + 2 * layer)) + (south > 0 ? 2 : 0);
  };
  for (const [layer, colour, r] of [[1, far, R], [0, near, R - 20]]) {
    for (let i = 0; i < N; i++) {
      const b0 = i / N * 360, b1 = (i + 1) / N * 360;
      const p = (b, h) => [Math.sin(b * Math.PI / 180) * r, h, -Math.cos(b * Math.PI / 180) * r];
      const h0 = ridge(b0, layer), h1 = ridge(b1, layer);
      if (h0 + h1 < 0.5) continue;
      verts.push(...p(b0, -2), ...p(b1, -2), ...p(b1, h1), ...p(b0, -2), ...p(b1, h1), ...p(b0, h0));
      for (let k = 0; k < 6; k++) cols.push(colour.r, colour.g, colour.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}
