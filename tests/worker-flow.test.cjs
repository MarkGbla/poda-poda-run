const test = require('node:test');
const assert = require('node:assert/strict');

function memoryDB() {
  const sessions = new Map();
  const runs = new Map();
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              if (sql.startsWith('INSERT INTO run_sessions')) {
                const [runId, playerId, tokenHash, startedAt] = values;
                sessions.set(runId, { player_id: playerId, token_hash: tokenHash, started_at_ms: startedAt, finished_at_ms: null });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT OR IGNORE INTO runs')) {
                if (runs.has(values[0])) return { meta: { changes: 0 } };
                runs.set(values[0], { run_id: values[0], player_id: values[1], player_name: values[2], score: values[3],
                  earnings: values[4], coins: values[5], passengers: values[6], distance: values[7],
                  stops: values[8], perfect_stops: values[9], missed_stops: values[10], collisions: values[11],
                  completed: values[12], duration_ms: values[13], game_version: values[14], created_at_ms: values[15] });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('UPDATE run_sessions')) {
                sessions.get(values[1]).finished_at_ms = values[0];
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected SQL: ${sql}`);
            },
            async first() {
              if (sql.startsWith('SELECT player_id')) return sessions.get(values[0]) || null;
              if (sql.startsWith('SELECT COUNT(*)')) return { rank: [...runs.values()].filter(run => run.score > values[0]).length + 1 };
              if (sql.includes('WHERE player_id = ?')) return [...runs.values()].filter(run => run.player_id === values[0]).sort((a, b) => b.score - a.score)[0] || null;
              throw new Error(`Unexpected SQL: ${sql}`);
            },
            async all() {
              if (!sql.includes('FROM runs WHERE created_at_ms')) throw new Error(`Unexpected SQL: ${sql}`);
              return { results: [...runs.values()].filter(run => run.created_at_ms >= values[0]).sort((a, b) => b.score - a.score) };
            },
          };
        },
      };
    },
  };
}

test('worker accepts one completed run and lists its official score', async () => {
  const worker = (await import('../server/worker.mjs')).default;
  const env = { DB: memoryDB() };
  const playerId = crypto.randomUUID();
  const post = (path, body) => worker.fetch(new Request(`https://example.test${path}`, {
    method: 'POST', body: JSON.stringify(body),
  }), env);
  const start = await post('/api/runs/start', { playerId });
  assert.equal(start.status, 200);
  const session = await start.json();
  const summary = {
    completed: true, distance: 4800, earnings: 57, coins: 9,
    passengersDelivered: 7, passengersOnboard: 0, passengersLost: 1,
    stopsServed: 10, stopsMissed: 2, perfectStops: 3, collisions: 1,
  };
  const payload = { ...session, summary, durationMs: 300000 };
  // The server checks a run's elapsed wall time, so backdate the in-memory session.
  const storedSession = await env.DB.prepare('SELECT player_id, token_hash, started_at_ms, finished_at_ms FROM run_sessions WHERE run_id = ?')
    .bind(session.runId).first();
  storedSession.started_at_ms -= 300000;
  const finish = await post('/api/runs/finish', payload);
  assert.equal(finish.status, 200);
  const accepted = await finish.json();
  assert.equal(accepted.score, 1570);
  assert.equal(accepted.rank, 1);
  assert.equal((await post('/api/runs/finish', payload)).status, 403);
  const board = await worker.fetch(new Request('https://example.test/api/leaderboard?period=all'), env);
  assert.equal(board.status, 200);
  assert.equal((await board.json()).entries[0].score, 1570);
  const best = await worker.fetch(new Request(`https://example.test/api/player/${playerId}/best`), env);
  assert.equal((await best.json()).best.score, 1570);
});
