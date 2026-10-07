import { GAME_VERSION, calculateOfficialScore, validateRun } from './services/ScoreValidator.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const playerIdValid = value => typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  const body = await request.text();
  if (body.length > 16384) throw new Error('Request too large');
  return JSON.parse(body);
}

async function limited(env, route, key) {
  if (!env.RUN_RATE_LIMITER) return false;
  const { success } = await env.RUN_RATE_LIMITER.limit({ key: `${route}:${key}` });
  return !success;
}

async function startRun(request, env) {
  let data;
  try { data = await readJson(request); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!playerIdValid(data.playerId)) return json({ error: 'Invalid player ID' }, 400);
  if (await limited(env, 'start', data.playerId)) return json({ error: 'Too many requests' }, 429);
  const runId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const startedAt = Date.now();
  await env.DB.prepare('INSERT INTO run_sessions (run_id, player_id, token_hash, started_at_ms) VALUES (?, ?, ?, ?)')
    .bind(runId, data.playerId, await hashToken(token), startedAt).run();
  return json({ runId, token, gameVersion: GAME_VERSION });
}

async function finishRun(request, env) {
  let data;
  try { data = await readJson(request); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (typeof data.runId !== 'string' || typeof data.token !== 'string') return json({ error: 'Missing run token' }, 400);
  if (await limited(env, 'finish', data.runId)) return json({ error: 'Too many requests' }, 429);
  const session = await env.DB.prepare('SELECT player_id, token_hash, started_at_ms, finished_at_ms FROM run_sessions WHERE run_id = ?')
    .bind(data.runId).first();
  if (!session || session.finished_at_ms !== null || session.token_hash !== await hashToken(data.token)) {
    return json({ error: 'Run token invalid or already used' }, 403);
  }
  const now = Date.now();
  const reason = validateRun(data.summary, data.durationMs, now - session.started_at_ms);
  if (reason) return json({ error: reason }, 400);
  if (data.gameVersion !== GAME_VERSION) return json({ error: 'Unsupported game version' }, 400);
  const run = data.summary;
  const score = calculateOfficialScore(run);
  const playerName = typeof data.playerName === 'string' ? data.playerName.trim().slice(0, 24) : null;
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO runs
    (run_id, player_id, player_name, score, earnings, coins, passengers, distance,
     stops, perfect_stops, missed_stops, collisions, completed, duration_ms, game_version, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      data.runId, session.player_id, playerName, score, run.earnings, run.coins,
      run.passengersDelivered, run.distance, run.stopsServed, run.perfectStops,
      run.stopsMissed, run.collisions, run.completed ? 1 : 0, data.durationMs,
      GAME_VERSION, now,
    ).run();
  if (!result.meta?.changes) return json({ error: 'Run already submitted' }, 409);
  await env.DB.prepare('UPDATE run_sessions SET finished_at_ms = ? WHERE run_id = ?')
    .bind(now, data.runId).run();
  const rank = await env.DB.prepare('SELECT COUNT(*) + 1 AS rank FROM runs WHERE score > ?').bind(score).first();
  return json({ score, rank: rank?.rank || 1, runId: data.runId });
}

function startOfPeriod(period, now) {
  if (period === 'all') return 0;
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  if (period === 'week') day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.getTime();
}

async function leaderboard(url, env) {
  const period = url.searchParams.get('period') || 'today';
  if (!['today', 'week', 'all'].includes(period)) return json({ error: 'Invalid period' }, 400);
  const since = startOfPeriod(period, Date.now());
  const rows = await env.DB.prepare(`SELECT player_name, score, distance, passengers, completed, created_at_ms
    FROM runs WHERE created_at_ms >= ? ORDER BY score DESC, created_at_ms ASC LIMIT 50`)
    .bind(since).all();
  return json({ period, entries: rows.results || [] });
}

async function playerBest(playerId, env) {
  if (!playerIdValid(playerId)) return json({ error: 'Invalid player ID' }, 400);
  const best = await env.DB.prepare('SELECT score, distance, passengers, completed, created_at_ms FROM runs WHERE player_id = ? ORDER BY score DESC, created_at_ms ASC LIMIT 1')
    .bind(playerId).first();
  return json({ best: best || null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.DB) return json({ error: 'Leaderboard unavailable' }, 503);
    try {
      if (url.pathname === '/api/runs/start' && request.method === 'POST') return await startRun(request, env);
      if (url.pathname === '/api/runs/finish' && request.method === 'POST') return await finishRun(request, env);
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') return await leaderboard(url, env);
      const bestMatch = url.pathname.match(/^\/api\/player\/([^/]+)\/best$/);
      if (bestMatch && request.method === 'GET') return await playerBest(bestMatch[1], env);
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('API failure', error);
      return json({ error: 'Service unavailable' }, 503);
    }
  },
};
