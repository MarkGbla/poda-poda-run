(function (root, factory) {
  const CollisionSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = CollisionSystem;
  if (root) root.PODA_CollisionSystem = CollisionSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  /** The playable footprint is slightly inside each vehicle's listed dimensions. */
  function overlapsPlayer(run, obstacle) {
    if (obstacle.jumpable && (run.jumpY || 0) > .55) return false;
    if (obstacle.cross && run.speed < 2) return false;
    return Math.abs(obstacle.z) < (obstacle.len + (run.vehicle?.length || 5.2)) / 2 - 0.3 &&
      Math.abs(obstacle.x - run.x) < (obstacle.wid + (run.vehicle?.width || 2.1)) / 2 - 0.3;
  }
  /** Intersect the relative movement segment with the two-dimensional collider. */
  function sweepsPlayer(run, obstacle, previousPlayerX, previousObstacleX, previousObstacleZ) {
    if (obstacle.jumpable && (run.jumpY || 0) > .55) return false;
    if (obstacle.cross && run.speed < 2) return false;
    const halfX=(obstacle.wid+(run.vehicle?.width||2.1))/2-.3;
    const halfZ=(obstacle.len+(run.vehicle?.length||5.2))/2-.3;
    const x0=previousObstacleX-previousPlayerX, x1=obstacle.x-run.x;
    const z0=previousObstacleZ, z1=obstacle.z;
    let enter=0, leave=1;
    for(const [start,end,extent] of [[x0,x1,halfX],[z0,z1,halfZ]]){
      const delta=end-start;
      if(Math.abs(delta)<1e-9){if(Math.abs(start)>=extent)return false;continue;}
      const a=(-extent-start)/delta, b=(extent-start)/delta;
      enter=Math.max(enter,Math.min(a,b));
      leave=Math.min(leave,Math.max(a,b));
      if(enter>=leave)return false;
    }
    return true;
  }
  return Object.freeze({ overlapsPlayer, sweepsPlayer });
});
