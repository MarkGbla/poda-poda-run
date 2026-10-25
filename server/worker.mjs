import { runActivity } from './services/Streaks.mjs';
import { HttpError, json, checkOrigin, limit } from './http.mjs';
import { beginLogin, finishLogin } from './auth/google.mjs';
import { getPlayer, requirePlayer, readCookie, cookie, hash } from './auth/session.mjs';
import { profile, rename, saveProgress } from './services/Accounts.mjs';
import { startRun, finishRun } from './services/Runs.mjs';
import { leaderboard } from './services/Leaderboard.mjs';
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (!env.DB || env.ACCOUNTS_ENABLED === 'false') {
        if (path === '/api/me' && request.method === 'GET') return json({ player: null, authAvailable: false, rankedRoutes: [] });
        return json({ error: 'Cloud saves and global rankings are not available yet' }, 503);
      }
      if (env.PUBLIC_ORIGIN && url.origin !== env.PUBLIC_ORIGIN) throw new HttpError(403, 'Use the main game address');
      if (request.method === 'POST' || request.method === 'PATCH') checkOrigin(request, env);
      if (path === '/api/auth/google' && request.method === 'GET') return await beginLogin(request, env);
      if (path === '/api/auth/google/callback' && request.method === 'GET') return await finishLogin(request, env);
      if (path === '/api/me' && request.method === 'GET') return await profile(env, await getPlayer(request, env));
      if (path === '/api/leaderboard' && request.method === 'GET') {
        await limit(env, 'board:' + (request.headers.get('cf-connecting-ip') || 'unknown'));
        return await leaderboard(url, env, await getPlayer(request, env));
      }
      if (path === '/api/auth/logout' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM app_sessions WHERE token_hash=?').bind(await hash(readCookie(request))).run();
        const response = json({ ok: true }); response.headers.append('set-cookie', cookie(request, 'session', '', 0)); return response;
      }
      if (path === '/api/me/name' && request.method === 'POST') return await rename(request, env, await requirePlayer(request, env));
      if (path === '/api/me/progress' && request.method === 'POST') return await saveProgress(request, env, await requirePlayer(request, env));
      if (path === '/api/runs/activity' && request.method === 'POST') return await runActivity(request, env, await requirePlayer(request, env));
      if (path === '/api/runs/start' && request.method === 'POST') return await startRun(request, env, await requirePlayer(request, env));
      if (path === '/api/runs/finish' && request.method === 'POST') return await finishRun(request, env, await requirePlayer(request, env));
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      // Keep bearer credentials, identity claims, request bodies and SQL bind values out of logs.
      console.error('Account API failed', { path, type: error.name });
      return json({ error: 'Cloud service is temporarily unavailable. Your local progress is safe' }, 503);
    }
  },
};
