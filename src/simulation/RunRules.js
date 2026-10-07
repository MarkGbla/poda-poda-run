/* Pure run rules. The small browser adapter preserves the existing classic-script build
   while the game migrates to ES modules. This file can also be required by Node tests. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  if (root) root.PODA_RUN_RULES = rules;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const ROUTE = Object.freeze([
    'Goderich', 'Lumley', 'Lumley Beach Road', 'Chapter One', 'Aberdeen',
    'Wilberforce', 'IMATT', 'Congo Cross', 'Cotton Tree', 'PZ',
    'Abacha Street', 'Eastern Police', 'FBC',
  ]);
  const CAPACITY = 14;

  function stopName(index) {
    return ROUTE[index] || null;
  }

  function isFinalStop(index) {
    return index === ROUTE.length - 1;
  }

  function nextStopIndex(index) {
    return isFinalStop(index) ? null : index + 1;
  }

  function passengersDue(destinations) {
    return destinations.filter(destination => destination === 0).length;
  }

  function stopGrade(distanceFromCentre) {
    return Math.abs(distanceFromCentre) < 3 ? 'perfect' : 'served';
  }

  function canServeStop({ distanceFromCentre, lane, laneX, playerX, speed }) {
    return Math.abs(distanceFromCentre) < 8 && lane === 2 &&
      Math.abs(playerX - laneX) < 0.5 && speed < 3.5;
  }

  function calculateScore(run) {
    return Math.max(0, Math.round(
      run.dropped * 100 + run.stops * 30 + run.perfectStops * 40 +
      Math.floor(run.dist / 20) + (run.completed ? 300 : 0) -
      run.missedStops * 25 - run.collisions * 40
    ));
  }

  function summarize(run) {
    const distance = Math.round(run.dist);
    return Object.freeze({
      completed: !!run.completed,
      distance,
      earnings: Math.round(run.cash),
      coins: run.coins,
      score: calculateScore({ ...run, dist: distance }),
      passengersDelivered: run.dropped,
      passengersOnboard: run.pax.length,
      passengersLost: run.lost,
      stopsServed: run.stops,
      stopsMissed: run.missedStops,
      perfectStops: run.perfectStops,
      collisions: run.collisions,
    });
  }

  return Object.freeze({ ROUTE, CAPACITY, stopName, isFinalStop,
    nextStopIndex, passengersDue, stopGrade, canServeStop,
    calculateScore, summarize });
});
