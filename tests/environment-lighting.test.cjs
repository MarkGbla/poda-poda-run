const { test, before } = require('node:test');
const assert = require('node:assert/strict');
let THREE, EnvironmentManager, ENVIRONMENT, attachVehicleLights, createBrakeSignal, createStreetLights, TrafficPool;
before(async () => {
  global.document = { createElement: () => ({ width:0, height:0, getContext: () => ({ createLinearGradient: () => ({addColorStop(){}}), createRadialGradient: () => ({addColorStop(){}}), fillRect(){} }) }) };
  THREE = await import('three');
  ({EnvironmentManager,ENVIRONMENT} = await import('../src/rendering/EnvironmentManager.js'));
  ({attachVehicleLights,createBrakeSignal} = await import('../src/rendering/VehicleLights.js'));
  ({createStreetLights} = await import('../src/rendering/StreetLights.js'));
  ({TrafficPool} = await import('../src/assets/vehicles/trafficPool.js'));
});
function manager() {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xffffff,40,110);
  const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
  const renderer = {toneMappingExposure:1};
  return new EnvironmentManager({scene,hemi,sun,renderer,quality:{profile:'low'}});
}
test('preset interpolation reuses texture, preserves quality fog distance, and returns to exact day values', () => {
  const env=manager(), road=new THREE.MeshStandardMaterial(); env.addRoad(road);
  env.setState('DAY'); const sky=env.scene.background, current=env.current;
  env.setBlend('DAY','NIGHT',.5);
  assert.equal(env.current.vehicles,.5);
  assert.equal(env.hemi.intensity,(ENVIRONMENT.DAY.ambient+ENVIRONMENT.NIGHT.ambient)/2);
  assert.equal(env.scene.fog.far,110);
  assert.equal(env.scene.background,sky); assert.equal(env.current,current);
  env.setState('NIGHT'); assert.equal(env.isNight,true);
  env.setState('DAY'); assert.equal(env.renderer.toneMappingExposure,.94); assert.equal(road.color.getHex(),0xffffff);
  assert.throws(()=>env.setState('RAIN')); assert.equal(env.state,'DAY'); env.dispose();
});
test('readability materials are shared without modifying scenery and disposed by their owner', () => {
  const env=manager(), source=new THREE.MeshLambertMaterial({vertexColors:true}), group=new THREE.Group();
  const a=new THREE.Mesh(new THREE.BoxGeometry(),source), b=a.clone(); group.add(a,b);
  env.addReadableObject(group); assert.equal(a.material,b.material); assert.notEqual(a.material,source);
  env.setState('NIGHT'); assert.ok(a.material.emissiveIntensity>0); assert.equal(source.emissive.getHex(),0);
  env.setState('DAY'); assert.equal(a.material.emissiveIntensity,0);
  let disposed=0; a.material.addEventListener('dispose',()=>disposed++); env.dispose(); assert.equal(disposed,1);
});
test('brake signal detects the same actual deceleration at 30, 60 and 120 Hz and holds across pause', () => {
  for(const fps of [30,60,120]) {
    const signal=createBrakeSignal(),dt=1/fps; signal.update(false,15,dt);
    assert.equal(signal.update(false,15-3*dt,dt),true);
    assert.equal(signal.update(false,15-3*dt,0),true);
    for(let i=0;i<fps;i++) signal.update(false,15-3*dt,dt);
    assert.equal(signal.update(false,15-3*dt,dt),false);
    assert.equal(signal.update(true,0,dt),true); signal.reset(); assert.equal(signal.update(false,0,dt),false);
  }
});
test('player beams point forward after steering; quality removes the spotlight but preserves road projection', () => {
  const group=new THREE.Group(), lights=attachVehicleLights(group,'poda',{player:true});
  lights.update(ENVIRONMENT.DAY,false,'high'); assert.equal(lights.spot.visible,false); assert.equal(lights.plane.visible,false);
  lights.update(ENVIRONMENT.DAY,true,'high'); assert.equal(lights.tail[0].visible,true);
  lights.update(ENVIRONMENT.NIGHT,false,'low'); assert.equal(lights.spot.visible,false); assert.equal(lights.plane.visible,true);
  lights.update(ENVIRONMENT.NIGHT,false,'high'); assert.equal(lights.spot.visible,true); assert.equal(lights.spot.castShadow,false);
  group.position.set(10,0,20); group.rotation.y=Math.PI/2; group.updateMatrixWorld(true);
  const target=lights.spot.target.getWorldPosition(new THREE.Vector3()), origin=lights.spot.getWorldPosition(new THREE.Vector3());
  assert.ok(target.x<origin.x); assert.ok(Math.abs(target.z-origin.z)<1e-6);
  lights.head[0].geometry.computeBoundingBox(); const bounds=lights.head[0].geometry.boundingBox;
  assert.ok(bounds.min.x<0 && bounds.max.x>0 && bounds.max.z<0);
  lights.dispose(); assert.equal(group.userData.vehicleLights,undefined); assert.equal(lights.root.parent,null);
});
test('NPC tiers, SENDME lean, pool resets and overflow disposal retain shared assets', () => {
  const pool=new TrafficPool(()=>{},0), factory=()=>({g:new THREE.Group(),wid:2,len:4});
  const car=pool.acquire('taxi',factory), light=attachVehicleLights(car.g,'taxi');
  light.update(ENVIRONMENT.NIGHT,false,'medium',10); assert.equal(light.plane.visible,false);
  light.update(ENVIRONMENT.NIGHT,false,'high',10); assert.equal(light.plane.visible,true);
  light.update(ENVIRONMENT.NIGHT,false,'high',25); assert.equal(light.plane.visible,false);
  light.update(ENVIRONMENT.NIGHT,false,'high',10,1/60,12,false); assert.equal(light.plane.visible,false);
  pool.release(car); assert.equal(car.g.userData.vehicleLights,undefined);
  const reusable=new TrafficPool(()=>{},1), first=reusable.acquire('taxi',factory), lamps=attachVehicleLights(first.g,'taxi');
  lamps.update(ENVIRONMENT.NIGHT,true,'high'); reusable.release(first);
  const next=reusable.acquire('taxi',factory); assert.equal(next.g,first.g); assert.equal(lamps.tail[0].visible,false);
  lamps.update(ENVIRONMENT.DAY,false,'high'); assert.equal(lamps.tail[0].visible,false);
  const bike=new THREE.Group(),lean=new THREE.Group(); lean.name='lean'; bike.add(lean);
  const bikeLights=attachVehicleLights(bike,'sendme'); assert.equal(bikeLights.root.parent,lean);
  assert.ok(bikeLights.plane.geometry.parameters.height<lamps.plane.geometry.parameters.height);
});
test('street lamps support partial activation, oriented pools and detach on disposal', () => {
  const parent=new THREE.Group(), lights=createStreetLights([{x:10,z:20,heading:Math.PI/2}]); parent.add(lights.group);
  lights.set(0); assert.equal(lights.group.children[0].visible,false);
  lights.set(.25); assert.equal(lights.group.children[1].material.opacity,.25); assert.equal(lights.group.children[0].visible,true);
  const m=new THREE.Matrix4(); lights.group.children[1].getMatrixAt(0,m);
  assert.ok(Math.abs(m.elements[0])<1e-6); assert.equal(m.elements[12],10);
  lights.dispose(); assert.equal(parent.children.length,0);
});
test('NPC lamps follow real TrafficAI deceleration, then return to running lights', () => {
  const ai=require('../src/simulation/systems/TrafficAI.js');
  const car={g:new THREE.Group(),poolKey:'taxi',x:0,z:-10,len:4,wid:2,lane:1,speed:15,cruise:15,decision:10};
  const leader={x:0,z:-17,len:4,wid:2,speed:0};
  const run={x:3.4,lane:2,speed:12,vehicle:{width:2.1,length:5.4}};
  const lamps=attachVehicleLights(car.g,'taxi');
  ai.step(car,[car,leader],run,1/60,[-3.4,0,3.4]);
  assert.equal(car.braking,true);
  lamps.update(ENVIRONMENT.NIGHT,car.braking,'medium',10,1/60,car.speed);
  assert.equal(lamps.tail[0].material.color.getHex(),0xff2922);
  for(let i=0;i<20;i++)lamps.update(ENVIRONMENT.NIGHT,false,'medium',10,1/60,car.speed);
  assert.equal(lamps.tail[0].material.color.getHex(),0xda3630);
});
test('all vehicle rigs retain forward beams and shared geometry after rebuilding', () => {
  for(const kind of ['poda','taxi','kekeh','okada','sendme','waka','freight']) {
    const a=attachVehicleLights(new THREE.Group(),kind,{player:true,length:10});
    const b=attachVehicleLights(new THREE.Group(),kind,{player:true,length:10});
    assert.ok(a.spot.target.position.z<a.spot.position.z);
    assert.equal(a.head[0].geometry,b.head[0].geometry);
    assert.equal(a.plane.material,b.plane.material);
    a.dispose(); b.update(ENVIRONMENT.NIGHT,false,'high'); assert.equal(b.spot.visible,true); b.dispose();
  }
});
