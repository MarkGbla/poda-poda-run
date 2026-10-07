const test = require('node:test');
const assert = require('node:assert/strict');
const ApiClient = require('../src/services/ApiClient.js');

test('online run uses a persistent anonymous ID and submits one summary', async () => {
  const values = new Map();
  const storage = { get: key => values.get(key) || null, set: (key, value) => values.set(key, value) };
  const calls = [];
  const fetchFn = async (path, options) => {
    calls.push({ path, body: options?.body && JSON.parse(options.body) });
    return { ok: true, json: async () => path.endsWith('/start')
      ? { runId: 'run-1', token: 'token-1', gameVersion: '0.1.0' }
      : { score: 420, rank: 3 } };
  };
  const api = new ApiClient(storage, fetchFn, () => 'player-1');
  await api.start();
  const result = await api.finish({ score: 420 }, 60000);
  assert.equal(result.rank, 3);
  assert.equal(calls[0].body.playerId, 'player-1');
  assert.equal(calls[1].body.runId, 'run-1');
  assert.equal(calls[1].body.durationMs, 60000);
  assert.equal(new ApiClient(storage, fetchFn, () => 'other').playerId, 'player-1');
});

test('offline run leaves local results available', async () => {
  const storage = { get: () => null, set: () => {} };
  const api = new ApiClient(storage, async () => { throw new Error('offline'); }, () => 'player-2');
  await api.start();
  assert.equal(await api.finish({}, 1000), null);
});
