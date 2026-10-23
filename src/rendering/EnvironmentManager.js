import * as THREE from 'three';

// Values are deliberately bright enough to keep hazards readable at phone size.
export const ENVIRONMENT = {
  DAY: { sky: ['#6689a5','#a8bac5','#d5d1c3','#c6c8be'], fog: 0xc6c8be, hemiSky: 0xbacddd, hemiGround: 0x6d5540, ambient: .65, sun: 0xffd39b, sunPower: 1.18, exposure: .94, road: 0xffffff, streetlights: 0, vehicles: 0, windows: 0 },
  SUNSET: { sky: ['#354966','#ba8c7a','#d7aa86','#a2968b'], fog: 0x9d9796, hemiSky: 0x9ba9c5, hemiGround: 0x584a51, ambient: .48, sun: 0xffbc86, sunPower: .75, exposure: 1.0, road: 0xd8d8df, streetlights: .45, vehicles: .6, windows: .07 },
  NIGHT: { sky: ['#07152d','#102442','#273853','#394657'], fog: 0x303d53, hemiSky: 0x829bc6, hemiGround: 0x455071, ambient: .34, sun: 0xa5bce2, sunPower: .39, exposure: 1.08, road: 0xb2bdcd, streetlights: 1, vehicles: 1, windows: .16 },
  SUNRISE: { sky: ['#263953','#ad8e86','#d4baa0','#aca9a0'], fog: 0xa5a7ab, hemiSky: 0xb1b9cd, hemiGround: 0x665b58, ambient: .5, sun: 0xffd2a7, sunPower: .8, exposure: 1, road: 0xe1e2e8, streetlights: .3, vehicles: .4, windows: .05 },
};

export class EnvironmentManager {
  constructor({ renderer, scene, hemi, sun, quality }) {
    Object.assign(this, { renderer, scene, hemi, sun, quality });
    this.state = 'DAY'; this.listeners = new Set(); this.roads = new Set(); this.windows = new Set(); this.backdrops = new Set();
    this.previousSky = scene.background;
    this.sky = new Map();
    for (const [key, preset] of Object.entries(ENVIRONMENT)) {
      const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 256;
      const g = canvas.getContext('2d'), gradient = g.createLinearGradient(0, 0, 0, 256);
      preset.sky.forEach((color, i) => gradient.addColorStop([0,.4,.63,1][i], color));
      g.fillStyle = gradient; g.fillRect(0, 0, 4, 256);
      const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
      this.sky.set(key, texture);
    }
  }
  subscribe(callback) { this.listeners.add(callback); callback(ENVIRONMENT[this.state], this.state); return () => this.listeners.delete(callback); }
  addRoad(material) { this.roads.add(material); material.color.setHex(ENVIRONMENT[this.state].road); }
  addWindows(material) { this.windows.add(material); this.applyMaterial(material); }
  addBackdrop(material, day = 0xffffff, night = 0x566274) {
    const entry = { material, day:new THREE.Color(day).convertSRGBToLinear(), night:new THREE.Color(night).convertSRGBToLinear() };
    this.backdrops.add(entry); material.color.copy(this.isNight ? entry.night : entry.day);
  }
  applyMaterial(material) { material.emissive?.setHex(0xffca83); material.emissiveIntensity = ENVIRONMENT[this.state].windows; }
  setState(state) {
    if (!ENVIRONMENT[state]) throw new Error(`Unknown environment ${state}`);
    if (this.previousSky) { this.previousSky.dispose(); this.previousSky = null; }
    this.state = state;
    const p = ENVIRONMENT[state];
    this.scene.background = this.sky.get(state);
    this.scene.fog.color.setHex(p.fog);
    this.hemi.color.setHex(p.hemiSky); this.hemi.groundColor.setHex(p.hemiGround); this.hemi.intensity = p.ambient;
    this.sun.color.setHex(p.sun); this.sun.intensity = p.sunPower;
    this.renderer.toneMappingExposure = p.exposure;
    for (const m of this.roads) m.color.setHex(p.road);
    for (const m of this.windows) this.applyMaterial(m);
    for (const { material, day, night } of this.backdrops) material.color.copy(state === 'NIGHT' ? night : day);
    for (const fn of this.listeners) fn(p, state);
  }
  get isNight() { return this.state === 'NIGHT'; }
  get dynamicHeadlights() { return this.isNight && this.quality.profile !== 'low'; }
  dispose() { for (const texture of this.sky.values()) texture.dispose(); this.listeners.clear(); this.roads.clear(); this.windows.clear(); this.backdrops.clear(); }
}
