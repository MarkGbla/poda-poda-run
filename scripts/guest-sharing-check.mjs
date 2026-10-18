import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM,headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}), errors=[];
 page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.route('**/api/me',route=>route.fulfill({json:{player:null,authAvailable:false}}));
 async function finish() {
   await page.locator('#startBtn').click();
   await page.waitForFunction(()=>window.PODA.debug.run().state==='play');
   await page.evaluate(()=>{const {S}=window.PODA.debug.run();S.stopIdx=window.PODA_CONFIG.routes.western.stops.length-1;S.toStop=-100;});
   await page.locator('#over').waitFor({state:'visible'});
 }
 console.log('Opening guest run');
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
 await finish();
 await page.locator('#driverName').fill('   ');await page.locator('#saveScore').click();
 assert.match(await page.locator('#nicknameStatus').textContent(),/Enter a nickname/);
 await page.locator('#previewPoster').click();await page.locator('#scorePreview[open]').waitFor();
 assert.match(await page.locator('#scorePreviewImage').getAttribute('alt'),/Guest Driver/);
 await page.locator('#closePreview').click();
 await page.locator('#driverName').fill('  Mark from Freetown  ');await page.locator('#saveScore').click();
 assert.equal(await page.locator('#driverName').inputValue(),'Mark from Freetown');
 console.log('Nickname saved; exporting PNG');
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('poda-guest-profile')).guestId);
 await page.locator('#previewPoster').click();await page.locator('#scorePreview[open]').waitFor();
 await page.waitForFunction(()=>document.querySelector('#scorePreviewImage').naturalWidth===2508);
 assert.match(await page.locator('#scorePreviewImage').getAttribute('alt'),/Mark from Freetown/);
 const downloadPromise=page.waitForEvent('download');await page.locator('#downloadPoster').click();
 const download=await downloadPromise;await download.saveAs(join(tmpdir(),'poda-guest-score.png'));
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1280,height:900}]) {
   await page.setViewportSize(viewport);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('#scorePreview').evaluate(el=>el.scrollWidth<=el.clientWidth));
 }
 await page.locator('#closePreview').click();
 console.log('Reloading and completing a run');
 await page.reload();await finish();
 assert.equal(await page.locator('#driverName').inputValue(),'Mark from Freetown');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('poda-guest-profile')).guestId),id);
 // HTML-looking text remains text in the exported image and does not create DOM nodes.
 await page.locator('#driverName').fill('<img src=x onerror=1>');await page.locator('#saveScore').click();
 assert.equal(await page.locator('#nicknameStatus img').count(),0);
 await page.route('**/api/me',route=>route.fulfill({json:{player:{id:'account-test',driver_name:'PublicDriver',email:'private@example.com'},rankedRoutes:[],authAvailable:true}}));
 console.log('Reloading and completing a run');
 await page.reload();await finish();
 assert.equal(await page.locator('#guestNameForm').isVisible(),false);
 await page.locator('#previewPoster').click();await page.locator('#scorePreview[open]').waitFor();
 assert.match(await page.locator('#scorePreviewImage').getAttribute('alt'),/PublicDriver/);
 assert.doesNotMatch(await page.locator('#scorePreviewImage').getAttribute('alt'),/private@example.com/);
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(navigator,'share',{value:async data=>{window.testSharedFile=data.files[0].type;},configurable:true});});
 await page.locator('#sharePoster').click();
 await page.waitForFunction(()=>window.testSharedFile==='image/png');
 await page.route('**/api/me',route=>route.fulfill({json:{player:null,authAvailable:false}}));
 console.log('Checking unavailable storage');
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage denied');}});});
 console.log('Reloading and completing a run');
 await page.reload();await finish();
 await page.locator('#driverName').fill('Aminata 🌍');await page.locator('#saveScore').click();
 assert.match(await page.locator('#nicknameStatus').textContent(),/session/);
 await page.locator('#previewPoster').click();await page.locator('#scorePreview[open]').waitFor();
 assert.match(await page.locator('#scorePreviewImage').getAttribute('alt'),/Aminata 🌍/);
 assert.deepEqual(errors,[]);
 console.log('PASS: guest fallback, validation, personalized square PNG, responsive preview, reload persistence, injection text, account privacy, native share handoff, storage-denied session.');
} finally {await browser.close();}
