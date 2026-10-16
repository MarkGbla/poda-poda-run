const test=require('node:test');
const assert=require('node:assert/strict');
const {step,config}=require('../src/simulation/systems/SendMeController.js');
const {stepTraffic}=require('../src/simulation/systems/TrafficSystem.js');
const {overlapsPlayer}=require('../src/simulation/systems/CollisionSystem.js');
const rider=(z=0)=>({x:-3.4,z,speed:10,cruise:10,wid:.85,len:2.05,lane:0});
const run={x:3.4,speed:0};
test('riders stop behind stationary traffic without overlap at variable frame steps',()=>{
 for(const dt of [1/120,1/30,.05,.3]){
  const o=rider(),leader={...rider(-18),speed:0};
  for(let i=0;i<Math.ceil(15/dt);i++){
   step(o,[o,leader],run,dt);stepTraffic(o,0,dt,[-3.4,0,3.4]);
   assert.ok(o.z-leader.z>=o.len+config.gap-1e-8);
  }
  assert.equal(o.npcState,'STOPPED');
  leader.speed=8;leader.z-=20;step(o,[o,leader],run,.05);assert.ok(o.speed>0);
 }
});
test('player ahead is a leader, adjacent player is not; speed cap respected',()=>{
 const o=rider(12);step(o,[o],{x:-3.4,speed:0},.05);assert.ok(o.speed<10);
 const other=rider(12);step(other,[other],run,.05);assert.equal(other.speed,10);
 step(other,[other],run,.05,5);assert.ok(other.speed<10);
});
test('multiple followers preserve separation regardless of update order',()=>{
 for(const reverse of [false,true]){
  const all=[rider(0),rider(-10),{...rider(-20),speed:0,cruise:0}];
  for(let t=0;t<600;t++)for(const o of reverse?[...all].reverse():all){step(o,all,run,.05);stepTraffic(o,0,.05,[-3.4,0,3.4]);}
  assert.ok(all[0].z-all[1].z>=4.55-1e-6);assert.ok(all[1].z-all[2].z>=4.55-1e-6);
 }
});
test('motorcycle bounds retain established collision and despawn rules',()=>{
 const o=rider();assert.equal(overlapsPlayer({x:0,speed:15},o),false);
 o.x=0;assert.equal(overlapsPlayer({x:0,speed:15},o),true);
 o.z=26;assert.equal(stepTraffic(o,0,0,[-3.4,0,3.4]),true);
});
