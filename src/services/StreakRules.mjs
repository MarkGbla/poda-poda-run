export const STREAK_TIMEZONE = 'Africa/Freetown';
export function streakDate(now = Date.now(), timezone = STREAK_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year','month','day'].map(type => parts.find(p => p.type === type).value).join('-');
}
export function dayNumber(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const ms = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === date ? ms / 86400000 : NaN;
}
export function normalizeStreak(value, today) {
  const empty = { current: 0, longest: 0, lastDate: null };
  if (!value || !Number.isSafeInteger(value.current) || value.current < 0 || value.current > 100000 ||
      !Number.isSafeInteger(value.longest) || value.longest < value.current || value.longest > 100000) return empty;
  if (value.current === 0 && value.lastDate == null) return { ...empty, longest: value.longest };
  if (!Number.isFinite(dayNumber(value.lastDate)) || value.lastDate > today || value.current === 0) return empty;
  return { current: value.current, longest: value.longest, lastDate: value.lastDate };
}
export function streakStatus(value, today) {
  const data = normalizeStreak(value, today), gap = dayNumber(today) - dayNumber(data.lastDate);
  const qualifiedToday = gap === 0, canContinue = gap === 1, expired = gap > 1;
  return { ...data, active: qualifiedToday || canContinue ? data.current : 0, qualifiedToday, canContinue, expired };
}
export function qualifyStreak(value, today) {
  const data = normalizeStreak(value, today);
  if (data.lastDate === today) return { ...data, grew: false };
  const current = dayNumber(today) - dayNumber(data.lastDate) === 1 ? data.current + 1 : 1;
  return { current, longest: Math.max(current, data.longest), lastDate: today, grew: true };
}
// Unsigned device history cannot override an authenticated record.
export function reconcileStreak(account, guest, today) { return normalizeStreak(account, today); }
