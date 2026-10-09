(function (root, factory) {
  const PlayerSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = PlayerSystem;
  if (root) root.PODA_PlayerSystem = PlayerSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  /** Advance the vehicle model without reading Three.js objects or DOM nodes. */
  function stepPlayer(run, input, dt, state, lanes) {
    const vehicle = run.vehicle || {acceleration:6,braking:24,maxSpeed:48,handling:11};
    run.time += dt;
    const braking = input.brake || input.brakePulse > 0;
    const gas = input.gas && !braking && state === 'play';
    const target = Math.min(vehicle.maxSpeed, (15 + 18 * clamp(run.dist / 6000, 0, 1)) * (gas ? 1.45 : 1));
    input.brakePulse = Math.max(0, input.brakePulse - dt);
    let dwellFinished = false;
    if (state === 'over' || state === 'complete') run.speed = Math.max(0, run.speed - 14 * dt);
    else if (run.dwell > 0) {
      run.speed = 0;
      run.dwell -= dt;
      dwellFinished = run.dwell <= 0;
    }
    // Backing up to a stop the player overshot: braking rolls the poda backwards
    // instead of stopping dead, down to a slow walking reverse.
    else if (braking && run.reversing) run.speed = Math.max(-(run.reverseSpeed || 3), run.speed - vehicle.braking * dt);
    else if (braking) run.speed = Math.max(0, run.speed - vehicle.braking * dt);
    else if (run.speed < 0) run.speed = Math.min(0, run.speed + vehicle.braking * dt);
    else run.speed += clamp(target - run.speed, -3 * dt, vehicle.acceleration * (gas ? 1.8 : 1) * dt);

    const distance = run.speed * dt;
    // Odometer only ever counts forward, so reversing cannot farm distance score.
    run.dist += Math.max(0, distance);
    run.toStop -= distance;
    run.invuln = Math.max(0, run.invuln - dt);
    run.magnet = Math.max(0, run.magnet - dt);
    run.x += (lanes[run.lane] - run.x) * Math.min(1, dt * vehicle.handling);
    return { distance, gas, dwellFinished };
  }

  return Object.freeze({ stepPlayer });
});
