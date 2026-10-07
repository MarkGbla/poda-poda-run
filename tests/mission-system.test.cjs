const test = require('node:test');
const assert = require('node:assert/strict');
const EventBus = require('../src/engine/EventBus.js');
const MissionSystem = require('../src/simulation/systems/MissionSystem.js');

test('mission progress follows game events and persists', () => {
  const values = new Map();
  const storage = { get: key => values.get(key) || null, set: (key, value) => values.set(key, value) };
  const events = new EventBus();
  const missions = new MissionSystem(events, storage);
  events.emit('stop:served', { grade: 'perfect', passengersDropped: 3 });
  events.emit('route:complete', {});
  assert.deepEqual(missions.status().map(mission => mission.progress), [3, 1, 1]);
  assert.deepEqual(new MissionSystem(new EventBus(), storage).status().map(mission => mission.progress), [3, 1, 1]);
});
