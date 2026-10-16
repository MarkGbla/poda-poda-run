#!/usr/bin/env node
/**
 * Capture the CBD review pack: fixed, reproducible viewpoints (?cbd&view=x,z,yaw,height).
 *
 *   node scripts/cbd/capture-views.mjs --url=http://localhost:5173/ --out=docs/cbd/img [--hide-labels]
 *
 * Viewpoints are plan metres from the OSM Cotton Tree node (x east, z south),
 * yaw in degrees clockwise from north. They are generated from the drivable
 * path so they sit on the carriageway; see docs/cbd/06-visual-reference-catalog.md.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

export const VIEWS = {
  '01-siaka-stevens-law-courts': '43.0,-49.3,45,4.5',
  '02-siaka-stevens-rokel': '137.1,-123.2,50,4.5',
  '03-corner-wilberforce': '352.0,-277.7,52,4.5',
  '04-wilberforce-to-wallace-johnson': '251.0,-494.7,326,4.5',
  '05-wallace-johnson-city-hall': '81.3,-411.2,232,4.5',
  '06-wallace-johnson-big-market': '-59.7,-310.4,217,4.5',
  '07-walpole': '-152.8,-209.9,145,4.5',
  '08-roundabout-cotton-tree': '-19.8,-10.3,127,4.5',
  '09-cotton-tree-close': '-6.7,14.9,58,1.7',
  '10-city-hall-street-level': '15.9,-375.5,269,1.7',
};

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const url = args.url || 'http://localhost:5173/';
const out = args.out || 'docs/cbd/img';
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = await import('playwright-core');
const { readdirSync, existsSync } = require('node:fs'); const { homedir } = require('node:os');
const root = join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
let executablePath = process.env.SMOKE_CHROMIUM;
for (const d of executablePath ? [] : readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().reverse())
  for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome'])
    if (!executablePath && existsSync(join(root, d, rel))) executablePath = join(root, d, rel);
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const [name, view] of Object.entries(VIEWS)) {
  await page.goto(`${url}?cbd&view=${view}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.PODA?.debug?.cbd, null, { timeout: 30000 });
  await page.evaluate(() => { for (const id of ['title', 'hud', 'touch', 'radio']) { const el = document.getElementById(id); if (el) el.hidden = true; } });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 78 });
  console.log(name);
}
await browser.close();
