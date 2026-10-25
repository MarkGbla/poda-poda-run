import { normalizeStreak, qualifyStreak, streakDate } from './StreakRules.mjs';
export const GUEST_STREAK_KEY = 'poda-guest-streak-v1';
export function createGuestStreak(store, locks = globalThis.navigator?.locks) {
  let memory = null, volatile = false;
  function read(today = streakDate()) {
    try { const value = volatile ? null : store.get(GUEST_STREAK_KEY); if (value) memory = JSON.parse(value); } catch {}
    return normalizeStreak(memory, today);
  }
  async function qualify(today = streakDate()) {
    const update = () => {
      const next = qualifyStreak(read(today), today); memory = next;
      let persisted = false;
      try { persisted = !!store.set(GUEST_STREAK_KEY, JSON.stringify(next)); } catch {}
      volatile = !persisted;
      return { ...next, persisted };
    };
    return locks ? locks.request(GUEST_STREAK_KEY, update) : update();
  }
  return { read, qualify };
}
