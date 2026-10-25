import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const shapes = new Map();
let beamMaterial, lastLevel = -1;
const dimHead = new THREE.Color(0xc9cbc7), brightHead = new THREE.Color(0xfff5cc);
const dimTail = new THREE.Color(0x872522), brightTail = new THREE.Color(0xda3630);
const lampOff = new THREE.MeshBasicMaterial({ color: 0xc9cbc7 });
const lampOn = new THREE.MeshBasicMaterial({ color: 0xfff5cc });
const tailOff = new THREE.MeshBasicMaterial({ color: 0x872522 });
const tailOn = new THREE.MeshBasicMaterial({ color: 0xda3630 });
const brakeOn = new THREE.MeshBasicMaterial({ color: 0xff2922 });
let poolTexture;
function beamTexture() {
  if (poolTexture) return poolTexture;
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 112, 3, 32, 70, 65);
  gradient.addColorStop(0, 'rgba(255,242,196,.48)'); gradient.addColorStop(.45, 'rgba(255,233,174,.17)'); gradient.addColorStop(1, 'rgba(255,225,160,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 128);
  poolTexture = new THREE.CanvasTexture(canvas); return poolTexture;
}

const sizes = {
  poda: { half: .68, front: -2.73, rear: 2.74, headY: .81, tailY: .98, lampW: .39, tailH: .45, beam: 23 },
  taxi: { half: .6, front: -2.12, rear: 2.12, headY: .72, tailY: .8, lampW: .4, tailH: .16, beam: 19 },
  kekeh: { half: .48, front: -1.5, rear: 1.46, headY: .86, tailY: .82, lampW: .19, tailH: .13, beam: 14 },
  okada: { half: 0, front: -.84, rear: .96, headY: .96, tailY: .85, lampW: .2, tailH: .1, beam: 13 },
  sendme: { half: 0, front: -.85, rear: 1.01, headY: .94, tailY: .86, lampW: .2, tailH: .11, beam: 12 },
  waka: { half: .75, front: -2.5, rear: 2.5, headY: .9, tailY: .9, lampW: .35, tailH: .2, beam: 20 },
  freight: { half: .88, front: -4, rear: 4, headY: 1.45, tailY: .95, lampW: .32, tailH: .2, beam: 22 },
};
// The 24 m high-quality projection range covers roughly 1–2 seconds at normal
// NPC speed. Essential emissive lamps remain visible to the quality draw distance.
export const NPC_BEAM_DISTANCE = 24;
export function createBrakeSignal() {
  let previous, hold = 0;
  return {
    reset() { previous = undefined; hold = 0; },
    update(commanded, speed, dt) {
      if (dt <= 0) return hold > 0;
      const slowing = Number.isFinite(previous) && Number.isFinite(speed) && (Math.abs(previous)-Math.abs(speed))/dt > 1.5;
      if (commanded || slowing) hold = .12;
      else hold = Math.max(0, hold-dt);
      previous = speed;
      return hold > 0;
    },
  };
}
function lightGeometry(s, key) {
  if (shapes.has(key)) return shapes.get(key);
  const xs = s.half ? [-s.half,s.half] : [0];
  const combine = (tail) => {
    const parts = xs.map(x => new THREE.BoxGeometry(tail ? s.lampW*.65 : s.lampW, tail ? s.tailH : .17, .035)
      .translate(x, tail ? s.tailY : s.headY, tail ? s.rear+.045 : s.front-.045));
    const merged = BufferGeometryUtils.mergeBufferGeometries(parts); parts.forEach(part => part.dispose());
    return merged;
  };
  const value = { head:combine(false), tail:combine(true), beam:new THREE.PlaneGeometry(Math.max(3.4,s.beam*.35),s.beam) };
  shapes.set(key,value); return value;
}
export function attachVehicleLights(group, kind, { player = false, length = null } = {}) {
  if (group.userData.vehicleLights) return group.userData.vehicleLights;
  const s = kind === 'freight' && length ? { ...sizes.freight, front:-length/2, rear:length/2 } : sizes[kind] || sizes.taxi;
  const geometry = lightGeometry(s, kind === 'freight' ? kind+length : kind);
  const root = new THREE.Group(); root.name = 'vehicleLighting';
  // SENDME lamps follow its existing lean pivot, leaving the model/branding intact.
  (group.getObjectByName('lean') || group).add(root);
  const head = [new THREE.Mesh(geometry.head, lampOff)], tail = [new THREE.Mesh(geometry.tail, tailOff)];
  root.add(...head,...tail);
  let spot = null;
  if (player) {
    spot = new THREE.SpotLight(0xffedc5, 1.6, s.beam + 5, Math.PI / 7, .72, 1.1);
    spot.position.set(0, s.headY, s.front - .18);
    spot.target.position.set(0, .1, s.front - s.beam);
    spot.castShadow = false; root.add(spot, spot.target);
  }
  beamMaterial ||= new THREE.MeshBasicMaterial({ map:beamTexture(), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:.8, polygonOffset:true, polygonOffsetFactor:-1 });
  const plane = new THREE.Mesh(geometry.beam, beamMaterial);
  plane.rotation.x = -Math.PI / 2; plane.position.set(0, .04, s.front-s.beam*.5); root.add(plane);
  const brake = createBrakeSignal();
  let disposed = false;
  const lights = { root, spot, plane, head, tail, player,
    reset() { brake.reset(); for (const mesh of [...head,...tail,plane]) mesh.visible=false; if (spot) spot.visible=false; },
    update(preset, braking, quality, distance = 0, dt = 1/60, speed, projected = true) {
      if (disposed) return;
      const level = preset.vehicles;
      if (lastLevel !== level) {
        lastLevel = level; lampOn.color.lerpColors(dimHead,brightHead,level);
        tailOn.color.lerpColors(dimTail,brightTail,level); beamMaterial.opacity = .8*level;
      }
      const on = level > .001, brakingNow = brake.update(braking,speed,dt);
      const visible = player || distance < (quality === 'low' ? 110 : quality === 'medium' ? 165 : 220);
      for (const mesh of head) { mesh.material=lampOn; mesh.visible=visible && on; }
      for (const mesh of tail) { mesh.material=brakingNow ? brakeOn : tailOn; mesh.visible=visible && (on || brakingNow); }
      plane.visible = on && (player || projected && quality === 'high' && distance < NPC_BEAM_DISTANCE);
      if (spot) { spot.visible=on && quality !== 'low'; spot.intensity=1.6*level; }
    },
    dispose() {
      if (disposed) return;
      lights.reset(); root.parent?.remove(root); root.clear();
      delete group.userData.vehicleLights; disposed = true;
      // Geometry, texture and materials are shared for the application lifetime.
    },
  };
  group.userData.vehicleLights = lights; lights.reset();
  return lights;
}
