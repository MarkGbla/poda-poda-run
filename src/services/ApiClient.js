(function (root, factory) {
  const ApiClient = factory();
  if (typeof module === 'object' && module.exports) module.exports = ApiClient;
  if (root) root.PODA_ApiClient = ApiClient;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return class ApiClient {
    constructor(storage, fetchFn, makeId) {
      this.storage = storage; this.fetchFn = fetchFn; this.makeId = makeId;
      this.account = null; this.retrying = false;
    }
    async request(path, body) {
      const response = await this.fetchFn(path, { credentials: 'same-origin', cache: 'no-store',
        signal: AbortSignal.timeout(10000), ...(body === undefined ? {} : {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-poda-request': '1' }, body: JSON.stringify(body),
        }) });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'Cloud service unavailable'); error.status = response.status; throw error; }
      return data;
    }
    async refresh() { this.account = await this.request('/api/me'); return this.account; }
    start({ route, vehicle, gameVersion, practice = false }) {
      const player = this.account?.player;
      if (!player || practice || !this.account.rankedRoutes.includes(route)) return null;
      const handle = { playerId: player.id, requestId: this.makeId() };
      handle.promise = this.request('/api/runs/start', { requestId: handle.requestId, route, vehicle, gameVersion }).catch(() => null);
      return handle;
    }
    pendingKeys(playerId) { return (this.storage.keys?.() || []).filter(k => k.startsWith(`poda-pending:${playerId}:`)); }
    async finish(handle, summary, durationMs) {
      if (!handle) return { status: 'local' };
      const session = await handle.promise;
      if (!session || session.playerId !== handle.playerId) return { status: 'local' };
      const payload = { runId: session.runId, gameVersion: session.gameVersion, summary, durationMs };
      const key = `poda-pending:${handle.playerId}:${session.runId}`;
      const queued = this.pendingKeys(handle.playerId).length < 50 && this.storage.set(key, JSON.stringify({ payload, expiresAt: session.expiresAt }));
      return this.submit(key, payload, queued);
    }
    async submit(key, payload, queued = true) {
      try {
        const result = await this.request('/api/runs/finish', payload);
        this.storage.remove?.(key); return result;
      } catch (error) {
        if ([400,409,410,422].includes(error.status)) {
          this.storage.remove?.(key); return { status: 'rejected', message: error.message };
        }
        return { status: queued ? 'pending' : 'local', message: error.message };
      }
    }
    async retryPending() {
      if (this.retrying || !this.account?.player) return [];
      this.retrying = true; const results = [], playerId = this.account.player.id;
      try {
        for (const key of this.pendingKeys(playerId)) {
          if (this.account?.player?.id !== playerId) break;
          let item;
          try { item = JSON.parse(this.storage.get(key)); } catch { this.storage.remove?.(key); continue; }
          if (!item?.payload) { this.storage.remove?.(key); continue; }
          // Let the server return a receipt for an already-accepted run even after expiry.
          const result = await this.submit(key, item.payload);
          results.push(result);
          if (result.status === 'pending') break;
        }
      } finally { this.retrying = false; }
      return results;
    }
    leaderboard(period) { return this.request(`/api/leaderboard?period=${encodeURIComponent(period)}`); }
    async logout() { await this.request('/api/auth/logout', {}); this.account = null; }
  };
});
