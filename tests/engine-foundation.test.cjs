const test = require('node:test');
const assert = require('node:assert/strict');
const GameStateMachine = require('../src/engine/GameStateMachine.js');
const GameClock = require('../src/engine/GameClock.js');
const EventBus = require('../src/engine/EventBus.js');

test('game state accepts pause, resume and result transitions', () => {
  const machine = new GameStateMachine();
  assert.equal(machine.transition('play'), 'play');
  assert.equal(machine.transition('paused'), 'paused');
  assert.equal(machine.transition('play'), 'play');
  assert.equal(machine.transition('over'), 'over');
  assert.throws(() => machine.transition('paused'), /Invalid game state transition/);
  assert.equal(machine.transition('play'), 'play');
  assert.equal(machine.transition('complete'), 'complete');
  assert.throws(() => machine.transition('paused'), /Invalid game state transition/);
  assert.equal(machine.transition('garage'), 'garage');
  assert.equal(machine.transition('complete'), 'complete');
  assert.equal(machine.transition('play'), 'play');
});

test('clock caps tab suspension and resets on resume', () => {
  const clock = new GameClock();
  assert.deepEqual(clock.tick(1000), { raw: 0, dt: 0 });
  assert.equal(clock.tick(1016).dt, 0.016);
  assert.equal(clock.tick(5016).dt, 0.05);
  clock.reset();
  assert.equal(clock.tick(9000).dt, 0);
});

test('event listeners can unsubscribe', () => {
  const bus = new EventBus();
  let total = 0;
  const off = bus.on('stop:served', ({ passengersDropped }) => { total += passengersDropped; });
  bus.emit('stop:served', { passengersDropped: 2 });
  off();
  bus.emit('stop:served', { passengersDropped: 2 });
  assert.equal(total, 2);
});

test('finished and abandoned runs can return home and start a fresh run', () => {
  for (const outcome of ['over', 'complete']) {
    const machine = new GameStateMachine();
    machine.transition('play');
    if (outcome === 'over') machine.transition('paused');
    machine.transition(outcome);
    assert.equal(machine.transition('attract'), 'attract');
    assert.equal(machine.transition('play'), 'play');
    assert.equal(machine.transition('paused'), 'paused');
  }
});
