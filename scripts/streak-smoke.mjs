import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
const out='docs/research/danfo-streak/poda'; mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM || `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,headless:true});
const results=[],errors=[];
const base=process.env.STREAK_URL || 'http://127.0.0.1:5181/';
const context=await browser.newContext({viewport:{width:1280,height:800}});
await context.route('**/api/**',route=>route.fulfill({json:{player:null,authAvailable:false,rankedRoutes:[]}}));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function homeRun(p=page){ await p.locator('#startBtn').click();await p.locator('#hud').waitFor({state:'visible'});await p.locator('#pauseBtn').click();await p.locator('#homePause').click(); }
try {
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('#streakIndicator').waitFor();
 assert.equal(await page.locator('#streakDialog').isVisible(),false);
 await homeRun();await page.locator('#streakDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#streakCount').textContent(),'1');results.push('normal gameplay qualifies; celebration deferred until safe Home transition');
 for(const [name,width,height] of [['desktop',1280,800],['mobile-portrait',360,640],['mobile-landscape',667,375]]){
   await page.setViewportSize({width,height});
   const bounds=await page.locator('#streakContinue').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height);
   await page.screenshot({path:`${out}/streak-${name}.png`});
   results.push(`${name}: Continue visible within viewport after orientation change`);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('#streakDialog').evaluate(el=>getComputedStyle(el).animationName),'none');results.push('reduced motion disables entrance animation');
 await page.locator('#streakContinue').click();await page.locator('#streakDialog').waitFor({state:'hidden'});
 await page.setViewportSize({width:1280,height:800});await homeRun();
 assert.equal(await page.locator('#streakDialog').isVisible(),false);results.push('Continue closes without restart; repeated run does not celebrate');
 await page.reload();await page.locator('#streakIndicator').waitFor();assert.match(await page.locator('#streakIndicator').textContent(),/1-day/);
 assert.equal(await page.locator('#streakDialog').isVisible(),false);results.push('refresh preserves count without celebration');
 await page.locator('#streakIndicator').click();await page.keyboard.press('Escape');await page.locator('#streakDialog').waitFor({state:'hidden'});results.push('indicator inspection and Escape dismissal');
 // A controlled previous-day fixture exercises normal gameplay, not a fabricated UI.
 await page.evaluate(()=>localStorage.setItem('poda-guest-streak-v1',JSON.stringify({current:4,longest:6,lastDate:new Date(Date.now()-86400000).toISOString().slice(0,10)})));
 await homeRun();await page.locator('#streakDialog').waitFor({state:'visible'});assert.equal(await page.locator('#streakCount').textContent(),'5');results.push('previous-day fixture increments via actual gameplay');
 await page.screenshot({path:`${out}/streak-five-days.png`});await page.locator('#streakContinue').click();
 await page.evaluate(()=>localStorage.setItem('poda-guest-streak-v1',JSON.stringify({current:4,longest:6,lastDate:new Date(Date.now()-3*86400000).toISOString().slice(0,10)})));
 await homeRun();await page.locator('#streakDialog').waitFor({state:'visible'});assert.equal(await page.locator('#streakCount').textContent(),'1');assert.match(await page.locator('#streakBest').textContent(),/6 days/);results.push('expired streak resets through gameplay, longest preserved');
 const blocked=await browser.newContext();
 await blocked.route('**/api/**',route=>route.fulfill({json:{player:null,rankedRoutes:[]}}));
 await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('blocked storage');};});
 const r=await blocked.newPage();await r.goto(base,{waitUntil:'domcontentloaded',timeout:90000});await r.locator('#streakIndicator').waitFor();await homeRun(r);
 await r.locator('#streakDialog').waitFor({state:'visible'});assert.equal(await r.locator('#streakCount').textContent(),'1');
 await r.locator('#streakContinue').click();await homeRun(r);assert.equal(await r.locator('#streakDialog').isVisible(),false);
 results.push('blocked localStorage remains playable and does not repeat same-session celebrations');await blocked.close();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({results,errors},null,2));writeFileSync(`${out}/browser-results.json`,JSON.stringify({results,errors},null,2));
} finally {await browser.close();}
