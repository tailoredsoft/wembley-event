#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE.
 *
 * Minimal local preview server. No dependencies, no install.
 *
 *   node serve.js          → http://localhost:8000
 *   node serve.js 3000     → a different port
 *
 * Why not just open index.html directly? Because file:// blocks fetch() and
 * service workers, so the app would fail to load events.json and fall back to
 * its baked-in data — you'd be previewing the wrong thing.
 *
 * Responses are sent with no-store, so a reload always shows your latest edit
 * rather than something the browser or service worker cached.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2]) || 8000;
const root = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  // Keep requests inside the project folder.
  const file = path.join(root, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 — ' + rel + '\n');
      console.log(`  404  ${rel}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // Never cache during development — you want to see the edit you just made.
      'Cache-Control': 'no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    });
    res.end(buf);
    console.log(`  200  ${rel}`);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} is already in use. Try:  node serve.js ${port + 1}\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, () => {
  console.log(`\n  Wembley event app — preview`);
  console.log(`  http://localhost:${port}\n`);
  console.log(`  Ctrl+C to stop. Requests:\n`);
});
