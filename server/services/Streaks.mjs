import { streakDate, streakStatus, STREAK_TIMEZONE } from '../../src/services/StreakRules.mjs';
import { HttpError, json, readJson, limit } from '../http.mjs';
import { GAME_VERSION } from './ScoreValidator.mjs';
import config from '../../src/data/GameConfig.js';
const zone = env => env.STREAK_TIMEZONE || STREAK_TIMEZONE;
const unpack = row => row ? { current: row.current_streak, longest: row.longest_streak, lastDate: row.last_qualified_date } : null;
export async function getStreak(env, playerId, now = Date.now()) {
  const row = await env.DB.prepare('SELECT * FROM player_streaks WHERE player_id=?').bind(playerId).first();
  const today = streakDate(now, zone(env));
  return { ...streakStatus(unpack(row), today), today, timezone: zone(env), serverNow: now };
}
export async function qualify(env, playerId, eventId, now = Date.now()) {
  const today = streakDate(now, zone(env));
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO player_streak_events VALUES (?,?,?) ON CONFLICT DO NOTHING`).bind(playerId, eventId, today),
    env.DB.prepare(`INSERT INTO player_streaks (player_id,current_streak,longest_streak,last_qualified_date,streak_started_at,updated_at)
      SELECT ?,1,1,?,?,? WHERE EXISTS (SELECT 1 FROM player_streak_events WHERE player_id=? AND event_id=? AND qualified_date=?)
      ON CONFLICT(player_id) DO UPDATE SET
        current_streak=CASE WHEN julianday(excluded.last_qualified_date)-julianday(last_qualified_date)=1 THEN current_streak+1 ELSE 1 END,
        longest_streak=MAX(longest_streak,CASE WHEN julianday(excluded.last_qualified_date)-julianday(last_qualified_date)=1 THEN current_streak+1 ELSE 1 END),
        streak_started_at=CASE WHEN julianday(excluded.last_qualified_date)-julianday(last_qualified_date)=1 THEN streak_started_at ELSE excluded.streak_started_at END,
        last_qualified_date=excluded.last_qualified_date,updated_at=excluded.updated_at
      WHERE excluded.last_qualified_date>last_qualified_date`).bind(playerId, today, now, now, playerId, eventId, today),
    env.DB.prepare('SELECT * FROM player_streaks WHERE player_id=?').bind(playerId),
  ]);
  return { ...streakStatus(unpack(results[2].results[0]), today), today, timezone: zone(env), serverNow: now, grew: results[1].meta.changes > 0 };
}
export async function runActivity(request, env, player) {
  const data = await readJson(request);
  if (typeof data.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.requestId) || data.gameVersion !== GAME_VERSION ||
      !Object.hasOwn(config.vehicles, data.vehicle) || !(Object.hasOwn(config.routes, data.route) || data.route === 'central')) {
    throw new HttpError(400, 'Invalid gameplay activity');
  }
  await limit(env, 'start:' + player.id);
  return json({ streak: await qualify(env, player.id, data.requestId) });
}
