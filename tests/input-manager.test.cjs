const test = require('node:test');
const assert = require('node:assert/strict');
const InputManager = require('../src/input/InputManager.js');

test('keyboard and touch commands share the same held controls', () => {
  const actions = [];
  const input = new InputManager({
    moveLane: direction => actions.push(direction),
    horn: () => actions.push('horn'),
    pause: () => actions.push('pause'),
    mute: () => actions.push('mute'),
  });
  input.command('ACCELERATE');
  input.command('BRAKE');
  input.command('MOVE_LEFT');
  input.command('HORN');
  assert.equal(input.state.gas, true);
  assert.equal(input.state.brake, true);
  assert.deepEqual(actions, [-1, 'horn']);
  input.release();
  assert.equal(input.state.gas, false);
  assert.equal(input.state.brake, false);
});
