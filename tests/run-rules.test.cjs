const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/simulation/RunRules.js');

test('finite route includes all thirteen stops and ends at FBC', () => {
  assert.equal(rules.ROUTE.length, 13);
  assert.deepEqual(rules.ROUTE.slice(0, 4), [
    'Goderich', 'Lumley', 'Lumley Beach Road', 'Chapter One',
  ]);
  assert.equal(rules.stopName(12), 'FBC');
  assert.equal(rules.nextStopIndex(11), 12);
  assert.equal(rules.nextStopIndex(12), null);
  assert.equal(rules.stopName(13), null);
});

test('stop acceptance uses the right lane, centre and low speed', () => {
  const stop = { distanceFromCentre: 2, lane: 2, laneX: 3.4, playerX: 3.4, speed: 2 };
  assert.equal(rules.canServeStop(stop), true);
  assert.equal(rules.canServeStop({ ...stop, speed: 3.5 }), false);
  assert.equal(rules.canServeStop({ ...stop, lane: 1 }), false);
  assert.equal(rules.canServeStop({ ...stop, distanceFromCentre: 8 }), false);
  assert.equal(rules.stopGrade(2.9), 'perfect');
  assert.equal(rules.stopGrade(3), 'served');
});

test('score and summary separate fares, coins and driving result', () => {
  const run = {
    completed: true, dist: 4100, cash: 76, coins: 9,
    dropped: 8, pax: [1], lost: 2, stops: 5, missedStops: 1,
    perfectStops: 2, collisions: 1,
  };
  const summary = rules.summarize(run);
  assert.equal(summary.earnings, 76);
  assert.equal(summary.coins, 9);
  assert.equal(summary.score, 1470);
  assert.equal(summary.passengersOnboard, 1);
  assert.equal(rules.calculateScore({ ...run, completed: false }), 1170);
});
