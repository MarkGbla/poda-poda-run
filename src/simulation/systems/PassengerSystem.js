(function (root, factory) {
  const PassengerSystem = factory();
  if (typeof module === 'object' && module.exports) module.exports = PassengerSystem;
  if (root) root.PODA_PassengerSystem = PassengerSystem;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** Destinations are stops remaining relative to the next stop. */
  function planStop(destinations, waitingCount, stopIndex, finalIndex, capacity) {
    const dropN = destinations.filter(destination => destination === 0).length;
    const remaining = destinations.filter(destination => destination !== 0);
    const board = stopIndex === finalIndex ? 0 : Math.min(capacity - remaining.length, waitingCount);
    return { dropN, board, remaining };
  }

  function boardPassengers(destinations, count, stopIndex, finalIndex, randomInt) {
    const remainingStops = finalIndex - stopIndex;
    if (remainingStops <= 0 && count > 0) throw new Error('Cannot board passengers at final stop');
    const next = destinations.slice();
    for (let i = 0; i < count; i++) next.push(randomInt(1, Math.min(4, remainingStops)));
    return next;
  }

  function missStop(destinations) {
    return {
      lost: destinations.filter(destination => destination === 0).length,
      remaining: destinations.filter(destination => destination !== 0),
    };
  }

  function advanceDestinations(destinations) {
    return destinations.map(destination => destination - 1);
  }

  return Object.freeze({ planStop, boardPassengers, missStop, advanceDestinations });
});
