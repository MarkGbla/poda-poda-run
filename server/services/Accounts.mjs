import { HttpError, json, readJson, limit } from '../http.mjs';
import { authConfigured } from '../auth/google.mjs';
import { RANKED_ROUTES, GAME_VERSION } from './ScoreValidator.mjs';
export const PREFERENCE_KEYS = ['poda-vehicle','poda-route','poda-livery','poda-slogan','poda-paint','poda-rack',
  'poda-cargo','poda-wheels','poda-trim','poda-board','poda-sticker','poda-horn'];
export async function profile(env, player) {
  if (!player) return json({ player: null, authAvailable: authConfigured(env), rankedRoutes: RANKED_ROUTES, gameVersion: GAME_VERSION });
  const [stats, progress] = await env.DB.batch([
    env.DB.prepare('SELECT best_score,lifetime_earnings,total_runs,completed_runs,total_distance,total_duration_ms,total_passengers,perfect_stops FROM player_stats WHERE player_id=?').bind(player.id),
    env.DB.prepare('SELECT preferences_json,version FROM player_progress WHERE player_id=?').bind(player.id),
  ]);
  return json({ player, authAvailable: authConfigured(env), rankedRoutes: RANKED_ROUTES, gameVersion: GAME_VERSION,
    stats: stats.results[0] || { best_score: 0, lifetime_earnings: 0, total_runs: 0, completed_runs: 0, total_distance: 0, total_duration_ms: 0, total_passengers: 0, perfect_stops: 0 },
    progress: { preferences: JSON.parse(progress.results[0]?.preferences_json || '{}'), version: progress.results[0]?.version || 0 } });
}
export function validateName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new HttpError(400, 'Use 3–20 letters, numbers or underscores');
  if (/^(admin|administrator|moderator|support|official|google|podapodarun)$/i.test(name) || /fuck|shit|nigger|cunt/i.test(name)) {
    throw new HttpError(400, 'Please choose a different driver name');
  }
  return name.toLowerCase();
}
export async function rename(request, env, player) {
  const { name } = await readJson(request), key = validateName(name), now = Date.now();
  await limit(env, 'name:' + player.id);
  if (player.driver_name === name) return json({ name });
  try {
    const result = await env.DB.prepare(`UPDATE players SET driver_name=?,name_key=?,name_changed_at=?
      WHERE id=? AND (name_changed_at IS NULL OR name_changed_at<=?) RETURNING id`)
      .bind(name, key, now, player.id, now - 7 * 86400000).first();
    if (!result) throw new HttpError(409, 'You can change your driver name once every seven days');
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(error.message)) throw new HttpError(409, 'That driver name is already taken');
    throw error;
  }
  return json({ name });
}
export async function saveProgress(request, env, player) {
  const { preferences, version } = await readJson(request);
  if (!Number.isSafeInteger(version) || version < 0 || !preferences || Array.isArray(preferences) || typeof preferences !== 'object') throw new HttpError(400, 'Invalid progress');
  const clean = {};
  for (const [key, value] of Object.entries(preferences)) {
    if (!PREFERENCE_KEYS.includes(key) || typeof value !== 'string' || value.length > 80 || /[<>\x00-\x1f]/.test(value)) throw new HttpError(400, 'Invalid preference');
    clean[key] = value;
  }
  const row = await env.DB.prepare(`UPDATE player_progress SET preferences_json=?,version=version+1,updated_at=? WHERE player_id=? AND version=? RETURNING version`)
    .bind(JSON.stringify(clean), Date.now(), player.id, version).first();
  if (!row) throw new HttpError(409, 'Cloud preferences changed on another device. Reload your profile before saving');
  return json({ version: row.version });
}
