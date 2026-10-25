import * as THREE from 'three';

// Values are deliberately bright enough to keep hazards readable at phone size.
export const ENVIRONMENT = {
  DAY: { sky: ['#6689a5','#a8bac5','#d5d1c3','#c6c8be'], fog: 0xc6c8be, hemiSky: 0xbacddd, hemiGround: 0x6d5540, ambient: .65, sun: 0xffd39b, sunPower: 1.18, exposure: .94, road: 0xffffff, streetlights: 0, vehicles: 0, windows: 0 },
  SUNSET: { sky: ['#354966','#ba8c7a','#d7aa86','#a2968b'], fog: 0x9d9796, hemiSky: 0x9ba9c5, hemiGround: 0x584a51, ambient: .48, sun: 0xffbc86, sunPower: .75, exposure: 1.0, road: 0xd8d8df, streetlights: .45, vehicles: .6, windows: .07 },
  NIGHT: { sky: ['#07152d','#102442','#273853','#394657'], fog: 0x303d53, hemiSky: 0x829bc6, hemiGround: 0x455071, ambient: .34, sun: 0xa5bce2, sunPower: .39, exposure: 1.08, road: 0xb2bdcd, streetlights: 1, vehicles: 1, windows: .16 },
  SUNRISE: { sky: ['#263953','#ad8e86','#d4baa0','#aca9a0'], fog: 0xa5a7ab, hemiSky: 0xb1b9cd, hemiGround: 0x665b58, ambient: .5, sun: 0xffd2a7, sunPower: .8, exposure: 1, road: 0xe1e2e8, streetlights: .3, vehicles: .4, windows: .05 },
};

// Visual-only controls. Fog distance remains owned by QualityManager.
for (const [name, preset] of Object.entries(ENVIRONMENT)) {
  const night = { DAY:0, SUNSET:.45, NIGHT:1, SUNRISE:.3 }[name];
  Object.assign(preset, {
    backdrop: night, roadRoughness: .9, buildingTint: name === 'NIGHT' ? 0xb4bed2 : 0xffffff,
    hazardEmission: .035 * night, shadowOpacity: .6 - .25 * night,
    sunOffset: name === 'NIGHT' ? [-18, 38, 24] : [-28, 32, 32],
  });
}
const colorFields = ['fog','hemiSky','hemiGround','sun','road','buildingTint'];
const scalarFields = ['ambient','sunPower','exposure','streetlights','vehicles','windows','backdrop','roadRoughness','hazardEmission','shadowOpacity'];

export class EnvironmentManager {
  constructor({ renderer, scene, hemi, sun, quality }) {
    Object.assign(this, { renderer, scene, hemi, sun, quality });
    this.state = 'DAY';
    this.listeners = new Set(); this.roads = new Set(); this.windows = new Set();
    this.backdrops = new Set(); this.buildings = new Set(); this.readable = new Map();
    this.current = { sky: new Array(4), sunOffset: [0,0,0] };
    this.color = new THREE.Color(); this.otherColor = new THREE.Color();
    this.canvas = document.createElement('canvas'); this.canvas.width = 4; this.canvas.height = 256;
    this.sky = new THREE.CanvasTexture(this.canvas); this.sky.encoding = THREE.sRGBEncoding;
    this.previousSky = scene.background;
    // Prepare a preset without changing the title's existing scene.
    this.mix('DAY', 'DAY', 1);
  }
  subscribe(callback) { this.listeners.add(callback); callback(this.current, this.state); return () => this.listeners.delete(callback); }
  addRoad(material) { this.roads.add(material); this.applyRoad(material); }
  applyRoad(material) { material.color.setHex(this.current.road); material.roughness = this.current.roadRoughness; }
  addWindows(material) { this.windows.add(material); this.applyWindow(material); }
  applyWindow(material) { material.emissive?.setHex(0xffca83); material.emissiveIntensity = this.current.windows; }
  addBuildings(material) { this.buildings.add(material); material.color.setHex(this.current.buildingTint); }
  addBackdrop(material, day = 0xffffff, night = 0x566274) {
    const entry = { material, day:new THREE.Color(day).convertSRGBToLinear(), night:new THREE.Color(night).convertSRGBToLinear() };
    this.backdrops.add(entry); this.applyBackdrop(entry);
  }
  applyBackdrop({material, day, night}) { material.color.copy(day).lerp(night, this.current.backdrop); }
  // Baked geometry shares materials with scenery. Clone once per source material,
  // then share that clone across all hazards, instead of brightening the city.
  addReadableObject(group) {
    group.traverse(mesh => {
      if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material.emissive || mesh.material.userData.nightReadable) return;
      const source = mesh.material;
      let material = this.readable.get(source);
      if (!material) {
        material = source.clone(); material.userData.nightReadable = true;
        material.emissive.setHex(0xa5b7ce); material.emissiveIntensity = this.current.hazardEmission;
        this.readable.set(source, material);
      }
      mesh.material = material;
    });
  }
  mix(from, to, amount) {
    const a = ENVIRONMENT[from], b = ENVIRONMENT[to], p = this.current;
    if (!a || !b || !Number.isFinite(amount)) throw new Error('Invalid environment blend');
    const t = THREE.MathUtils.clamp(amount, 0, 1);
    for (const key of scalarFields) p[key] = THREE.MathUtils.lerp(a[key], b[key], t);
    for (const key of colorFields) p[key] = this.color.setHex(a[key]).lerp(this.otherColor.setHex(b[key]), t).getHex();
    for (let i=0; i<4; i++) p.sky[i] = this.color.set(a.sky[i]).lerp(this.otherColor.set(b.sky[i]), t).getStyle();
    for (let i=0; i<3; i++) p.sunOffset[i] = THREE.MathUtils.lerp(a.sunOffset[i], b.sunOffset[i], t);
    this.state = t === 1 ? to : from;
  }
  setState(state) { this.setBlend(state, state, 1); }
  // Explicit future transition API; competitive runs never call it automatically.
  // The preset object and texture are reused, including during a transition.
  setBlend(from, to, amount) {
    this.mix(from, to, amount);
    const p = this.current, g = this.canvas.getContext('2d');
    const gradient = g.createLinearGradient(0,0,0,256);
    p.sky.forEach((color,i) => gradient.addColorStop([0,.4,.63,1][i], color));
    g.fillStyle = gradient; g.fillRect(0,0,4,256); this.sky.needsUpdate = true;
    if (this.previousSky) { this.previousSky.dispose(); this.previousSky = null; }
    this.scene.background = this.sky;
    this.scene.fog.color.setHex(p.fog);
    this.hemi.color.setHex(p.hemiSky); this.hemi.groundColor.setHex(p.hemiGround); this.hemi.intensity = p.ambient;
    this.sun.color.setHex(p.sun); this.sun.intensity = p.sunPower;
    this.renderer.toneMappingExposure = p.exposure;
    for (const m of this.roads) this.applyRoad(m);
    for (const m of this.windows) this.applyWindow(m);
    for (const entry of this.backdrops) this.applyBackdrop(entry);
    for (const m of this.buildings) m.color.setHex(p.buildingTint);
    for (const m of this.readable.values()) m.emissiveIntensity = p.hazardEmission;
    for (const fn of this.listeners) fn(p, this.state);
  }
  positionLight() {
    const offset = this.current.sunOffset;
    this.sun.position.set(this.sun.target.position.x+offset[0], this.sun.target.position.y+offset[1], this.sun.target.position.z+offset[2]);
  }
  get isNight() { return this.current.backdrop > .5; }
  dispose() {
    this.sky.dispose(); this.previousSky?.dispose(); this.previousSky = null;
    for (const material of this.readable.values()) material.dispose();
    for (const collection of [this.listeners,this.roads,this.windows,this.backdrops,this.buildings,this.readable]) collection.clear();
  }
}
