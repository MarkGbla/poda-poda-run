const test = require('node:test');
const assert = require('node:assert/strict');
const client = require('../src/simulation/RunRules.js');

test('server and game use the same score formula', async () => {
  const { calculateOfficialScore, validateRun } = await import('../server/services/ScoreValidator.mjs');
  const run = {
    completed: true, distance: 4800, earnings: 57, coins: 9,
    passengersDelivered: 7, passengersOnboard: 0, passengersLost: 1,
    stopsServed: 10, stopsMissed: 2, perfectStops: 3, collisions: 1,
  };
  assert.equal(calculateOfficialScore(run), client.calculateScore({
    completed: run.completed, dist: run.distance, dropped: run.passengersDelivered,
    stops: run.stopsServed, missedStops: run.stopsMissed,
    perfectStops: run.perfectStops, collisions: run.collisions,
  }));
  assert.equal(validateRun(run, 300000, 301000), null);
  assert.match(validateRun({ ...run, perfectStops: 11 }, 300000, 301000), /stop grades/);
  assert.match(validateRun({ ...run, distance: 50000 }, 300000, 301000), /Distance/);
  assert.match(validateRun({ ...run, earnings: 51 }, 300000, 301000), /earnings/);
  assert.match(validateRun({ ...run, stopsMissed: 1 }, 300000, 301000), /Incomplete route/);
});

test('API reports missing D1 without exposing internals', async () => {
  const worker = (await import('../server/worker.mjs')).default;
  const response = await worker.fetch(new Request('https://example.test/api/leaderboard'), {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Leaderboard unavailable' });
});

test('API rejects malformed anonymous player IDs before writing a session', async () => {
  const worker = (await import('../server/worker.mjs')).default;
  const response = await worker.fetch(new Request('https://example.test/api/runs/start', {
    method: 'POST', body: JSON.stringify({ playerId: '------------------------------------' }),
  }), { DB: {} });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid player ID' });
});
