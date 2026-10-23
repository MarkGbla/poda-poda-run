#!/usr/bin/env node
// Run against an existing Vite server: node scripts/environment-smoke.mjs
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = join(homedir(), 'Library/Caches/ms-playwright');
let executablePath = process.env.SMOKE_CHROMIUM;
for (const d of executablePath ? [] : readdirSync(root).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
  for (const rel of ['chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
    if (!executablePath && existsSync(join(root,d,rel))) executablePath = join(root,d,rel);
  }
}
const browser = await chromium.launch({ executablePath });
const url = process.env.PODA_URL || 'http://127.0.0.1:5173/';
let failed = false;
const cases = [['DAY',{width:1280,height:720}], ['NIGHT',{width:1280,height:720}], ['NIGHT',{width:412,height:860}], ['NIGHT',{width:860,height:412}], ['NIGHT',{width:412,height:860},'low'], ['NIGHT',{width:1280,height:720},'auto','central']];
for (const [index, [mode, viewport, quality = 'auto', route = 'western']] of cases.entries()) {
  if (process.env.PODA_ONLY && !process.env.PODA_ONLY.split(',').includes(String(index))) continue;
  const page = await browser.newPage({ viewport });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(({mode,quality,route}) => { localStorage.setItem('poda-environment', mode); localStorage.setItem('poda-quality', quality); localStorage.setItem('poda-route', route); }, {mode,quality,route});
    await page.goto(url + (route==='central'?'?cbd&benchmark&stats':'?benchmark&stats'), { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForFunction(() => window.PODA?.debug?.metrics, null, { timeout:route === 'central' ? 150000 : 60000 });
    await page.waitForTimeout(2000);
    const result = await page.evaluate(() => ({
      state: window.PODA?.debug?.run().state,
      metrics: window.PODA?.debug?.metrics,
      playerLight: !!window.PODA?.debug?.scene?.children.find(x=>x.userData?.vehicleLights?.player),
      playerSpot: window.PODA?.debug?.scene?.children.find(x=>x.userData?.vehicleLights?.player)?.userData.vehicleLights.spot.visible,
      streetLights: window.PODA?.debug?.scene?.getObjectByName('night-streetlights')?.children.slice(-2).map(x => x.visible),
      cbdStreet: window.PODA?.debug?.cbd?.group.getObjectByName('night-streetlights')?.children.slice(-2).map(x=>x.visible),
    }));
    await page.screenshot({ path:`/tmp/poda-${route}-${mode.toLowerCase()}-${viewport.width}-${quality}.png` });
    console.log(JSON.stringify({ mode, viewport, quality, route, result, errors }));
    const street = route==='central'?result.cbdStreet:result.streetLights;
    if (errors.length || result.state !== 'play' || !result.playerLight || street?.[0] !== (mode === 'NIGHT') || result.playerSpot !== (mode === 'NIGHT' && quality !== 'low')) failed = true;
  } catch (error) { failed = true; console.error(mode, viewport, error.message); }
  await page.close();
}
await browser.close();
if (failed) process.exitCode = 1;
