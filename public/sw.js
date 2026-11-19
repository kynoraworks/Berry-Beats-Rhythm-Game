/*
 * Berry Beats service worker: lets the game load and play with no connection.
 *
 * - The page itself is fetched from the network first, so a new deploy always
 *   shows up, and falls back to the cached copy when offline.
 * - Everything else on this site (art, music, charts, the hashed script) is
 *   served from the cache and fetched only when missing.
 * - The cache is named after the build id passed in the registration URL
 *   (sw.js?v=...). A new deploy therefore starts a new, empty cache and the
 *   old one is deleted, which is how changed art and music get picked up.
 */
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const PREFIX = 'berry-beats-';
const CACHE = PREFIX + BUILD;
const SCOPE = self.registration.scope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic';
}

async function pageFromNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) await cache.put(SCOPE, response.clone());
    return response;
  } catch (error) {
    // Offline: any page URL (including ones with ?scene=...) is the same single page.
    const cached = (await cache.match(SCOPE)) || (await cache.match(SCOPE + 'index.html'));
    if (cached) return cached;
    throw error;
  }
}

async function fileFromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
  // Partial requests cannot be answered from a stored full response.
  if (request.headers.has('range')) return;
  if (request.mode === 'navigate') event.respondWith(pageFromNetworkFirst(request));
  else event.respondWith(fileFromCacheFirst(request));
});

/** Fetch every file of the build that is not cached yet, one at a time. */
async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch(SCOPE + 'precache-manifest.json', { cache: 'no-store' });
  if (!response.ok) return;
  const files = await response.json();
  for (const file of files) {
    const url = SCOPE + file;
    try {
      if (await cache.match(url)) continue;
      const fetched = await fetch(url);
      if (isCacheable(fetched)) await cache.put(url, fetched);
    } catch {
      return; // connection lost: the rest is fetched on demand later
    }
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'precache') event.waitUntil(precache().catch(() => undefined));
});
