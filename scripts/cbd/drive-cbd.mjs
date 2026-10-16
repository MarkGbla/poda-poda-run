#!/usr/bin/env node
/**
 * Drive one CBD lap headlessly and record what happened.
 *
 *   node scripts/cbd/drive-cbd.mjs --url=http://localhost:5173/ --shots=out/cbd [--mobile]
 *
 * Uses the title-screen autopilot (#demo) so the run is hands-off, samples the
 * vehicle's arc position, speed, cap and frame metrics once a second, and saves
 * a screenshot at each sample. Exits non-zero on page errors.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const url = args.url || 'http://localhost:5173/';
const shots = typeof args.shots === 'string' ? args.shots : null;
const seconds = Number(args.seconds || 150);
if (shots) mkdirSync(shots, { recursive: true });
const { chromium } = await import('playwright-core');
const require = createRequire(import.meta.url);
const executablePath = process.env.SMOKE_CHROMIUM || (() => {
  const { readdirSync, existsSync } = require('node:fs'); const { homedir } = require('node:os');
  const root = join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  for (const d of readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()) for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome']) if (existsSync(join(root, d, rel))) return join(root, d, rel);
})();
const browser = await chromium.launch({ executablePath });
const viewport = args.mobile ? { width: 412, height: 860 } : { width: 1280, height: 800 };
const page = await browser.newPage({ viewport, deviceScaleFactor: args.mobile ? 2 : 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
// --baseline drives the original straight-road game the same way, for comparison.
await page.goto(url + (args.baseline ? '?stats#demo' : '?cbd&stats#demo'), { waitUntil: 'load' });
await page.waitForFunction(() => window.PODA?.debug?.metrics, null, { timeout: 30000 });
const samples = [];
for (let t = 0; t < seconds; t++) {
  await page.waitForTimeout(1000);
  const row = await page.evaluate(() => {
    const d = window.PODA.debug, c = d.cbd;
    return { s: c ? Math.round(c.s) : null, street: c ? c.street() : '', cap: c ? +c.speedCap().toFixed(1) : null, hint: document.getElementById('hint')?.textContent || '', kmh: document.getElementById('kmh')?.textContent, stop: document.getElementById('stopName')?.textContent, metrics: d.metrics, over: !document.getElementById('over').hidden };
  });
  samples.push({ t, ...row });
  if (shots && t % 5 === 0) await page.screenshot({ path: join(shots, `lap-${String(t).padStart(3, '0')}.png`) });
  if (row.over) break;
}
await browser.close();
if (shots) writeFileSync(join(shots, 'samples.json'), JSON.stringify(samples, null, 1));
for (const r of samples) console.log(`${String(r.t).padStart(3)}s s=${r.s} ${r.street} cap=${r.cap} ${r.kmh} stop=${r.stop} fps=${r.metrics?.fps} draws=${r.metrics?.calls} tris=${r.metrics?.triangles} ${r.hint}`);
console.log(errors.length ? `\n${errors.length} page errors:\n  ` + errors.slice(0, 10).join('\n  ') : '\nno page errors');
process.exit(errors.length ? 1 : 0);
