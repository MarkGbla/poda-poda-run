const test = require('node:test');
const assert = require('node:assert/strict');
const QualityManager = require('../src/rendering/QualityManager.js');

test('manual quality profiles apply pixel ratio and shadows', () => {
  const ratios = [];
  const renderer = { shadowMap: { enabled: true }, setPixelRatio: value => ratios.push(value) };
  const sun = { castShadow: true };
  const scene = { traverse: callback => callback({ material: {} }) };
  let resizes = 0;
  const quality = new QualityManager(renderer, sun, scene, () => resizes++, 2);
  quality.setProfile('low');
  assert.equal(renderer.shadowMap.enabled, false);
  assert.equal(sun.castShadow, false);
  assert.equal(ratios.at(-1), 0.8);
  quality.setProfile('high');
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(ratios.at(-1), 1.75);
  assert.equal(resizes, 2);
});
