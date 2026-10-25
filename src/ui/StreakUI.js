import { modal } from './Modal.js';
import { createGuestStreak, GUEST_STREAK_KEY } from '../services/GuestStreak.mjs';
import { streakStatus, streakDate } from '../services/StreakRules.mjs';
import '../../streak-ui.css';
export function createStreakUI({ api, store, safe, gameVersion }) {
  const guest = createGuestStreak(store);
  const indicator = document.createElement('button');
  indicator.id = 'streakIndicator'; indicator.type = 'button'; indicator.className = 'streak-indicator';
  document.querySelector('.start-side-left').append(indicator);
  const dialog = document.createElement('dialog');
  dialog.id = 'streakDialog'; dialog.className = 'streak-dialog'; dialog.setAttribute('aria-labelledby','streakHeading');
  dialog.innerHTML = `<div class="streak-flame" aria-hidden="true">🔥</div><p class="streak-eyebrow">FREETOWN, EVERY DAY</p><strong id="streakCount"></strong><h2 id="streakHeading">day streak!</h2><p id="streakMessage"></p><p id="streakBest"></p><button id="streakContinue" type="button">Continue</button>`;
  document.body.append(dialog);
  const panel = modal(dialog), $ = id => document.getElementById(id);
  let pending = null, owner, retry = null, inFlight = false, unavailable = false;
  let serverOffset = 0, boundaryTimer;
  function status() {
    const cloud = api.account?.player ? api.account.streak : null;
    const today = cloud ? streakDate(Date.now() + serverOffset, cloud.timezone) : streakDate(Date.now(), api.account?.streakTimezone);
    return streakStatus(cloud || (api.account?.player ? null : guest.read(today)), today);
  }
  function sync() {
    const nextOwner = api.account?.player?.id || null;
    if (nextOwner !== owner) { if (dialog.open) panel.close(); pending = null; retry = null; owner = nextOwner; unavailable = false; }
    const cloud = api.account?.streak;
    if (cloud?.serverNow && cloud !== sync.lastCloud) { serverOffset = cloud.serverNow - Date.now(); sync.lastCloud = cloud; }
    const s = status();
    indicator.textContent = `🔥 ${s.active}-day streak`;
    indicator.title = `Longest: ${s.longest} days · ${s.qualifiedToday ? 'Played today' : s.canContinue ? 'Play today to continue' : 'Start a run to begin'}`;
    indicator.setAttribute('aria-label', `${indicator.textContent}. ${indicator.title}`);
    // One timer at the next calendar boundary, never per-frame polling.
    clearTimeout(boundaryTimer);
    const now = Date.now() + (cloud ? serverOffset : 0), timezone = cloud?.timezone || api.account?.streakTimezone;
    const today = streakDate(now, timezone);
    let low = now, high = now + 27 * 3600000;
    while (high - low > 1000) {
      const mid = Math.floor((low + high) / 2);
      if (streakDate(mid, timezone) === today) low = mid; else high = mid;
    }
    boundaryTimer = setTimeout(sync, high - now + 100);

  }
  function show(celebrate = false) {
    if (!safe() || document.querySelector('dialog[open]')) return false;
    const s = status();
    $('streakCount').textContent = s.active;
    $('streakHeading').textContent = 'day streak!';
    $('streakMessage').textContent = celebrate ? "You’re keeping Freetown moving!" : unavailable ? 'Cloud streak could not be confirmed. Reconnect or start another run to retry.' : s.qualifiedToday ? 'You drove today. Come back tomorrow!' : s.canContinue ? 'Drive today to keep your streak going.' : 'A new day, a new journey. Start a run!';
    $('streakBest').textContent = `Longest: ${s.longest} ${s.longest === 1 ? 'day' : 'days'} · ${api.account?.streak?.timezone || 'Freetown'} time`;
    dialog.classList.toggle('celebrating', celebrate); panel.open(); $('streakContinue').focus(); return true;
  }
  function flush() { sync(); if (pending && pending.owner === owner && show(true)) pending = null; }
  function accept(streak, playerId) {
    if ((api.account?.player?.id || null) !== playerId) return;
    unavailable = false;
    if (playerId) {
      if (api.account.streak?.serverNow > streak.serverNow || api.account.streak?.lastDate > streak.lastDate) return;
      api.account.streak = streak;
    }
    sync();
    if (streak.grew) pending = { owner: playerId };
    flush();
  }
  async function submit(item) {
    if (inFlight || api.account?.player?.id !== item.playerId) return;
    if (item.today !== streakDate(Date.now() + serverOffset, api.account?.streak?.timezone)) { retry = null; return; }
    inFlight = true;
    try {
      const response = await api.request('/api/runs/activity', item.body);
      if (retry === item) retry = null;
      accept(response.streak, item.playerId);
    } catch { unavailable = true; sync(); }
    finally { inFlight = false; }
  }
  async function started({ route, vehicle, practice, handle }) {
    if (practice) return;
    try {
      if (!api.account) {
        try { await api.refresh(); }
        catch {
          // A previously signed-in device must not fabricate offline account progress.
          if (store.get('poda-account-present') === '1') throw new Error('Account offline');
        }
      }
      sync();
      const playerId = api.account?.player?.id || null;
      if (!playerId) { accept(await guest.qualify(streakDate(Date.now(), api.account?.streakTimezone)), null); return; }
      const item = { playerId, today: streakDate(Date.now() + serverOffset, api.account?.streak?.timezone), body: { requestId: handle?.requestId || crypto.randomUUID(), route, vehicle, gameVersion } };
      retry = item;
      if (handle) {
        const response = await handle.promise;
        if (response?.streak) { if (retry === item) retry = null; accept(response.streak, playerId); return; }
      }
      await submit(item);
    } catch { unavailable = true; sync(); }
  }
  indicator.addEventListener('click', () => { if (retry) submit(retry); show(); });
  $('streakContinue').addEventListener('click', () => panel.close());
  addEventListener('storage', event => { if (event.key === GUEST_STREAK_KEY) sync(); });
  addEventListener('online', () => { if (retry) submit(retry); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  sync();
  return { started, sync, flush };
}
