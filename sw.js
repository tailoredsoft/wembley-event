/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE.
 *
 * Service worker: makes the app installable and usable offline.
 *
 * Strategy differs by resource type:
 *   - app shell (html/css/manifest): cache-first, so launch is instant
 *   - events.json: network-first, so a fresh feed always wins when online,
 *     but the last good copy is served when offline
 *
 * Bump CACHE_VERSION whenever you change index.html.
 */

const CACHE_VERSION = 'wembley-v2';
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

  const isData = req.url.includes('events.json');

  if (isData) {
    // Network-first: freshness matters more than speed for event data.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for the shell.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});
