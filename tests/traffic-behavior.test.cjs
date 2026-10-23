const test=require('node:test');
const assert=require('node:assert/strict');
const ai=require('../src/simulation/systems/TrafficAI.js');
const {stepTraffic}=require('../src/simulation/systems/TrafficSystem.js');
const {overlapsPlayer,sweepsPlayer}=require('../src/simulation/systems/CollisionSystem.js');
const lanes=[-3.4,0,3.4];
const run={x:0,lane:1,speed:0,vehicle:{width:2.1,length:5.4}};
function car(z,speed=20){return {x:0,z,lane:1,speed,cruise:20,wid:1.95,len:4.2,decision:100};}
function advance(cars,player,dt,laneCenters=lanes){
  const distance=player.speed*dt;
  for(const o of cars.slice().sort((a,b)=>a.z-b.z)){
    ai.step(o,cars,player,dt,laneCenters,()=>.99,distance);
    stepTraffic(o,distance,dt,laneCenters,()=>.99);
  }
}
test('parked player is a leader and a three-car queue stops without overlap, then recovers',()=>{
  for(const fps of [30,60,120]){
    const dt=1/fps, player={...run,lane:0},cars=[car(34),car(60),car(86)].map(o=>({...o,lane:0}));
    for(let i=0;i<fps*9;i++){
      advance(cars,player,dt,[0]);
      assert.ok(cars[0].z-(cars[0].len+player.vehicle.length)/2>=ai.MIN_GAP-.001);
      for(let j=1;j<cars.length;j++)assert.ok(cars[j].z-cars[j-1].z-(cars[j].len+cars[j-1].len)/2>=ai.MIN_GAP-.001);
    }
    assert.ok(cars[0].speed<.1,`${fps} FPS lead car stops`);
    assert.ok(cars[2].speed<.1,`${fps} FPS queue tail stops`);
    player.speed=16;
    for(let i=0;i<fps*5;i++)advance(cars,player,dt,[0]);
    assert.ok(cars.every(o=>o.speed>5),`${fps} FPS queue recovers`);
  }
});
test('car behind a braking player uses an open lane and passes without contact',()=>{
  for(const fps of [30,60,120])for(const side of [-1,1]){
    const dt=1/fps,player={...run,speed:20},cars=[{...car(42),passSide:side,passLead:2.5}];
    for(let i=0;i<fps*.5;i++)advance(cars,player,dt);
    player.speed=0;
    let contact=false;
    for(let i=0;i<fps*7;i++){
      const old={x:cars[0].x,z:cars[0].z};
      advance(cars,player,dt);
      contact ||= sweepsPlayer(player,cars[0],player.x,old.x,old.z);
    }
    assert.equal(contact,false,`${fps} FPS no contact`);
    assert.equal(cars[0].lane,player.lane+side,`${fps} FPS chosen passing lane`);
    assert.ok(cars[0].z<0,`${fps} FPS car has passed player`);
    assert.ok(cars[0].speed>10,`${fps} FPS car keeps moving`);
  }
});
test('moving traffic stays delta-time consistent at 30, 60, and 120 FPS',()=>{
  function simulate(fps){const player={...run,speed:12},cars=[car(-70,18)];for(let i=0;i<fps*4;i++)advance(cars,player,1/fps);return cars[0];}
  const values=[30,60,120].map(simulate);
  assert.ok(Math.max(...values.map(v=>v.z))-Math.min(...values.map(v=>v.z))<.5);
  assert.ok(Math.max(...values.map(v=>v.speed))-Math.min(...values.map(v=>v.speed))<.1);
});
test('swept collision catches tunneling but preserves lateral near misses',()=>{
  const player={...run,x:0,speed:40};
  const npc={x:0,z:8,wid:1.95,len:4.2};
  assert.equal(overlapsPlayer(player,npc),false);
  assert.equal(sweepsPlayer(player,npc,0,0,-8),true);
  npc.x=2.5;
  assert.equal(sweepsPlayer(player,npc,0,2.5,-8),false);
  npc.x=0;
  assert.equal(sweepsPlayer(player,npc,-3.4,0,-8),true);
});
