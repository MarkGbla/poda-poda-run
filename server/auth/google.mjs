import * as oauth from 'oauth4webapi';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { cookie, readCookie, randomToken, hash, createSession } from './session.mjs';
import { HttpError, limit } from '../http.mjs';
const google = { issuer: 'https://accounts.google.com', authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token' };
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function authConfigured(env) { return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.PUBLIC_ORIGIN); }
function callback(env) { return new URL('/api/auth/google/callback', env.PUBLIC_ORIGIN).href; }
function redirect(url, cookies = []) {
  const headers = new Headers({ location: url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
  for (const value of cookies) headers.append('set-cookie', value);
  return new Response(null, { status: 303, headers });
}
export async function beginLogin(request, env) {
  if (!authConfigured(env)) throw new HttpError(503, 'Google sign-in is not configured yet');
  await limit(env, 'login:' + (request.headers.get('cf-connecting-ip') || 'unknown'));
  const state = oauth.generateRandomState(), verifier = oauth.generateRandomCodeVerifier();
  const nonce = oauth.generateRandomNonce(), browser = randomToken(), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_attempts WHERE expires_at<=?').bind(now),
    env.DB.prepare('INSERT INTO oauth_attempts VALUES (?, ?, ?, ?, ?)')
      .bind(await hash(state), await hash(browser), verifier, nonce, now + 600000),
  ]);
  const url = new URL(google.authorization_endpoint);
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callback(env),
    response_type: 'code', scope: 'openid email profile', state, nonce,
    code_challenge: await oauth.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256' }).toString();
  return redirect(url.href, [cookie(request, 'oauth', browser, 600)]);
}
export async function verifyGoogleIdentity(token, clientId, nonce, key = keys) {
  const { payload } = await jwtVerify(token, key, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId,
    algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'nonce'], clockTolerance: 5,
  });
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub ||
      (payload.azp && payload.azp !== clientId)) throw new Error('Invalid identity claims');
  return payload.sub;
}
export async function finishLogin(request, env) {
  const clear = cookie(request, 'oauth', '', 0);
  try {
    if (!authConfigured(env)) throw new Error('Unconfigured');
    const url = new URL(request.url), state = url.searchParams.get('state'), browser = readCookie(request, 'oauth');
    if (!state || state.length > 256 || !/^[a-f0-9]{64}$/.test(browser)) throw new Error('Missing attempt');
    // Delete and return in one statement: callbacks cannot consume an attempt twice.
    const attempt = await env.DB.prepare(`DELETE FROM oauth_attempts WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING verifier, nonce`)
      .bind(await hash(state), await hash(browser), Date.now()).first();
    if (!attempt) throw new Error('Invalid attempt');
    const client = { client_id: env.GOOGLE_CLIENT_ID, id_token_signed_response_alg: 'RS256' };
    const parameters = oauth.validateAuthResponse(google, client, url, state);
    const response = await oauth.authorizationCodeGrantRequest(google, client, oauth.ClientSecretPost(env.GOOGLE_CLIENT_SECRET),
      parameters, callback(env), attempt.verifier, { signal: AbortSignal.timeout(10000) });
    const tokens = await oauth.processAuthorizationCodeResponse(google, client, response, { expectedNonce: attempt.nonce, requireIdToken: true });
    const subject = await verifyGoogleIdentity(tokens.id_token, env.GOOGLE_CLIENT_ID, attempt.nonce);
    const now = Date.now();
    const player = await env.DB.prepare(`INSERT INTO players (id,google_sub,created_at,last_login_at) VALUES (?,?,?,?)
      ON CONFLICT(google_sub) DO UPDATE SET last_login_at=excluded.last_login_at RETURNING id`)
      .bind(crypto.randomUUID(), subject, now, now).first();
    await env.DB.prepare('INSERT OR IGNORE INTO player_progress (player_id,updated_at) VALUES (?,?)').bind(player.id, now).run();
    // Google tokens and personal name/email are deliberately not persisted.
    return redirect('/?account=signed-in', [clear, await createSession(request, env, player.id)]);
  } catch {
    // Do not log the callback URL, authorization code, Google tokens, or private claims.
    return redirect('/?account=error', [clear]);
  }
}
