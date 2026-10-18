import { HttpError } from '../http.mjs';
const SESSION_AGE = 30 * 24 * 60 * 60;
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
}
export async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
export function cookieName(request, kind = 'session') {
  return `${new URL(request.url).protocol === 'https:' ? '__Host-' : ''}poda-${kind}`;
}
export function cookie(request, kind, value, maxAge) {
  return `${cookieName(request, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export function readCookie(request, kind = 'session') {
  const prefix = cookieName(request, kind) + '=';
  return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(prefix))?.slice(prefix.length) || '';
}
export async function getPlayer(request, env) {
  const token = readCookie(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare(`SELECT p.id, p.driver_name, p.name_changed_at FROM app_sessions s
    JOIN players p ON p.id=s.player_id WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(await hash(token), Date.now()).first();
}
export async function requirePlayer(request, env) {
  const player = await getPlayer(request, env);
  if (!player) throw new HttpError(401, 'Sign in to save this run');
  return player;
}
export async function createSession(request, env, playerId) {
  const token = randomToken(), now = Date.now();
  // Rotate this browser's previous session, including when switching accounts.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM app_sessions WHERE token_hash=? OR expires_at<=?').bind(await hash(readCookie(request)), now),
    env.DB.prepare('INSERT INTO app_sessions VALUES (?, ?, ?, ?)').bind(await hash(token), playerId, now, now + SESSION_AGE * 1000),
  ]);
  return cookie(request, 'session', token, SESSION_AGE);
}
