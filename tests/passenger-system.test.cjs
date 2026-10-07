const test = require('node:test');
const assert = require('node:assert/strict');
const passengers = require('../src/simulation/systems/PassengerSystem.js');

test('boarding respects capacity and the final stop', () => {
  const initial = [0, 0, ...Array(10).fill(2)];
  const plan = passengers.planStop(initial, 7, 3, 12, 14);
  assert.equal(plan.dropN, 2);
  assert.equal(plan.board, 4);
  const boarded = passengers.boardPassengers(plan.remaining, plan.board, 3, 12, () => 1);
  assert.equal(boarded.length, 14);
  assert.equal(passengers.advanceDestinations(boarded).at(-1), 0);
  assert.equal(passengers.planStop([0, 1], 6, 12, 12, 14).board, 0);
});

test('missed passengers are lost and other destinations remain', () => {
  const result = passengers.missStop([0, 1, 0, 3]);
  assert.deepEqual(result, { lost: 2, remaining: [1, 3] });
});
