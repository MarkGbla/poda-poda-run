const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function player() {
  const source = readFileSync('src/main.js', 'utf8');
  const nodes = new Map();
  class Element {
    constructor() { this.handlers = {}; this.paused = true; this.classList = { toggle() {} }; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
    setAttribute() {}
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const context = vm.createContext({ Audio: Element, URL, document: { hidden: false, body: { append() {} } },
    store: { get() { return '0'; }, set() {} }, state: 'play', muted: false,
    $: id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }, musicInit() {} });
  const setup = source.slice(source.indexOf('const SOUNDTRACK'), source.indexOf('function musicInit()'));
  const controls = source.slice(source.indexOf('function auxLabel()'), source.indexOf('\nfunction sfx(k)'));
  vm.runInContext((setup + controls).replaceAll('import.meta.url', "'file:///game/src/main.js'"), context);
  return { run: code => vm.runInContext(code, context), click: id => nodes.get(id).handlers.click() };
}

test('soundtrack plays and loops from the final track to the first', async () => {
  const p = player(); p.run('playMusic()'); await Promise.resolve();
  assert.equal(p.run('aux.el.paused'), false);
  for (let i = 0; i < p.run('SOUNDTRACK.length'); i++) { p.run('aux.el.handlers.ended()'); await Promise.resolve(); }
  assert.equal(p.run('aux.i'), 0);
  assert.equal(p.run('aux.list[aux.i].name'), 'Go');
});
test('manual pause survives next track; music mute does not pause playback', async () => {
  const p = player(); p.run('playMusic()'); await Promise.resolve();
  p.click('musicPlay'); p.click('musicNext');
  assert.equal(p.run('aux.paused && aux.el.paused'), true);
  assert.equal(p.run('aux.list[aux.i].name'), 'Audacity');
  p.click('musicPlay'); await Promise.resolve(); p.click('musicMute');
  assert.equal(p.run('aux.el.muted'), true);
  assert.equal(p.run('aux.el.paused'), false);
  assert.equal(p.run('muted'), false);
});
test('hidden or paused games cannot start music and broken tracks are skipped', async () => {
  const p = player(); p.run("state = 'paused'; playMusic()");
  assert.equal(p.run('aux.el.paused'), true);
  p.run("state = 'play'; document.hidden = true; playMusic()");
  assert.equal(p.run('aux.el.paused'), true);
  p.run('document.hidden = false; aux.el.handlers.error()'); await Promise.resolve();
  assert.equal(p.run('aux.list[aux.i].name'), 'Audacity');
  assert.equal(p.run('aux.el.paused'), false);
});
