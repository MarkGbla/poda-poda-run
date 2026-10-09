const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/simulation/RunRules.js');
const { stepPlayer } = require('../src/simulation/systems/PlayerSystem.js');

/* ---------- Overshooting a stop ---------- */

test('a stop stays winnable for a stretch after the poda passes it', () => {
  const braking = { lane: 2, braking: true };
  // Still inside the serve window, so recovery does not apply yet.
  assert.equal(rules.canRecoverStop({ distanceFromCentre: 6, ...braking }), false);
  // Past the window but inside the recovery stretch.
  assert.equal(rules.canRecoverStop({ distanceFromCentre: 12, ...braking }), true);
  assert.equal(rules.canRecoverStop({ distanceFromCentre: rules.RECOVER_LIMIT, ...braking }), true);
  // Beyond it, the stop is gone.
  assert.equal(rules.canRecoverStop({ distanceFromCentre: rules.RECOVER_LIMIT + 1, ...braking }), false);
});

test('recovery needs the brake held in the kerb lane', () => {
  assert.equal(rules.canRecoverStop({ distanceFromCentre: 15, lane: 2, braking: false }), false);
  assert.equal(rules.canRecoverStop({ distanceFromCentre: 15, lane: 1, braking: true }), false);
  assert.equal(rules.canRecoverStop({ distanceFromCentre: 15, lane: 2, braking: true }), true);
});

test('a stop is only missed once it is past the recovery limit', () => {
  assert.equal(rules.stopMissed({ distanceFromCentre: 9 }), false);
  assert.equal(rules.stopMissed({ distanceFromCentre: rules.RECOVER_LIMIT }), false);
  assert.equal(rules.stopMissed({ distanceFromCentre: rules.RECOVER_LIMIT + 0.1 }), true);
});

test('braking in reverse rolls the poda backwards, but only while recovering', () => {
  const vehicle = { acceleration: 6, braking: 24, maxSpeed: 34, handling: 11 };
  const base = () => ({
    vehicle, speed: 2, dist: 100, toStop: 10, x: 0, lane: 2, time: 0,
    invuln: 0, magnet: 0, dwell: 0, reverseSpeed: 3,
  });
  const input = { brake: true, gas: false, brakePulse: 0 };

  const plain = base();
  for (let i = 0; i < 30; i++) stepPlayer(plain, { ...input }, 1 / 60, 'play', [-3.4, 0, 3.4]);
  assert.equal(plain.speed, 0, 'without recovery the poda stops dead');

  const backing = { ...base(), reversing: true };
  for (let i = 0; i < 30; i++) stepPlayer(backing, { ...input }, 1 / 60, 'play', [-3.4, 0, 3.4]);
  assert.ok(backing.speed < 0, 'while recovering the poda rolls backwards');
  assert.ok(backing.speed >= -3, 'reverse is capped at a walking pace');
});

test('reversing never winds the odometer back', () => {
  const run = {
    vehicle: { acceleration: 6, braking: 24, maxSpeed: 34, handling: 11 },
    speed: -3, dist: 500, toStop: 10, x: 0, lane: 2, time: 0,
    invuln: 0, magnet: 0, dwell: 0, reversing: true, reverseSpeed: 3,
  };
  const before = run.dist;
  stepPlayer(run, { brake: true, gas: false, brakePulse: 0 }, 1 / 60, 'play', [-3.4, 0, 3.4]);
  assert.equal(run.dist, before, 'distance cannot be farmed by shuttling backwards');
});

/* ---------- Approach guidance ---------- */

test('approach guidance escalates as the stop gets closer', () => {
  const at = (distanceFromCentre, extra = {}) =>
    rules.stopGuidance({ distanceFromCentre, lane: 2, dwelling: false, recovering: false, ...extra });

  assert.equal(at(-200), null, 'nothing is shown while the stop is far off');
  assert.equal(at(-90), 'ahead');
  assert.equal(at(-40), 'ready');
  assert.equal(at(-10), 'brake');
  assert.equal(at(0), 'brake');
  assert.equal(at(20), 'overshot');
  assert.equal(at(-40, { lane: 0 }), 'keepRight', 'wrong lane is called out first');
  assert.equal(at(20, { recovering: true }), 'reversing');
  assert.equal(at(-40, { dwelling: true }), 'loading', 'loading outranks every approach cue');
});

/* ---------- Style multiplier ---------- */

test('the multiplier steps up with sustained speed and is capped', () => {
  assert.equal(rules.speedMultiplier(0), 1);
  assert.equal(rules.speedMultiplier(3.9), 1);
  assert.equal(rules.speedMultiplier(4), 1.5);
  assert.equal(rules.speedMultiplier(8), 2);
  assert.equal(rules.speedMultiplier(600), rules.MAX_MULTIPLIER, 'it cannot run away');
});

test('style only accrues above the base multiplier, and tracks distance not frames', () => {
  assert.equal(rules.stylePoints(1, 100), 0);
  assert.equal(rules.stylePoints(1.5, 100), 50);
  assert.equal(rules.stylePoints(2, 100), 100);
  // Same distance covered in two steps earns the same as one.
  assert.equal(rules.stylePoints(2, 40) + rules.stylePoints(2, 60), rules.stylePoints(2, 100));
});

test('isFast measures against the chosen vehicle, not a fixed speed', () => {
  assert.equal(rules.isFast(20, 34), false);
  assert.equal(rules.isFast(25, 34), true);
  assert.equal(rules.isFast(20, 25), true, 'a slower vehicle reaches its own fast band sooner');
});

/* ---------- Damage ---------- */

test('an ordinary knock costs one condition, a knock while shaken costs two', () => {
  const settled = rules.collisionDamage({ condition: 3, time: 20, hitAt: 5 });
  assert.deepEqual([settled.cost, settled.remaining, settled.fatal], [1, 2, false]);

  const shaken = rules.collisionDamage({ condition: 3, time: 20, hitAt: 18 });
  assert.deepEqual([shaken.cost, shaken.remaining, shaken.fatal], [2, 1, false]);
});

test('a run survives three spaced knocks but not two careless ones at low condition', () => {
  let condition = rules.CONDITION;
  for (const time of [10, 20, 30]) {
    const step = rules.collisionDamage({ condition, time, hitAt: time - 10 });
    condition = step.remaining;
    if (time < 30) assert.equal(step.fatal, false);
    else assert.equal(step.fatal, true, 'the third spaced knock ends the shift');
  }

  const careless = rules.collisionDamage({ condition: 2, time: 10, hitAt: 9 });
  assert.equal(careless.fatal, true, 'two knocks in quick succession at low condition end it');
});

/* ---------- Scoring ---------- */

test('style feeds the score and summarize reports it', () => {
  const run = {
    dropped: 2, stops: 3, perfectStops: 1, dist: 1000, style: 250, completed: false,
    missedStops: 0, collisions: 0, cash: 17, coins: 4, pax: [1], lost: 0,
  };
  const withoutStyle = rules.calculateScore({ ...run, style: 0 });
  assert.equal(rules.calculateScore(run), withoutStyle + 250);

  const summary = rules.summarize(run);
  assert.equal(summary.style, 250);
  assert.equal(summary.score, rules.calculateScore(run));
});

test('a run from before the multiplier existed still scores', () => {
  const legacy = {
    dropped: 1, stops: 1, perfectStops: 0, dist: 200, completed: false,
    missedStops: 0, collisions: 0, cash: 6, coins: 0, pax: [], lost: 0,
  };
  assert.equal(rules.summarize(legacy).style, 0);
  assert.ok(Number.isFinite(rules.calculateScore(legacy)));
});
