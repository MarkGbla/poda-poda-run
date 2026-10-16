const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../src/cbd/data/central-data.json');
const { create } = require('../src/cbd/CbdRoute.js');
const config = require('../src/data/GameConfig.js');

test('Freetown Central is one open mapped drive with the old Central and CBD landmarks in order', () => {
  const route = create(data);
  assert.equal(route.path.closed, false);
  assert.ok(route.length > 5500 && route.length < 6200);
  assert.deepEqual(route.stops.map(s => s.name), config.routes.central.stops);
  const names = route.stops.map(s => s.name);
  for (const name of ['Congo Cross', 'Cotton Tree', 'City Hall', 'Big Market', 'PZ Junction', 'Sani Abacha Street', 'Eastern Police'])
    assert.ok(names.includes(name), name);
  for (let i = 1; i < route.stops.length; i++)
    assert.ok(route.stops[i].s > route.stops[i-1].s, `${route.stops[i].name} must follow ${route.stops[i-1].name}`);
  assert.equal(route.stops[0].s, 0);
  assert.ok(route.length - route.stops.at(-1).s > 40 && route.length - route.stops.at(-1).s < 130);
});

test('the open path ends at Eastern Police and never wraps the vehicle to Congo Cross', () => {
  const route = create(data);
  const start = route.path.frameAt(0), end = route.path.frameAt(route.length);
  assert.ok(Math.hypot(start.x-end.x, start.z-end.z) > 2500);
  const beyond = route.path.toWorld(route.length + 100, 0);
  assert.ok(Math.hypot(beyond.x-end.x, beyond.z-end.z) > 99);
  assert.ok(route.path.stats().minRadius >= 10.9);
  assert.ok(Math.max(...route.path.stats().vertexDeviation) < 6);
  assert.ok(route.turns.every(t => t.onto && t.sStart >= 0 && t.sEnd <= route.length));
});
