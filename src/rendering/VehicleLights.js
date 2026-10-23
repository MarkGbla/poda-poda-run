import * as THREE from 'three';

const geometry = new THREE.BoxGeometry(1, 1, 1);
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
export function attachVehicleLights(group, kind, { player = false, length = null } = {}) {
  if (group.userData.vehicleLights) return group.userData.vehicleLights;
  const s = kind === 'freight' && length ? { ...sizes.freight, front:-length/2, rear:length/2 } : sizes[kind] || sizes.taxi;
  const root = new THREE.Group(); root.name = 'vehicleLighting'; group.add(root);
  const head = [], tail = [];
  for (const x of s.half ? [-s.half,s.half] : [0]) {
    const h = new THREE.Mesh(geometry, lampOff);
    h.scale.set(s.lampW, .17, .035); h.position.set(x, s.headY, s.front - .045); root.add(h); head.push(h);
    const t = new THREE.Mesh(geometry, tailOff);
    t.scale.set(s.lampW * .65, s.tailH, .035); t.position.set(x, s.tailY, s.rear + .045); root.add(t); tail.push(t);
  }
  let spot = null;
  if (player) {
    spot = new THREE.SpotLight(0xffedc5, 1.6, s.beam + 5, Math.PI / 7, .72, 1.1);
    spot.position.set(0, s.headY, s.front - .18);
    spot.target.position.set(0, .1, s.front - s.beam);
    spot.castShadow = false; root.add(spot, spot.target);
  }
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(3.4, s.beam * .35), s.beam), new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8, polygonOffset: true, polygonOffsetFactor: -1 }));
  plane.rotation.x = -Math.PI / 2; plane.position.set(0, .04, s.front - s.beam * .47); root.add(plane);
  const lights = { root, spot, plane, head, tail, player, update(preset, braking, quality, distance = 0) {
    const on = preset.vehicles > .5;
    for (const mesh of head) { mesh.material = on ? lampOn : lampOff; mesh.visible = on; }
    for (const mesh of tail) { mesh.material = braking ? brakeOn : on ? tailOn : tailOff; mesh.visible = on || braking; }
    plane.visible = on && (player || quality === 'high' && distance < 24);
    if (spot) spot.visible = on && quality !== 'low';
  }, dispose() { plane.geometry.dispose(); plane.material.dispose(); }};
  group.userData.vehicleLights = lights;
  return lights;
}
