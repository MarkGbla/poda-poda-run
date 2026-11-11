const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('sign-in clicked during account loading continues to Google after refresh', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, href: '/api/auth/google', handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; }, focus() {} });
    return elements.get(id);
  };
  let navigated, opened = 0, prevented = false;
  const source = fs.readFileSync(require.resolve('../src/ui/AccountUI.js'), 'utf8')
    .replace("import { modal } from './Modal.js';", '')
    .replace('export function createAccountUI', 'function createAccountUI');
  const context = vm.createContext({
    document: { getElementById: element, querySelectorAll: () => [] },
    location: { href: 'https://game.test/', assign(url) { navigated = url; } },
    URL, history: {}, addEventListener() {}, setTimeout, clearTimeout,
    modal: () => ({ open() { opened++; }, close() {} }),
  });
  vm.runInContext(source, context);
  const api = { account: null, async refresh() {
    this.account = { player: null, authAvailable: true }; return this.account;
  } };
  context.createAccountUI({ api, store: {}, canApply: () => true });
  // Simulate the user clicking before the initial async refresh resolves.
  api.account = null;
  await element('homeGoogleLogin').handlers.click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(navigated, '/api/auth/google');
  assert.equal(opened, 0);
  api.account = { player: null, authAvailable: false };
  api.refresh = async () => api.account;
  navigated = undefined;
  await element('homeGoogleLogin').handlers.click({ preventDefault() {} });
  assert.equal(navigated, undefined);
  assert.equal(opened, 1);
});
