(function (root, factory) {
  const GameClock = factory();
  if (typeof module === 'object' && module.exports) module.exports = GameClock;
  if (root) root.PODA_GameClock = GameClock;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  return class GameClock {
    constructor(maxDelta = 0.05) { this.last = null; this.maxDelta = maxDelta; }
    reset() { this.last = null; }
    tick(now) {
      if (this.last === null) { this.last = now; return { raw: 0, dt: 0 }; }
      const raw = Math.max(0, (now - this.last) / 1000);
      this.last = now;
      return { raw, dt: Math.min(this.maxDelta, raw) };
    }
  };
});
