#!/usr/bin/env node
/**
 * Headless smoke check for Poda-Poda Run.
 *
 * `src/main.js` has no unit coverage, so this is the gate that proves the game
 * still boots, drives and reaches every screen after a refactor. It also prints
 * the renderer's draw-call and triangle counts, which are the early warning that
 * chunk baking, geometry merging or coin instancing has broken — those numbers
 * move long before anything looks wrong on screen.
 *
 *   npm run smoke                      start a Vite dev server and drive it
 *   npm run smoke -- --url=http://…    drive a server that is already running
 *   npm run smoke -- --shots=out/      also save screenshots to a directory
 *   npm run smoke -- --offline-cdn     fail if the page requests a CDN host
 *   npm run smoke -- --cbd-only        run the CBD desktop and touch checks
 *
 * Exits non-zero on any page error, failed assertion, or missing element.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const PORT = 5179;
const SHOTS = typeof args.shots === 'string' ? args.shots : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

/* ---------- assertions ---------- */
const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ok   ${label}${detail ? ' — ' + detail : ''}`);
  else failures.push(`  FAIL ${label}${detail ? ' — ' + detail : ''}`);
  return condition;
}

/* ---------- locate a Chromium ---------- */
/** Playwright's own executablePath() only resolves browsers whose build number
 *  matches this playwright-core version, so fall back to scanning the cache. */
function findChromium(chromium) {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch { /* not installed under this version — scan instead */ }

  const root = platform() === 'darwin'
    ? join(homedir(), 'Library/Caches/ms-playwright')
    : join(homedir(), '.cache/ms-playwright');
  if (!existsSync(root)) return null;

  const builds = readdirSync(root)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

  const candidates = [
    'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-linux/chrome',
    'chrome-win/chrome.exe',
  ];
  for (const build of builds) {
    for (const rel of candidates) {
      const full = join(root, build, rel);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

/* ---------- dev server ---------- */
function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error('Vite did not start within 30s')), 30000);
    let out = '';
    const onData = d => {
      out += d.toString();
      if (out.includes('ready in') || out.includes(`localhost:${PORT}`)) {
        clearTimeout(timer);
        resolve({ proc, url: `http://localhost:${PORT}/` });
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', err => { clearTimeout(timer); reject(err); });
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Vite exited early (${code})\n${out}`));
    });
  });
}

/* ---------- drive ---------- */
const IGNORED_CONSOLE = [
  /favicon\.ico/,            // the page intentionally declares no icon
];

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core is not installed. Run: npm install');
    process.exit(2);
  }

  const executablePath = findChromium(chromium);
  if (!executablePath) {
    console.error(
      'No Chromium found. Install one with:\n' +
      '  npx playwright install chromium\n' +
      'or point SMOKE_CHROMIUM at an existing binary.',
    );
    process.exit(2);
  }

  let server = null;
  let url = typeof args.url === 'string' ? args.url : null;
  if (!url) {
    server = await startServer();
    url = server.url;
  }

  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = function (...args) {
      const element = new NativeAudio(...args);
      window.__podaSmokeMusic = element;
      return element;
    };
  });

  const errors = [];
  const cdnRequests = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Resource-load failures carry no URL in the message text; it is on the location.
    const where = m.location?.()?.url ?? '';
    const text = m.text();
    if (IGNORED_CONSOLE.some(re => re.test(text) || re.test(where))) return;
    errors.push(`console: ${text}${where ? ` (${where})` : ''}`);
  });
  page.on('request', r => {
    const host = new URL(r.url()).host;
    if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) cdnRequests.push(r.url());
  });

  const shot = name => SHOTS && page.screenshot({ path: join(SHOTS, name) });
  const num = s => parseFloat(String(s).replace(/[^\d.]/g, '')) || 0;
  /** Record an unreachable control as a failed check rather than aborting the run. */
  const safeClick = async (selector, label) => {
    try { await page.click(selector, { timeout: 8000 }); return true; }
    catch { check(label || `click ${selector}`, false, 'not clickable'); return false; }
  };

  try {
    /* --- title --- */
    if (!args['cbd-only']) {
    await page.goto(url + '?stats', { waitUntil: 'load' });
    await page.waitForSelector('#startBtn', { timeout: 20000 });
    await page.waitForTimeout(5000);               // give WebGL + fonts time to settle
    check('title screen visible', await page.isVisible('#title'));
    check('page title', (await page.title()) === 'Poda-Poda Run', await page.title());
    await shot('01-title.png');

    /* --- start a shift --- */
    await safeClick('#startBtn', 'start the shift');
    await page.waitForTimeout(2500);
    check('HUD visible after start', await page.isVisible('#hud'));
    await shot('02-start.png');

    /* --- audio lifecycle: pause, resume, and leave a run --- */
    await page.waitForFunction(() => window.__podaSmokeMusic && !window.__podaSmokeMusic.paused, null, { timeout: 5000 }).catch(() => {});
    check('music starts during a run', await page.evaluate(() => !!window.__podaSmokeMusic && !window.__podaSmokeMusic.paused));
    await safeClick('#pauseBtn', 'pause the run');
    check('music pauses with the game', await page.evaluate(() => window.__podaSmokeMusic?.paused === true));
    await safeClick('#resumeBtn', 'resume the run');
    await page.waitForFunction(() => window.__podaSmokeMusic && !window.__podaSmokeMusic.paused, null, { timeout: 5000 }).catch(() => {});
    check('music resumes with the game', await page.evaluate(() => window.__podaSmokeMusic?.paused === false));
    await safeClick('#pauseBtn', 'pause before leaving');
    await safeClick('#homePause', 'open leave confirmation');
    await safeClick('#leaveConfirm', 'leave the run');
    check('music stops on Home', await page.evaluate(() => window.__podaSmokeMusic?.paused === true));
    await safeClick('#startBtn', 'start another shift');
    await page.waitForFunction(() => window.__podaSmokeMusic && !window.__podaSmokeMusic.paused, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => addEventListener('pagehide', () => {
      sessionStorage.setItem('poda-smoke-pagehide-paused', String(window.__podaSmokeMusic?.paused));
    }));
    await page.goto(url + '?stats', { waitUntil: 'load' });
    check('music stops when the page closes', await page.evaluate(() => sessionStorage.getItem('poda-smoke-pagehide-paused') === 'true'));
    await page.waitForSelector('#startBtn', { timeout: 20000 });
    await safeClick('#startBtn', 'start the driving check');

    /* --- drive --- */
    await page.focus('#c');
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(6000);
    const speed = num(await page.textContent('#kmh'));
    const dist = num(await page.textContent('#dist'));
    check('bus is moving', speed > 10, `${speed} km/h`);
    check('distance accumulates', dist > 0.05, `${dist} km`);
    check('next stop named', (await page.textContent('#stopName')).trim().length > 1,
      (await page.textContent('#stopName')).trim());
    await shot('03-driving.png');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(2500);
    await page.keyboard.press('KeyH');
    await page.waitForTimeout(4000);
    await page.keyboard.up('ArrowUp');

    const pax = await page.textContent('#paxN');
    check('passengers tracked', /^\d+\/\d+$/.test(pax.trim()), pax.trim());
    await shot('04-driving2.png');

    /* --- renderer baseline --- */
    const metrics = await page.evaluate(() => window.PODA?.debug?.metrics ?? null);
    check('renderer metrics exposed', !!metrics);
    if (metrics) {
      notes.push(`  ---- ${metrics.calls} draws · ${metrics.triangles.toLocaleString('en-US')} triangles · ` +
        `${metrics.geometries} geometries · ${metrics.textures} textures · DPR ${metrics.ratio.toFixed(2)} · ${metrics.fps} fps`);
    }

    /* --- pause / resume ---
     * Only reachable while a run is still live. A crash during the drive above is
     * ordinary play, not a smoke failure, so report it and skip rather than throw. */
    const crashed = await page.isVisible('#over');
    if (crashed) {
      notes.push('  ---- run ended during the drive; pause/resume not exercised this time');
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      if (check('pause screen opens', await page.isVisible('#pause'))) {
        await shot('05-pause.png');
        await safeClick('#resumeBtn', 'resume the run');
        await page.waitForTimeout(600);
        check('pause screen closes', !(await page.isVisible('#pause')));
      }
    }

    /* --- menus (from a fresh load, which is where they are reachable) --- */
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('#startBtn', { timeout: 20000 });
    await page.waitForTimeout(4500);

    await safeClick('#garageTitle', 'garage opens');
    await page.waitForTimeout(2000);
    check('garage opens', await page.isVisible('#playerGarage'));
    const rides = await page.$$eval('#rideSelect option', o => o.length);
    const routes = await page.$$eval('#routeSelect option', o => o.length);
    check('all rides listed', rides === 5, `${rides} rides`);
    check('all routes listed', routes === 4, `${routes} routes`);
    await shot('06-garage.png');
    await safeClick('#garageClose', 'garage closes');
    await page.waitForTimeout(600);

    await safeClick('#missionsTitle', 'missions open');
    await page.waitForTimeout(800);
    check('missions open', (await page.textContent('#missionsText')).includes('/'));
    await safeClick('#missionsClose', 'missions close');
    await page.waitForTimeout(400);

    await safeClick('#leadersTitle', 'leaderboard opens');
    await page.waitForTimeout(2000);
    check('leaderboard opens', await page.isVisible('#leaderboard'));
    check('leaderboard reports a state',
      (await page.textContent('#leaderMessage')).trim().length > 0,
      (await page.textContent('#leaderMessage')).trim());
    await shot('07-leaderboard.png');

    /* --- deterministic geometry baseline ---
     * Draw-call and triangle counts swing with district and position, so a plain
     * reading off a live run is not comparable between stages. `?benchmark` seeds
     * the visual RNG (`seededVisuals`) and lays out a fixed set of fixtures, and
     * `loop()` skips `update()` in that mode — so the scene is static and the
     * counts are reproducible. This is the number to diff across refactors. */
    await page.goto(url + '?benchmark&stats', { waitUntil: 'load' });
    await page.waitForTimeout(7000);
    const bench = await page.evaluate(() => window.PODA?.debug?.metrics ?? null);
    check('benchmark scene renders', !!bench && bench.calls > 0);
    if (bench) {
      notes.push(`  ---- benchmark: ${bench.calls} draws · ${bench.triangles.toLocaleString('en-US')} triangles · ` +
        `${bench.geometries} geometries · ${bench.textures} textures`);
    }
    await shot('08-benchmark.png');

    /* --- remaining entry points must still boot --- */
    for (const [label, suffix] of [['district view', '?district=Kissy'], ['garage view', '?garage']]) {
      const before = errors.length;
      await page.goto(url + suffix, { waitUntil: 'load' });
      await page.waitForTimeout(6000);
      check(`${label} boots`, errors.length === before,
        errors.slice(before).join('; ') || suffix);
    }

    }
    /* --- Freetown Central: the former ?cbd link opens the unified mapped route --- */
    {
      const before = errors.length;
      await page.goto(url + '?cbd&stats', { waitUntil: 'load' });
      await page.waitForSelector('#startBtn', { timeout: 20000 });
      await page.waitForTimeout(4000);
      check('Central title identifies the unified route', (await page.textContent('#titleRouteName')).trim() === 'Freetown Central');
      check('CBD map credit is off the game view', await page.locator('body > .cbd-map-credit').count() === 0);
      check('CBD map credit is available in menus', await page.locator('#titleHelp .cbd-map-credit a').getAttribute('href') === 'https://www.openstreetmap.org/copyright' && await page.locator('.pause-options .cbd-map-credit a').count() === 1);
      check('Central keeps route navigation available', await page.isVisible('#titleRouteNext') && await page.isVisible('#titleRoutePrev'));
      await safeClick('#garageTitle', 'CBD garage opens');
      await page.waitForFunction(() => !window.PODA.debug.cbd.group.visible);
      check('CBD scenery is hidden in garage', await page.evaluate(() => !window.PODA.debug.cbd.group.visible));
      check('Central garage shows the mapped route', !(await page.locator('#routeSelect').isDisabled()) && await page.inputValue('#routeSelect') === 'central');
      check('Central garage explains driving and score storage', /Congo Cross.*Eastern Police.*Bends turn automatically.*this device/.test(await page.textContent('#routeDescription')));
      check('Central garage lists stops in driving order', await page.locator('.central-stop-details li').allTextContents().then(a => a[0] === 'Congo Cross' && a.at(-1) === 'Eastern Police' && a.indexOf('Cotton Tree') < a.indexOf('PZ Junction')));
      await page.selectOption('#routeSelect', 'western');
      check('switching away restores the arcade road', await page.evaluate(() => !window.PODA.debug.cbd && window.PODA.debug.scene.getObjectByName('street-static').visible));
      await page.selectOption('#routeSelect', 'central');
      check('switching back restores mapped streets', await page.evaluate(() => !!window.PODA.debug.cbd && !window.PODA.debug.scene.getObjectByName('street-static').visible));
      await shot('09-cbd-garage.png');
      await safeClick('#garageClose', 'CBD garage closes');
      check('Central selection persists as one route', await page.evaluate(() => localStorage.getItem('poda-route')) === 'central');
      await safeClick('#startBtn', 'start a CBD shift');
      await page.waitForFunction(() => window.PODA.debug.cbd.group.visible);
      await page.focus('#c');
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(7000);
      await page.keyboard.up('ArrowUp');
      const cbd = await page.evaluate(() => {
        const c = window.PODA?.debug?.cbd;
        return c && { s: c.s, start: c.route.startS, street: c.street(), stops: c.stopNames, metrics: window.PODA.debug.metrics };
      });
      check('Central mapped route boots', !!cbd);
      if (cbd) {
        check('Central vehicle advances along the mapped road', cbd.s - cbd.start > 40, `${(cbd.s - cbd.start).toFixed(0)} m on ${cbd.street}`);
        check('Central route combines west, downtown and east stops', cbd.stops[0] === 'Congo Cross' && cbd.stops.at(-1) === 'Eastern Police' && cbd.stops.includes('City Hall') && cbd.stops.includes('Big Market') && cbd.stops.includes('PZ Junction'));
        check('CBD next stop shown', cbd.stops.includes((await page.textContent('#stopName')).trim()));
        notes.push(`  ---- cbd: ${cbd.metrics.calls} draws · ${cbd.metrics.triangles.toLocaleString('en-US')} triangles · ` +
          `${cbd.metrics.geometries} geometries · ${cbd.metrics.textures} textures · ${cbd.metrics.fps} fps`);
      }
      await shot('09-cbd.png');
      await safeClick('#pauseBtn', 'CBD pauses');
      await page.locator('.pause-options summary').click();
      await safeClick('#restartBtn', 'CBD restarts');
      check('CBD restart resets route progress', await page.evaluate(() => Math.abs(window.PODA.debug.cbd.s - window.PODA.debug.cbd.route.startS) < 1));
      check('CBD view raises no errors', errors.length === before, errors.slice(before).join('; '));
    }

    /* Phone viewport + real browser touch events; not a phone GPU benchmark. */
    {
      const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      mobile.on('pageerror', e => errors.push(`mobile: ${e.message}`));
      await mobile.goto(url + '?cbd', { waitUntil: 'load' });
      await mobile.waitForFunction(() => !!window.PODA?.debug?.cbd);
      check('mobile title fits viewport', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      check('mobile CBD route name is not clipped', await mobile.locator('#titleRouteName').evaluate(el => el.scrollWidth <= el.clientWidth));
      await mobile.locator('#titleHow').tap();
      check('CBD help explains automatic bends', /Bends turn automatically/.test(await mobile.textContent('#titleHelp')));
      await mobile.locator('#titleHelpClose').tap();
      if (SHOTS) await mobile.screenshot({ path: join(SHOTS, '10-cbd-mobile-title.png') });
      await mobile.locator('#startBtn').tap();
      const cdp = await mobile.context().newCDPSession(mobile);
      const gas = await mobile.locator('#gasBtn').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 }] });
      check('mobile gas engages', await mobile.evaluate(() => window.PODA.debug.run().input.gas));
      await mobile.waitForTimeout(2000);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      check('mobile gas releases', await mobile.evaluate(() => !window.PODA.debug.run().input.gas));
      const lane = await mobile.evaluate(() => window.PODA.debug.run().S.lane);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 260, y: 430 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 430 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      check('mobile swipe changes lane', await mobile.evaluate(() => window.PODA.debug.run().S.lane) === Math.max(0, lane - 1));
      if (SHOTS) await mobile.screenshot({ path: join(SHOTS, '11-cbd-mobile-play.png') });
      await mobile.locator('#pauseBtn').tap();
      check('mobile pause is reachable', await mobile.isVisible('#pause'));
      await mobile.locator('#homePause').tap();
      await mobile.locator('#leaveConfirm').tap();
      check('mobile Home returns to title', await mobile.isVisible('#title'));
      await mobile.close();
    }

    /* --- motorcycle starts ready to collect its single passenger --- */
    await page.evaluate(() => localStorage.setItem('poda-vehicle', 'okada'));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('#startBtn', { timeout: 20000 });
    await safeClick('#startBtn', 'start motorcycle ride');
    await page.waitForTimeout(1800);
    check('motorcycle starts with one empty passenger seat',
      (await page.locator('#paxN').textContent()).trim() === '0/1');

    /* --- external requests --- */
    const uniqueHosts = [...new Set(cdnRequests.map(u => new URL(u).host))];
    if (args['offline-cdn']) {
      check('no external requests', uniqueHosts.length === 0, uniqueHosts.join(', '));
    } else if (uniqueHosts.length) {
      notes.push(`  ---- external hosts: ${uniqueHosts.join(', ')}`);
    }
  } finally {
    await browser.close();
    if (server) server.proc.kill();
  }

  /* ---------- report ---------- */
  console.log('\nPoda-Poda Run — smoke check\n');
  for (const line of notes) console.log(line);
  if (errors.length) {
    console.log(`\n  ${errors.length} page error(s):`);
    for (const e of errors.slice(0, 20)) console.log(`    ${e}`);
  }
  if (failures.length) {
    console.log('');
    for (const f of failures) console.log(f);
  }

  const ok = failures.length === 0 && errors.length === 0;
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${notes.filter(n => n.startsWith('  ok')).length} checks passed, ` +
    `${failures.length} failed, ${errors.length} page errors\n`);
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error('\nSmoke check could not run:\n', err);
  process.exit(2);
});
