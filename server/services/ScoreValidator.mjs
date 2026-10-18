import rules from '../../src/simulation/RunRules.js';
import config from '../../src/data/GameConfig.js';
export const GAME_VERSION = rules.GAME_VERSION;
export const RANKED_ROUTES = ['western', 'eastern', 'crosscity'];
export const RUN_TTL = 2 * 60 * 60 * 1000;
export function calculateOfficialScore(run) {
  return rules.calculateScore({ dropped: run.passengersDelivered, stops: run.stopsServed,
    perfectStops: run.perfectStops, dist: run.distance, style: run.style,
    completed: run.completed, missedStops: run.stopsMissed, collisions: run.collisions });
}
export function eligible(route, vehicle) {
  return RANKED_ROUTES.includes(route) && Object.hasOwn(config.vehicles, vehicle);
}
/** Aggregate plausibility, not proof of human play. Bounds follow the arcade rules.
 * Central's mapped stop distances need a separate contract before it is ranked. */
export function validateRun(summary, durationMs, serverElapsedMs, routeId, vehicleId) {
  if (!eligible(routeId, vehicleId)) return 'This route is currently local only';
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return 'Missing run summary';
  for (const field of ['distance', 'earnings', 'coins', 'passengersDelivered', 'passengersOnboard',
    'passengersLost', 'stopsServed', 'stopsMissed', 'perfectStops', 'collisions', 'style']) {
    if (!Number.isSafeInteger(summary[field]) || summary[field] < 0) return `Invalid ${field}`;
  }
  const vehicle = config.vehicles[vehicleId], stopCount = config.routes[routeId].stops.length - 1;
  if (typeof summary.completed !== 'boolean') return 'Invalid completion status';
  if (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > RUN_TTL) return 'Invalid duration';
  // Start is asynchronous. Only a small bounded request-transit tolerance is allowed.
  if (durationMs > serverElapsedMs + 5000) return 'Duration does not match session';
  if (summary.distance > vehicle.maxSpeed * durationMs / 1000 + 2) return 'Distance exceeds plausible speed';
  const visited = summary.stopsServed + summary.stopsMissed;
  if (visited > stopCount) return 'Too many stops';
  if (summary.completed !== (visited === stopCount)) return 'Incomplete route';
  if (summary.perfectStops > summary.stopsServed) return 'Invalid stop grades';
  if (summary.collisions > rules.CONDITION || (summary.completed && summary.collisions >= rules.CONDITION)) return 'Invalid collisions';
  // First stop is 260m ahead, subsequent legs are 420–560m. A stop can be
  // served within 8m or missed after 70m. Repeated recovery attempts can add
  // distance, so only the speed/time bound is an upper limit.
  const minDistance = visited ? 260 + (visited - 1) * 412 - 8 : 0;
  if (summary.distance < minDistance) return 'Distance does not match route';
  const initial = vehicleId === 'okada' ? 0 : Math.ceil(vehicle.capacity / 2);
  const maxBoard = Math.min(vehicle.capacity, vehicle.capacity === 30 ? 15 : 7);
  const supply = initial + Math.min(summary.stopsServed, stopCount - 1) * maxBoard;
  if (summary.passengersOnboard > vehicle.capacity || summary.passengersDelivered > summary.stopsServed * vehicle.capacity ||
      summary.passengersDelivered + summary.passengersOnboard + summary.passengersLost > supply ||
      (summary.completed && summary.passengersOnboard !== 0)) return 'Invalid passenger count';
  if (summary.earnings !== summary.passengersDelivered * rules.FARE + summary.perfectStops * rules.PERFECT_FARE) return 'Invalid earnings';
  if (summary.coins > summary.distance / 2 + 20) return 'Invalid coin count';
  if (summary.style > summary.distance + 1) return 'Invalid style score';
  if (summary.score !== calculateOfficialScore(summary)) return 'Score does not match gameplay totals';
  return null;
}
