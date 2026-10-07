(function (root, factory) {
  const PlayerSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = PlayerSystem;
  if (root) root.PODA_PlayerSystem = PlayerSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  /** Advance the vehicle model without reading Three.js objects or DOM nodes. */
  function stepPlayer(run, input, dt, state, lanes) {
    run.time += dt;
    const braking = input.brake || input.brakePulse > 0;
    const gas = input.gas && !braking && state === 'play';
    const target = (15 + 18 * clamp(run.dist / 6000, 0, 1)) * (gas ? 1.45 : 1);
    input.brakePulse = Math.max(0, input.brakePulse - dt);
    let dwellFinished = false;
    if (state === 'over' || state === 'complete') run.speed = Math.max(0, run.speed - 14 * dt);
    else if (run.dwell > 0) {
      run.speed = 0;
      run.dwell -= dt;
      dwellFinished = run.dwell <= 0;
    }
    else if (braking) run.speed = Math.max(0, run.speed - 24 * dt);
    else run.speed += clamp(target - run.speed, -3 * dt, (gas ? 11 : 6) * dt);

    const distance = run.speed * dt;
    run.dist += distance;
    run.toStop -= distance;
    run.invuln = Math.max(0, run.invuln - dt);
    run.magnet = Math.max(0, run.magnet - dt);
    run.x += (lanes[run.lane] - run.x) * Math.min(1, dt * 11);
    return { distance, gas, dwellFinished };
  }

  return Object.freeze({ stepPlayer });
});
