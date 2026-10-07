(function (root, factory) {
  const TrafficSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = TrafficSystem;
  if (root) root.PODA_TrafficSystem = TrafficSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  /** Move traffic data. Drawing and animation remain in the rendering layer. */
  function stepTraffic(vehicle, roadDistance, dt, lanes, random = Math.random) {
    vehicle.z += roadDistance - vehicle.speed * dt;
    if (vehicle.cross) vehicle.x += vehicle.vx * dt;
    if (vehicle.weave && random() < 1 - Math.exp(-0.24 * dt)) {
      const direction = random() < 0.5 ? -1 : 1;
      vehicle.lane = clamp(vehicle.lane + direction, 0, lanes.length - 1);
    }
    if (vehicle.weave) vehicle.x += (lanes[vehicle.lane] - vehicle.x) * Math.min(1, dt * 2);
    return vehicle.z > 25 || vehicle.z < -260 || Math.abs(vehicle.x) > 12;
  }

  return Object.freeze({ stepTraffic });
});
