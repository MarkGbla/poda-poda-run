import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM||`${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`});
const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const output='output/sendme';mkdirSync(output,{recursive:true});
const results=[];
try {
 for(const mode of ['', '&cbd']){
  await page.goto(`http://127.0.0.1:5173/?stats${mode}`);await page.waitForFunction(()=>!!window.PODA?.debug?.spawnSendMe);
  await page.click('#startBtn');
  const spawned=await page.evaluate(()=>{
   const d=window.PODA.debug;const o=d.spawnSendMe(0,-15);window.testRider=o;
   return !!o;
  });assert.ok(spawned);
  await page.waitForFunction(()=>!!testRider.npcState);
  const before=await page.evaluate(()=>({z:testRider.z,angle:testRider.g.getObjectByName('frontWheel').rotation.x}));
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>({z:testRider.z,angle:testRider.g.getObjectByName('frontWheel').rotation.x,state:testRider.npcState,parts:testRider.g.children.length}));
  assert.notEqual(after.angle,before.angle);assert.notEqual(after.z,before.z);
  await page.screenshot({path:`${output}/${mode?'cbd':'classic'}-gameplay.png`});
  await page.click('#pauseBtn');const paused=await page.evaluate(()=>testRider.g.getObjectByName('frontWheel').rotation.x);
  await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>testRider.g.getObjectByName('frontWheel').rotation.x),paused);
  await page.click('#resumeBtn');
  // Exercise a real curved path segment while keeping the normal camera and update loop.
  if(mode){
   await page.evaluate(()=>{
    const c=PODA.debug.cbd;let at=0;
    for(;at<c.route.path.length;at++)if(Math.abs(c.route.path.frameAt(at).k)>.02)break;
    c.advance(at-c.s-15);testRider.z=-15;
   });
   await page.waitForFunction(()=>Math.abs(testRider.g.getObjectByName('lean').rotation.z)>.01);
   await page.screenshot({path:`${output}/cbd-curve-gameplay.png`});
  }
  // Despawn through the normal loop, then verify checkout resets animation state.
  const uuid=await page.evaluate(()=>{testRider.z=27;return testRider.g.uuid;});
  await page.waitForFunction(()=>!PODA.debug.run().obstacles.includes(testRider));
  const recycled=await page.evaluate(()=>{
   let o;for(const z of [-15,-50,-100]){for(let lane=0;lane<3;lane++){o=PODA.debug.spawnSendMe(lane,z);if(o)break;}if(o)break;}if(!o)return null;window.testRider=o;
   return {uuid:o.g.uuid,angle:o.g.getObjectByName('frontWheel').rotation.x,state:o.npcState};
  });assert.equal(recycled.uuid,uuid);assert.equal(recycled.angle,0);assert.equal(recycled.state,undefined);
  assert.equal(await page.evaluate(()=>PODA.debug.spawnSendMe(testRider.lane,testRider.z)),null);
  // Force a normal collision through the real game loop.
  const damageBefore=await page.evaluate(()=>{const {S}=PODA.debug.run();S.invuln=0;testRider.x=S.x;testRider.z=0;return S.condition;});
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>PODA.debug.run().S.condition)<damageBefore);
  results.push({mode:mode?'CBD':'classic',movement:true,animation:true,pause:true,collision:true,recycling:true,occupiedSpawnRejected:true,curve:!!mode,errors:[...errors]});
 }
 // Repeated restart and fatal collision use the existing UI and collision flow.
 for(let i=0;i<3;i++){
  await page.click('#pauseBtn');if(!await page.isVisible('#restartBtn'))await page.locator('.pause-options summary').click();await page.click('#restartBtn');
  await page.waitForFunction(()=>PODA.debug.run().state==='play');
 }
 await page.evaluate(()=>{const o=PODA.debug.spawnSendMe(0,-15);const {S}=PODA.debug.run();S.condition=1;S.invuln=0;o.x=S.x;o.z=0;});
 await page.waitForFunction(()=>PODA.debug.run().state==='over');
 await page.waitForSelector('#over',{state:'visible'});assert.ok(await page.isVisible('#over'));
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto('http://127.0.0.1:5173/?stats');await mobile.waitForFunction(()=>!!PODA?.debug?.spawnSendMe);
 await mobile.locator('#startBtn').tap();await mobile.evaluate(()=>{window.testRider=PODA.debug.spawnSendMe(0,-15);});
 await mobile.waitForFunction(()=>!!testRider.npcState);
 const cdp=await mobile.context().newCDPSession(mobile),gas=await mobile.locator('#gasBtn').boundingBox();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gas.x+gas.width/2,y:gas.y+gas.height/2}]});
 assert.ok(await mobile.evaluate(()=>PODA.debug.run().input.gas));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await mobile.evaluate(()=>PODA.debug.run().input.gas),false);
 await mobile.screenshot({path:`${output}/mobile-gameplay.png`});
 await mobile.locator('#pauseBtn').tap();assert.ok(await mobile.isVisible('#pause'));await mobile.close();
 results.push({restarts:3,gameOver:true,mobileTouch:true});
 await page.goto('http://127.0.0.1:5173/?benchmark&stats');await page.waitForFunction(()=>!!PODA?.debug?.metrics);await page.waitForTimeout(1000);
 const baseline=await page.evaluate(()=>({...PODA.debug.metrics}));
 const complexity=await page.evaluate(()=>{
  const o=PODA.debug.spawnSendMe(0,-16);if(!o)throw Error('fixture occupied');
  let meshes=0,triangles=0;o.g.traverse(m=>{if(m.isMesh){meshes++;triangles+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;}});
  return {meshes,triangles};
 });await page.waitForTimeout(1200);
 const withRider=await page.evaluate(()=>({...PODA.debug.metrics}));
 results.push({baseline,withRider,complexity});
 assert.deepEqual(errors,[]);
 writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
