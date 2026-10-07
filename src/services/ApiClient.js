(function (root, factory) {
  const ApiClient = factory();
  if (typeof module === 'object' && module.exports) module.exports = ApiClient;
  if (root) root.PODA_ApiClient = ApiClient;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return class ApiClient {
    constructor(storage, fetchFn, makeId) {
      this.storage = storage;
      this.fetchFn = fetchFn;
      this.makeId = makeId;
      this.sessionPromise = null;
      this.playerId = storage.get('poda-player-id') || makeId();
      storage.set('poda-player-id', this.playerId);
    }
    async post(path, payload) {
      const response = await this.fetchFn(path, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      return response.json();
    }
    start() {
      this.sessionPromise = this.post('/api/runs/start', { playerId: this.playerId }).catch(() => null);
      return this.sessionPromise;
    }
    async finish(summary, durationMs) {
      const sessionPromise = this.sessionPromise;
      const session = await sessionPromise;
      if (!session) return null;
      try {
        return await this.post('/api/runs/finish', {
          runId: session.runId, token: session.token, gameVersion: session.gameVersion,
          summary, durationMs,
        });
      } catch { return null; }
    }
    async leaderboard(period) {
      const response = await this.fetchFn(`/api/leaderboard?period=${encodeURIComponent(period)}`);
      if (!response.ok) throw new Error('Leaderboard unavailable');
      return (await response.json()).entries || [];
    }
  };
});
