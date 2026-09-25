/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE.
 *
 * Service worker: makes the app installable and usable offline.
 *
 * Two strategies, because the two kinds of file have different priorities:
 *
 *   events.json  network-first. Correctness about today matters more than
 *                speed, and the page paints from its own localStorage copy
 *                first anyway, so a slow fetch never blocks rendering.
 *
 *   shell        cache-first, then compare against the network in the
 *                background. Instant launch, and if the deployed HTML has
 *                changed the page is told to reload itself — so a deploy
 *                lands within a second or two rather than a launch later.
 *
 * Both bypass the browser HTTP cache and the Pages CDN (see fromNetwork).
 *
 * Bumping CACHE_VERSION is not needed for users to see changes; it only
 * clears entries left by older versions.
 */

const CACHE_VERSION = 'wembley-v12';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/**
 * Strip the query string so a cache-busted request still reads and writes the
 * same cache entry. Without this, every launch would write a new entry keyed by
 * its timestamp and the offline fallback would never match anything.
 */
function cacheKey(url) {
  const u = new URL(url);
  u.search = '';
  return u.toString();
}

/**
 * Fetch that defeats both caches in front of us:
 *   cache: 'no-store'  bypasses the browser's own HTTP cache
 *   ?_sw=<timestamp>   bypasses the Pages CDN, which sends max-age=600
 */
function fromNetwork(key) {
  return fetch(key + '?_sw=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
}

function store(key, res) {
  return caches.open(CACHE_VERSION).then((c) => c.put(key, res));
}

/** Binary files aren't worth diffing — just refresh them silently. */
function isBinary(key) {
  return /\.(png|ico|jpg|jpeg|webp|woff2?)$/i.test(key);
}

/**
 * events.json — network first, always fresh, cache only as an offline
 * fallback. The page renders from its own localStorage copy before this
 * resolves, so a slow network delays the update, never the first paint.
 */
function dataStrategy(key) {
  return fromNetwork(key)
    .then((res) => {
      if (res && res.ok) store(key, res.clone());
      return res;
    })
    .catch(() => caches.match(key).then((hit) => hit || Response.error()));
}

/**
 * Shell (HTML, manifest, icons) — serve the cached copy instantly, then check
 * the network in the background. If what came back differs from what we
 * served, cache it and tell the page, which reloads itself once.
 *
 * This is why launches are fast again: nothing waits on the network, but a
 * deployed change still lands within a second or two of opening the app,
 * rather than on the next launch as a plain cache-first worker would give you.
 */
function shellStrategy(req, key, event) {
  return caches.match(key).then((hit) => {
    const network = fromNetwork(key)
      .then((res) => {
        if (!res || !res.ok) return res;

        if (!hit || isBinary(key)) {
          store(key, res.clone());
          return res;
        }

        return Promise.all([hit.clone().text(), res.clone().text()]).then(([was, now]) => {
          if (was !== now) {
            return store(key, res.clone())
              .then(announceUpdate)
              .then(() => res);
          }
          return res;
        });
      })
      .catch(() => null);

    if (hit) {
      // Respond immediately; let the comparison finish after.
      event.waitUntil(network);
      return hit;
    }

    // Nothing cached yet (first ever load): the network is all we have.
    return network.then(
      (res) =>
        res ||
        caches
          .match(cacheKey(new URL('./index.html', self.location).href))
          .then((fallback) => fallback || Response.error())
    );
  });
}

function announceUpdate() {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => clients.forEach((c) => c.postMessage({ type: 'shell-updated' })));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const key = cacheKey(req.url);

  event.respondWith(
    key.includes('events.json') ? dataStrategy(key) : shellStrategy(req, key, event)
  );
});
