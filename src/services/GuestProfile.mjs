// Local identity only: never sent as authentication or score verification.
export function normalizeNickname(value) {
  return Array.from(String(value ?? '').trim()).slice(0, 24).join('');
}
export function createGuestProfile(store, makeId = () => crypto.randomUUID()) {
  let saved;
  try { saved = JSON.parse(store.get('poda-guest-profile')); } catch {}
  const profile = {
    guestId: typeof saved?.guestId === 'string' && saved.guestId ? saved.guestId : makeId(),
    displayName: normalizeNickname(saved?.displayName ?? store.get('poda-driver-name')),
  };
  const persist = () => store.set('poda-guest-profile', JSON.stringify(profile));
  persist();
  return {
    get profile() { return { ...profile }; },
    name(player) { return player ? player.driver_name || 'Guest Driver' : profile.displayName || 'Guest Driver'; },
    save(value) {
      const name = normalizeNickname(value);
      if (!name) throw new Error('Enter a nickname to save, or leave it blank to share as Guest Driver.');
      profile.displayName = name;
      return persist();
    },
  };
}
