import { HttpError, json, readJson, limit } from '../http.mjs';
import { hash } from '../auth/session.mjs';
import { GAME_VERSION, RUN_TTL, eligible, validateRun, calculateOfficialScore } from './ScoreValidator.mjs';
import { startOfPeriod } from './Leaderboard.mjs';
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
export async function startRun(request, env, player) {
  if (!player.driver_name) throw new HttpError(409, 'Choose your driver name in your profile first');
  const data = await readJson(request);
  if (!uuid(data.requestId) || data.gameVersion !== GAME_VERSION) throw new HttpError(400, 'Refresh the game before starting an online run');
  if (!eligible(data.route, data.vehicle)) throw new HttpError(400, 'This route is currently local only');
  await limit(env, 'start:' + player.id);
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO account_run_sessions (run_id,player_id,request_id,vehicle_id,route_id,ruleset,started_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(player_id,request_id) DO NOTHING`)
    .bind(crypto.randomUUID(), player.id, data.requestId, data.vehicle, data.route, GAME_VERSION, now, now + RUN_TTL).run();
  const row = await env.DB.prepare('SELECT * FROM account_run_sessions WHERE player_id=? AND request_id=?').bind(player.id, data.requestId).first();
  if (row.vehicle_id !== data.vehicle || row.route_id !== data.route || row.ruleset !== data.gameVersion) throw new HttpError(409, 'Run start was already used with different settings');
  return json({ runId: row.run_id, playerId: player.id, expiresAt: row.expires_at, gameVersion: row.ruleset });
}
const receipt = row => ({ runId: row.run_id, score: row.score, earnings: row.earnings, acceptedAt: row.accepted_at, status: 'accepted' });
export async function finishRun(request, env, player) {
  const data = await readJson(request);
  if (!uuid(data.runId)) throw new HttpError(400, 'Invalid run ID');
  await limit(env, 'finish:' + player.id);
  const session = await env.DB.prepare('SELECT * FROM account_run_sessions WHERE run_id=? AND player_id=?').bind(data.runId, player.id).first();
  if (!session) throw new HttpError(403, 'This run belongs to another player or no longer exists');
  // Canonical fields make identical retries independent of JSON object key order.
  const fields = ['completed','distance','earnings','coins','style','score','passengersDelivered','passengersOnboard','passengersLost','stopsServed','stopsMissed','perfectStops','collisions'];
  const summary = Object.fromEntries(fields.map(key => [key, data.summary?.[key]]));
  const payloadHash = await hash(JSON.stringify([data.gameVersion, data.durationMs, summary]));
  async function existing() {
    const row = await env.DB.prepare('SELECT * FROM accepted_runs WHERE run_id=? AND player_id=?').bind(data.runId, player.id).first();
    if (row && row.payload_hash !== payloadHash) throw new HttpError(409, 'This run was already saved with different results');
    return row;
  }
  const saved = await existing(); if (saved) return json(receipt(saved));
  const now = Date.now();
  if (now > session.expires_at) throw new HttpError(410, 'This run expired. Your result remains on this device');
  if (session.finished_at || session.ruleset !== GAME_VERSION || data.gameVersion !== GAME_VERSION) throw new HttpError(409, 'Unsupported or finished run');
  const reason = validateRun(summary, data.durationMs, now - session.started_at, session.route_id, session.vehicle_id);
  if (reason) throw new HttpError(422, reason);
  const score = calculateOfficialScore(summary);
  const statements = [
    // A duplicate insert MUST fail the entire batch; never use INSERT OR IGNORE here.
    env.DB.prepare(`INSERT INTO accepted_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(data.runId, player.id, score, summary.earnings,
      summary.distance, data.durationMs, summary.passengersDelivered, summary.perfectStops, +summary.completed, JSON.stringify(summary), payloadHash, now),
    env.DB.prepare('UPDATE account_run_sessions SET finished_at=? WHERE run_id=?').bind(now, data.runId),
    env.DB.prepare(`INSERT INTO player_stats VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(player_id) DO UPDATE SET
        best_at=CASE WHEN excluded.best_score>best_score THEN excluded.best_at ELSE best_at END,
        best_score=MAX(best_score,excluded.best_score),
        earnings_at=CASE WHEN excluded.lifetime_earnings>0 THEN excluded.earnings_at ELSE earnings_at END,
        lifetime_earnings=lifetime_earnings+excluded.lifetime_earnings,
        total_runs=total_runs+1, completed_runs=completed_runs+excluded.completed_runs,
        total_distance=total_distance+excluded.total_distance, total_duration_ms=total_duration_ms+excluded.total_duration_ms,
        total_passengers=total_passengers+excluded.total_passengers, perfect_stops=perfect_stops+excluded.perfect_stops`)
      .bind(player.id, score, now, summary.earnings, now, 1, +summary.completed, summary.distance, data.durationMs, summary.passengersDelivered, summary.perfectStops),
  ];
  for (const period of ['today', 'week']) {
    statements.push(env.DB.prepare(`INSERT INTO period_bests VALUES (?,?,?,?,?,?)
      ON CONFLICT(period,starts_at,player_id) DO UPDATE SET score=excluded.score, achieved_at=excluded.achieved_at,run_id=excluded.run_id
      WHERE excluded.score>score`).bind(period, startOfPeriod(period, now), player.id, score, now, data.runId));
  }
  try { await env.DB.batch(statements); }
  catch (error) {
    // A concurrent identical finish can win the unique insert; return its receipt.
    const concurrent = await existing(); if (concurrent) return json(receipt(concurrent));
    throw error;
  }
  return json({ runId: data.runId, score, earnings: summary.earnings, acceptedAt: now, status: 'accepted' });
}
