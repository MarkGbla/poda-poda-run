import { HttpError, json } from '../http.mjs';
export function startOfPeriod(period, now) {
  if (period === 'all' || period === 'earners') return 0;
  const day = new Date(now); day.setUTCHours(0, 0, 0, 0);
  if (period === 'week') day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.getTime();
}
export async function leaderboard(url, env, player) {
  const period = url.searchParams.get('period') || 'today';
  if (!['today', 'week', 'all', 'earners'].includes(period)) throw new HttpError(400, 'Invalid leaderboard period');
  const now = Date.now(), startsAt = startOfPeriod(period, now);
  const periodic = period === 'today' || period === 'week';
  const source = periodic ? 'period_bests b' : 'player_stats b';
  const value = periodic ? 'score' : period === 'all' ? 'best_score' : 'lifetime_earnings';
  const time = periodic ? 'achieved_at' : period === 'all' ? 'best_at' : 'earnings_at';
  const where = periodic ? 'b.period=? AND b.starts_at=?' : 'b.total_runs>0';
  const args = periodic ? [period, startsAt] : [];
  const base = `FROM ${source} JOIN players p ON p.id=b.player_id WHERE p.driver_name IS NOT NULL AND ${where}`;
  // Both queries use the same order and execute within a single D1 snapshot batch.
  const queries = [env.DB.prepare(`SELECT b.player_id AS playerId, p.driver_name AS name, b.${value} AS value
    ${base} ORDER BY b.${value} DESC, b.${time}, b.player_id LIMIT 50`).bind(...args)];
  if (player) {
    queries.push(env.DB.prepare(`SELECT b.player_id AS playerId,p.driver_name AS name,b.${value} AS value,
      1 + (SELECT COUNT(*) FROM ${source.replace(' b',' ahead')} JOIN players ap ON ap.id=ahead.player_id
        WHERE ap.driver_name IS NOT NULL AND ${periodic ? 'ahead.period=b.period AND ahead.starts_at=b.starts_at' : 'ahead.total_runs>0'}
        AND (ahead.${value}>b.${value} OR (ahead.${value}=b.${value} AND
          (ahead.${time}<b.${time} OR (ahead.${time}=b.${time} AND ahead.player_id<b.player_id))))) AS rank
      ${base} AND b.player_id=?`).bind(...args, player.id));
  }
  const result = await env.DB.batch(queries);
  return json({ period, startsAt, endsAt: periodic ? startsAt + (period === 'today' ? 1 : 7) * 86400000 : null,
    asOf: now, entries: result[0].results.map((row, i) => ({ ...row, rank: i + 1 })),
    me: player ? result[1].results[0] || null : null });
}
