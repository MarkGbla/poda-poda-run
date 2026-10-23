import * as THREE from 'three';

// Lamp housings and road pools are separate from the already baked pole geometry.
let shared;
function assets() {
  if (shared) return shared;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'), glow = g.createRadialGradient(32,32,2,32,32,32);
  glow.addColorStop(0,'rgba(255,210,136,.28)'); glow.addColorStop(1,'rgba(255,210,136,0)');
  g.fillStyle = glow; g.fillRect(0,0,64,64);
  const texture = new THREE.CanvasTexture(canvas);
  shared = {
    headGeometry:new THREE.BoxGeometry(.52,.12,.32),
    headMaterial:new THREE.MeshBasicMaterial({ color:0xffdda0 }),
    poolGeometry:new THREE.PlaneGeometry(7,11).rotateX(-Math.PI/2),
    poolMaterial:new THREE.MeshBasicMaterial({ map:texture, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, polygonOffset:true, polygonOffsetFactor:-2 }),
  };
  return shared;
}
export function createStreetLights(positions) {
  const group = new THREE.Group(); group.name = 'night-streetlights';
  const a = assets();
  const head = new THREE.InstancedMesh(a.headGeometry, a.headMaterial, positions.length);
  const pools = new THREE.InstancedMesh(a.poolGeometry, a.poolMaterial, positions.length);
  const matrix = new THREE.Matrix4();
  positions.forEach((p,i) => {
    matrix.makeTranslation(p.x,6.85,p.z); head.setMatrixAt(i,matrix);
    matrix.makeTranslation(p.x,.035,p.z); pools.setMatrixAt(i,matrix);
  });
  head.instanceMatrix.needsUpdate = pools.instanceMatrix.needsUpdate = true;
  group.add(head,pools);
  return { group, set(level) { head.visible = pools.visible = level > .5; } };
}
