/**
 * Offline and flaky-connection support.
 *
 * Written for the connections the game is actually played on: links that drop
 * mid-request, hotspots that disappear between stops, and data that costs money.
 * The aim is that a second visit costs nothing and works with no signal at all.
 *
 * Strategy per kind of request:
 *   /assets/*   cache-first. Vite fingerprints these, so a given URL can never
 *               change content and a cache hit is always correct.
 *   HTML        network-first with a cache fallback, so a new release is picked
 *               up when there is signal and the last good page is served when
 *               there is not.
 *   /api/*      never cached. A stale leaderboard is worse than no leaderboard,
 *               and the game already handles the API being unavailable.
 *   audio       never cached. The music track alone is 3 MB; putting that in
 *               storage uninvited is not a reasonable thing to do to someone
 *               paying by the megabyte.
 */
const VERSION = 'poda-v2';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// The smallest set that gets a playable title screen with no network.
const PRECACHE = ['./', './index.html'];

const isAudioPath = path => /\.(mp3|ogg|wav|m4a)(\?|$)/i.test(path);

/**
 * Precache at install time by reading the just-served page and pulling out its
 * fingerprinted asset URLs.
 *
 * This matters more than it looks. A worker does not control the page that
 * registers it, so on a first visit the script and stylesheet requests never
 * pass through fetch() and never land in the cache. Without this the game only
 * survives going offline on the *third* visit. Reading the URLs out of the HTML
 * keeps the worker self-sufficient, with no build step to keep in step.
 */
async function precache() {
  const shell = await caches.open(SHELL);
  await Promise.allSettled(PRECACHE.map(url => shell.add(url)));
  try {
    const response = await fetch('./index.html', { cache: 'reload' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await shell.put('./index.html', response);
    const urls = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
      .map(m => m[1])
      .filter(u => !isAudioPath(u));
    const runtime = await caches.open(RUNTIME);
    await Promise.allSettled(urls.map(url => runtime.add(url)));
  } catch { /* offline at install time; the fetch handler will fill in later */ }
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isAudio = url => isAudioPath(url.pathname);
const isHashedAsset = url => url.pathname.includes('/assets/');

/**
 * Cache-first for fingerprinted assets.
 *
 * `ignoreVary` is doing real work here, not defensive padding. Responses are
 * stored with whatever `Vary` header the server sent — `Accept-Encoding` is
 * typical — and a later request whose headers differ even slightly will miss a
 * perfectly good entry. The URL already carries a content hash, so matching on
 * the URL alone is both safe and what we actually mean.
 */
async function assetFirst(request) {
  const hit = await caches.match(request, { ignoreVary: true });
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(RUNTIME).then(c => c.put(request, copy)).catch(() => {});
    }
    return response;
  } catch (err) {
    const retry = await caches.match(request, { ignoreVary: true, ignoreSearch: true });
    if (retry) return retry;
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith('/api/')) return;   // always live
  if (isAudio(url)) return;                                     // never store 3 MB uninvited

  // Fingerprinted assets: serve from cache, fetch once, keep.
  if (sameOrigin && isHashedAsset(url)) {
    event.respondWith(assetFirst(request));
    return;
  }

  // Pages: prefer the network so updates land, fall back to the last good copy.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL).then(c => c.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request, { ignoreVary: true })
          .then(hit => hit || caches.match('./index.html', { ignoreVary: true }))),
    );
    return;
  }

  // Everything else, fonts included: use the cache when the network fails.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && (sameOrigin || request.destination === 'font')) {
          const copy = response.clone();
          caches.open(RUNTIME).then(c => c.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreVary: true })),
  );
});
