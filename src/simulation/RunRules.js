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

  /* ---------- Overshooting a stop ----------
     Driving past a stop used to lose the fare outright, which reads as a bug the
     first time it happens. Instead the stop stays winnable for a short stretch:
     hold the brake in the kerb lane and the poda backs up to it. */
  // At full speed the poda is already ~10 m past a stop before the cue appears and
  // needs ~12 m more to halt, so a 30 m limit expired before reversing could begin.
  const RECOVER_LIMIT = 70;      // metres past the stop centre before it is gone
  const REVERSE_SPEED = 5;       // metres per second, backwards

  function canRecoverStop({ distanceFromCentre, lane, braking }) {
    return distanceFromCentre > 8 && distanceFromCentre <= RECOVER_LIMIT &&
      lane === 2 && !!braking;
  }

  function stopMissed({ distanceFromCentre }) {
    return distanceFromCentre > RECOVER_LIMIT;
  }

  /** Which cue the approach should show. Copy lives in the view; the choice is testable. */
  function stopGuidance({ distanceFromCentre, lane, dwelling, recovering }) {
    if (dwelling) return 'loading';
    if (recovering) return 'reversing';
    if (distanceFromCentre > 8) return 'overshot';
    if (distanceFromCentre < -110) return null;
    if (lane !== 2) return 'keepRight';
    const metres = -distanceFromCentre;
    if (metres > 60) return 'ahead';
    if (metres > 25) return 'ready';
    return 'brake';
  }

  /* ---------- Style multiplier ----------
     Rewards holding speed between stops, and resets on contact, so the run has a
     moment-to-moment stake instead of only an end-of-run total. */
  // Early in a run the gas target sits near 21.8 m/s, so 0.7 of top speed was only
  // reachable after several kilometres and most players would never see a multiplier.
  const FAST_FRACTION = 0.62;    // of the vehicle's top speed
  const STEP_SECONDS = 4;        // held before the multiplier steps up
  const MAX_MULTIPLIER = 2;

  function speedMultiplier(fastSeconds) {
    const steps = Math.floor(Math.max(0, fastSeconds) / STEP_SECONDS) * 0.5;
    return Math.min(MAX_MULTIPLIER, 1 + steps);
  }

  function isFast(speed, maxSpeed) {
    return speed >= (maxSpeed || 34) * FAST_FRACTION;
  }

  /** Style points earned over one step. Distance-based so it is frame-rate independent. */
  function stylePoints(multiplier, distance) {
    return multiplier > 1 ? (multiplier - 1) * distance : 0;
  }

  /* ---------- Damage ----------
     The poda carries a condition of 3. An ordinary knock costs one; a second knock
     inside the shaken window costs two, so repeated carelessness still ends a shift. */
  const CONDITION = 3;
  const SHAKEN_SECONDS = 4;

  function collisionDamage({ condition, time, hitAt }) {
    const cost = time - hitAt < SHAKEN_SECONDS ? 2 : 1;
    const remaining = Math.max(0, (condition == null ? CONDITION : condition) - cost);
    return { cost, remaining, fatal: remaining <= 0 };
  }

  function calculateScore(run) {
    return Math.max(0, Math.round(
      run.dropped * 100 + run.stops * 30 + run.perfectStops * 40 +
      Math.floor(run.dist / 20) + Math.floor(run.style || 0) +
      (run.completed ? 300 : 0) -
      run.missedStops * 25 - run.collisions * 40
    ));
  }

  function summarize(run) {
    const distance = Math.round(run.dist);
    const style = Math.floor(run.style || 0);
    return Object.freeze({
      completed: !!run.completed,
      distance,
      earnings: Math.round(run.cash),
      coins: run.coins,
      style,
      score: calculateScore({ ...run, dist: distance, style }),
      passengersDelivered: run.dropped,
      passengersOnboard: run.pax.length,
      passengersLost: run.lost,
      stopsServed: run.stops,
      stopsMissed: run.missedStops,
      perfectStops: run.perfectStops,
      collisions: run.collisions,
    });
  }

  return Object.freeze({ ROUTE, CAPACITY, CONDITION, RECOVER_LIMIT, REVERSE_SPEED,
    MAX_MULTIPLIER, stopName, isFinalStop,
    nextStopIndex, passengersDue, stopGrade, canServeStop,
    canRecoverStop, stopMissed, stopGuidance,
    speedMultiplier, isFast, stylePoints, collisionDamage,
    calculateScore, summarize });
});
