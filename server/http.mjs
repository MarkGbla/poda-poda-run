export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});
export async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Expected JSON');
  // Bound bytes while reading, before allocating an unbounded request body.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing JSON');
  let size = 0, text = ''; const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
    text += decoder.decode(value, { stream: true });
  }
  try {
    const data = JSON.parse(text + decoder.decode());
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Invalid JSON'); }
}
export function checkOrigin(request, env) {
  const expected = env.PUBLIC_ORIGIN || new URL(request.url).origin;
  if (request.headers.get('origin') !== expected || request.headers.get('x-poda-request') !== '1') {
    throw new HttpError(403, 'Request origin rejected');
  }
}
export async function limit(env, key) {
  if (env.RUN_RATE_LIMITER && !(await env.RUN_RATE_LIMITER.limit({ key })).success) {
    throw new HttpError(429, 'Please wait before trying again');
  }
}
