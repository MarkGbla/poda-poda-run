const test=require('node:test');const assert=require('node:assert/strict');
const {vehicles,routes}=require('../src/data/GameConfig.js');
const jump=require('../src/simulation/systems/JumpSystem.js');
const {overlapsPlayer}=require('../src/simulation/systems/CollisionSystem.js');
const {stepPlayer}=require('../src/simulation/systems/PlayerSystem.js');
const ai=require('../src/simulation/systems/TrafficAI.js');
const passengers=require('../src/simulation/systems/PassengerSystem.js');
test('all five vehicles enforce capacity and distinct handling',()=>{
 assert.deepEqual(Object.values(vehicles).map(v=>v.capacity),[14,3,4,1,30]);
 for(const v of Object.values(vehicles)){
  const plan=passengers.planStop(Array(v.capacity-1).fill(1),20,1,4,v.capacity);assert.equal(plan.board,1);
  const run={vehicle:v,time:0,dist:0,speed:0,toStop:260,lane:1,x:0,dwell:0,invuln:0,magnet:0};
  for(let i=0;i<600;i++)stepPlayer(run,{gas:true,brake:false,brakePulse:0},1/30,'play',[-3.4,0,3.4]);
  assert.ok(run.speed<=v.maxSpeed);assert.ok(run.speed>0);
 }
 assert.equal(new Set(Object.values(vehicles).map(v=>v.handling)).size,5);
});
test('jump lands and can clear only low tagged obstacles',()=>{
 const run={x:0,speed:12,dwell:0,vehicle:vehicles.okada};assert.equal(jump.start(run),true);assert.equal(jump.start(run),false);
 let landed=0,peak=0;for(let i=0;i<100;i++){landed+=jump.step(run,.02);peak=Math.max(peak,run.jumpY);}assert.equal(landed,1);assert.equal(run.jumpY,0);assert.ok(peak>.55);
 run.jumpY=.8;const o={x:0,z:0,wid:2,len:3,jumpable:true};assert.equal(overlapsPlayer(run,o),false);assert.equal(overlapsPlayer(run,{...o,jumpable:false}),true);
});
test('up swipe rejects horizontal steering, slow gestures and tiny movements',()=>{
 assert.equal(jump.swipe(10,-90,220),true);for(const args of [[90,-60,200],[0,-40,200],[0,-90,600],[0,90,100]])assert.equal(jump.swipe(...args),false);
});
test('traffic follows obstacles and will not lane change into occupied space',()=>{
 const o={poolKey:'taxi',x:0,z:-30,wid:2,len:4,speed:8,lane:1,decision:0};
 const lead={x:0,z:-37,wid:2,len:4,speed:0};const left={x:-3.4,z:-30,wid:2,len:4,speed:0};const right={x:3.4,z:-30,wid:2,len:4,speed:0};
 ai.step(o,[o,lead,left,right],{x:0,z:0,speed:12},.1,[-3.4,0,3.4],()=>0);assert.equal(o.lane,1);assert.ok(o.speed<8);assert.ok(o.z-lead.z>=6);
});
test('four finite routes retain geographical stop order',()=>{assert.equal(Object.keys(routes).length,4);assert.deepEqual(routes.western.stops.slice(0,3),['Goderich','Lumley','Lumley Beach Road']);assert.equal(routes.eastern.stops.at(-1),'Calaba Town');for(const r of Object.values(routes))assert.equal(new Set(r.stops).size,r.stops.length);});
test('pothole remains fixed, slows once, and never loses passengers or ends a run',()=>{
 const road=require('../src/simulation/systems/RoadContactSystem.js');const run={speed:20,x:0,pax:[0,1],collisions:0,over:false};const hole={x:0,z:0,flat:true};
 assert.equal(road.pothole(run,hole),true);assert.equal(run.speed,17.2);assert.equal(hole.x,0);assert.equal(hole.z,0);assert.equal(run.over,false);assert.equal(run.collisions,0);assert.deepEqual(run.pax,[0,1]);assert.equal(road.pothole(run,hole),false);assert.equal(run.speed,17.2);
});
