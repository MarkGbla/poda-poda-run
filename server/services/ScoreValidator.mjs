export const GAME_VERSION = '0.1.0';

export function calculateOfficialScore(run) {
  return Math.max(0, Math.round(
    run.passengersDelivered * 100 + run.stopsServed * 30 + run.perfectStops * 40 +
    Math.floor(run.distance / 20) + (run.completed ? 300 : 0) -
    run.stopsMissed * 25 - run.collisions * 40
  ));
}

/** Plausibility checks for submitted aggregates. These do not prove a browser run was genuine. */
export function validateRun(summary, durationMs, serverElapsedMs) {
  if (!summary || typeof summary !== 'object') return 'Missing run summary';
  const integerFields = ['distance', 'earnings', 'coins', 'passengersDelivered',
    'passengersOnboard', 'passengersLost', 'stopsServed', 'stopsMissed',
    'perfectStops', 'collisions'];
  for (const field of integerFields) {
    if (!Number.isSafeInteger(summary[field]) || summary[field] < 0) return `Invalid ${field}`;
  }
  if (typeof summary.completed !== 'boolean') return 'Invalid completion status';
  if (!Number.isSafeInteger(durationMs) || durationMs < 1000 || durationMs > 60 * 60 * 1000) return 'Invalid duration';
  if (durationMs > serverElapsedMs + 15000) return 'Duration does not match session';
  if (summary.distance > durationMs * 0.065 + 100) return 'Distance exceeds plausible speed';
  if (summary.stopsServed + summary.stopsMissed > 12) return 'Too many stops';
  if (summary.completed && summary.stopsServed + summary.stopsMissed !== 12) return 'Incomplete route';
  if (summary.perfectStops > summary.stopsServed) return 'Invalid stop grades';
  if (summary.passengersOnboard > 14 || summary.passengersDelivered > summary.stopsServed * 14) return 'Invalid passenger count';
  if (summary.earnings !== summary.passengersDelivered * 6 + summary.perfectStops * 5) return 'Invalid earnings';
  if (summary.coins > summary.distance / 2 + 20) return 'Invalid coin count';
  return null;
}
