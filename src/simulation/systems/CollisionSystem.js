(function (root, factory) {
  const CollisionSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = CollisionSystem;
  if (root) root.PODA_CollisionSystem = CollisionSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  /** Preserve the prototype's rectangle collision bounds. */
  function overlapsPlayer(run, obstacle) {
    if (obstacle.jumpable && (run.jumpY || 0) > .55) return false;
    if (obstacle.cross && run.speed < 2) return false;
    return Math.abs(obstacle.z) < (obstacle.len + (run.vehicle?.length || 5.2)) / 2 - 0.3 &&
      Math.abs(obstacle.x - run.x) < (obstacle.wid + (run.vehicle?.width || 2.1)) / 2 - 0.3;
  }
  return Object.freeze({ overlapsPlayer });
});
