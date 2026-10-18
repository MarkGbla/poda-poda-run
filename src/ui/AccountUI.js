import { modal } from './Modal.js';
const KEYS = ['poda-vehicle','poda-route','poda-livery','poda-slogan','poda-paint','poda-rack',
  'poda-cargo','poda-wheels','poda-trim','poda-board','poda-sticker','poda-horn'];
const $ = id => document.getElementById(id);
const number = value => (value || 0).toLocaleString('en-US');
export function createAccountUI({ api, store, applyPreferences, canApply, onProfileChange = () => {} }) {
  let version = 0, loadedPlayer = null, cloudPreferences = {}, ready = false, saving = false, dirty = false;
  let syncTimer;
  const accountModal = modal($('accountPanel'));
  function collect() { return Object.fromEntries(KEYS.map(key => [key, store.get(key)]).filter(([, value]) => value !== null)); }
  function render() {
    const account = api.account, player = account?.player;
    onProfileChange();
    $('accountTitle').textContent = player?.driver_name || (player ? 'Choose driver name' : 'Driver profile');
    $('accountSignedIn').hidden = !player; $('accountGuest').hidden = !!player;
    $('accountName').value = player?.driver_name || '';
    $('resultSignIn').hidden = !!player;
    for (const el of document.querySelectorAll('[data-google-login]')) {
      el.hidden = !!player || !account?.authAvailable;
    }
    $('accountAvailability').textContent = account?.authAvailable ? 'Save future runs, earn your place, and return on any device.' : 'Cloud accounts are not available right now. You can keep playing and saving on this device.';
    if (!player) return;
    const s = account.stats || {};
    const rows = [['Best accepted score', number(s.best_score)], ['Lifetime fares', 'Le ' + number(s.lifetime_earnings)],
      ['Accepted runs', number(s.total_runs)], ['Routes finished', number(s.completed_runs)],
      ['Distance', ((s.total_distance || 0)/1000).toFixed(2) + ' km'], ['Driving time', Math.floor((s.total_duration_ms || 0)/60000) + ' min']];
    $('accountStats').replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; row.append(dt, dd); return row;
    }));
    $('accountNameHint').textContent = player.driver_name ? 'Names can change once every seven days.' : 'Choose a public name to save ranked runs. Your Google name and email stay private.';
    $('importPreferences').hidden = version !== 0;
    $('applyCloudPreferences').hidden = version === 0;
    $('cloudGoals').textContent = `Cloud goals: ${Math.min(10,s.total_passengers || 0)}/10 passengers · ${Math.min(5,s.perfect_stops || 0)}/5 perfect stops · ${Math.min(1,s.completed_runs || 0)}/1 route. Your device goals are kept separately.`;
  }
  function open() { accountModal.open(); render(); $('accountClose').focus(); }
  function close() { accountModal.close(); }
  async function refresh() {
    try {
      const account = await api.refresh();
      version = account.progress?.version || 0; cloudPreferences = account.progress?.preferences || {};
      // Apply a cloud account only at a safe menu boundary. Never overwrite guest saves.
      if (account.player && loadedPlayer !== account.player.id) {
        loadedPlayer = account.player.id;
        store.set('poda-guest-preferences-backup', store.get('poda-guest-preferences-backup') || JSON.stringify(collect()));
        if (version > 0 && canApply()) { applyPreferences(cloudPreferences); clearTimeout(syncTimer); dirty = false; }
      }
      ready = true; render(); return account;
    } catch { ready = false; render(); }
  }
  async function savePreferences() {
    if (!ready || !api.account?.player || saving) return;
    const playerId = api.account.player.id, preferences = collect();
    saving = true; dirty = false;
    try {
      const data = await api.request('/api/me/progress', { version, preferences });
      if (api.account?.player?.id !== playerId) return;
      version = data.version; cloudPreferences = preferences;
      $('accountMessage').textContent = 'Garage choices saved to your account.';
      render();
    } catch (error) {
      if (api.account?.player?.id !== playerId) return;
      $('accountMessage').textContent = error.message;
      // Stop automatic overwrites until the player reloads the latest cloud revision.
      if (error.status === 409) ready = false;
    } finally { saving = false; if (dirty) scheduleSave(); }
  }
  function scheduleSave() {
    dirty = true; clearTimeout(syncTimer);
    syncTimer = setTimeout(savePreferences, 700);
  }
  $('accountTitle').addEventListener('click', open);
  $('accountResult').addEventListener('click', open);
  $('accountClose').addEventListener('click', close);
  $('accountNameForm').addEventListener('submit', async event => {
    event.preventDefault(); $('saveDriverName').disabled = true;
    try {
      await api.request('/api/me/name', { name: $('accountName').value.trim() });
      await refresh(); $('accountMessage').textContent = 'Driver name saved. Your next eligible run can join the leaderboard.';
    } catch (error) { $('accountMessage').textContent = error.message; }
    finally { $('saveDriverName').disabled = false; }
  });
  $('accountLogout').addEventListener('click', async () => {
    try {
      await api.logout(); loadedPlayer = null; ready = false; clearTimeout(syncTimer);
      $('accountMessage').textContent = 'Signed out. Your saved cloud progress is safe.';
      await refresh();
    } catch (error) { $('accountMessage').textContent = error.message; }
  });
  $('accountRefresh').addEventListener('click', reconnect);
  $('importPreferences').addEventListener('click', savePreferences);
  $('applyCloudPreferences').addEventListener('click', () => {
    if (canApply()) { applyPreferences(cloudPreferences); clearTimeout(syncTimer); dirty = false; $('accountMessage').textContent = 'Cloud garage choices applied.'; }
    else $('accountMessage').textContent = 'Return home before applying garage choices.';
  });
  $('playerGarage').addEventListener('change', scheduleSave);
  $('routeSelect').addEventListener('change', scheduleSave);
  async function reconnect() {
    const account = await refresh();
    if (!account?.player) return;
    const results = await api.retryPending();
    if (results.some(r => r.status === 'accepted')) { await refresh(); $('accountMessage').textContent = 'Pending runs saved.'; }
  }
  addEventListener('online', reconnect);
  const query = new URL(location.href);
  if (query.searchParams.has('account')) {
    $('accountMessage').textContent = query.searchParams.get('account') === 'error' ? 'Sign-in did not finish. Please try again.' : 'Signed in. Choose your public driver name below.';
    query.searchParams.delete('account'); history.replaceState(null, '', query);
    reconnect().then(open);
  } else reconnect();
  return { refresh, render, open };
}
