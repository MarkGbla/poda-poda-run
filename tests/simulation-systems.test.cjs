const test = require('node:test');
const assert = require('node:assert/strict');
const { stepPlayer } = require('../src/simulation/systems/PlayerSystem.js');
const { stepTraffic } = require('../src/simulation/systems/TrafficSystem.js');
const { overlapsPlayer } = require('../src/simulation/systems/CollisionSystem.js');

function player() {
  return { time: 0, dist: 0, speed: 12, toStop: 260, lane: 2, x: 3.4,
    dwell: 0, invuln: 0, magnet: 0 };
}

test('player distance and speed are stable across common frame steps', () => {
  function drive(dt, steps) {
    const run = player();
    const input = { brake: false, brakePulse: 0, gas: false };
    for (let i = 0; i < steps; i++) stepPlayer(run, input, dt, 'play', [-3.4, 0, 3.4]);
    return run;
  }
  const at30 = drive(1 / 30, 30);
  const at60 = drive(1 / 60, 60);
  assert.ok(Math.abs(at30.dist - at60.dist) < 0.2);
  assert.ok(Math.abs(at30.speed - at60.speed) < 0.01);
});

test('dwell completes once and an over run does not complete pending dwell', () => {
  const run = { ...player(), dwell: 0.02 };
  const input = { brake: false, brakePulse: 0, gas: false };
  assert.equal(stepPlayer(run, input, 0.03, 'play', [-3.4, 0, 3.4]).dwellFinished, true);
  assert.equal(stepPlayer(run, input, 0.03, 'play', [-3.4, 0, 3.4]).dwellFinished, false);
  run.dwell = 0.02;
  assert.equal(stepPlayer(run, input, 0.03, 'over', [-3.4, 0, 3.4]).dwellFinished, false);
});

test('traffic movement and collision are pure of rendered meshes', () => {
  const obstacle = { x: 3.4, z: -6, lane: 2, speed: 5, wid: 1.9, len: 4.2 };
  assert.equal(stepTraffic(obstacle, 1, 0.1, [-3.4, 0, 3.4]), false);
  assert.equal(obstacle.z, -5.5);
  const run = { x: 3.4, speed: 12 };
  obstacle.z = 0;
  assert.equal(overlapsPlayer(run, obstacle), true);
  obstacle.x = -3.4;
  assert.equal(overlapsPlayer(run, obstacle), false);
});
