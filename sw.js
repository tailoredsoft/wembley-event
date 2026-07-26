/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE.
 *
 * Service worker: makes the app installable and usable offline.
 *
 * Everything is network-first with a cache fallback: online you always get
 * the deployed version, offline you get the last copy that worked.
 *
 * An earlier version served the shell cache-first, which made launches
 * marginally faster but meant a deployed UI change wouldn't appear until the
 * worker happened to update — confusing when iterating. Since the whole app
 * is one ~11KB file, the speed gain wasn't worth the staleness.
 *
 * Bumping CACHE_VERSION is no longer required for users to see changes; it
 * only clears old caches.
 */

const CACHE_VERSION = 'wembley-v5';
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for everything, cache as backup. Each successful response
  // refreshes the cache, so the offline copy is always the last one that
  // actually loaded.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          // A navigation with nothing cached: fall back to the app shell.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
