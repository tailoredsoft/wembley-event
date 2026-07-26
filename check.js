#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE.
 *
 * Every pre-merge check in one place. CI runs this file, and so can you:
 *
 *   node check.js
 *
 * Exits 0 if everything passes, 1 with an explanation if not — which is what
 * makes it usable as a required status check on pull requests.
 */

const fs = require('fs');
const { execFileSync } = require('child_process');

let failures = 0;

function check(name, fn) {
  try {
    const detail = fn();
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
    failures++;
  }
}

console.log('\nWembley event app — pre-merge checks\n');

check('parser and date-window tests', () => {
  // test.js runs its assertions on require and throws on failure.
  const out = execFileSync(process.execPath, ['test.js'], { encoding: 'utf8' });
  const n = (out.match(/\n/g) || []).length;
  return `${n} lines of output, all assertions passed`;
});

check('events.json is well formed', () => {
  const d = JSON.parse(fs.readFileSync('events.json', 'utf8'));
  if (!Array.isArray(d.events) || d.events.length === 0) throw new Error('no events in feed');

  const dates = d.events.map((e) => e.date);

  for (const e of d.events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error(`bad date format: ${e.date}`);
    if (!e.name) throw new Error(`missing name for ${e.date}`);
    const parsed = new Date(e.date + 'T12:00:00Z');
    if (Number.isNaN(parsed.getTime())) throw new Error(`impossible date: ${e.date}`);
  }
  if (dates.join() !== [...dates].sort().join()) throw new Error('dates are not in order');
  if (new Set(dates).size !== dates.length) throw new Error('duplicate dates present');

  return `${d.events.length} events, sorted, unique`;
});

check('events.json is not stale', () => {
  const d = JSON.parse(fs.readFileSync('events.json', 'utf8'));
  const days = (Date.now() - new Date(d.scrapedAt)) / 86400000;
  // A warning, not a failure: the committed copy is only a seed and fallback,
  // since the published feed is rebuilt on every deploy.
  if (days > 30) console.log(`        note: committed seed is ${days.toFixed(0)} days old`);
  return `scraped ${days.toFixed(1)} days ago`;
});

check('index.html has its expected parts', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  const needles = [
    'EVENT DAY',
    'NO EVENT',
    'events.json',
    'apple-touch-icon',
    'NO_PARKING',
    'manifest.webmanifest',
  ];
  const missing = needles.filter((n) => !h.includes(n));
  if (missing.length) throw new Error('missing: ' + missing.join(', '));
  return `${needles.length} markers found`;
});

check('index.html tags are balanced', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  for (const tag of ['html', 'head', 'body', 'style', 'script', 'header', 'main', 'footer']) {
    const open = (h.match(new RegExp('<' + tag + '[ >]', 'g')) || []).length;
    const close = (h.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) throw new Error(`<${tag}>: ${open} open vs ${close} close`);
  }
  return `${(h.length / 1024).toFixed(1)}KB`;
});

check('service worker parses', () => {
  execFileSync(process.execPath, ['--check', 'sw.js']);
  const sw = fs.readFileSync('sw.js', 'utf8');
  const v = sw.match(/CACHE_VERSION = '([^']+)'/);
  return v ? `cache ${v[1]}` : 'no version found';
});

check('manifest is valid JSON with icons', () => {
  const m = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  if (!m.icons || !m.icons.length) throw new Error('no icons declared');
  for (const icon of m.icons) {
    if (!fs.existsSync(icon.src)) throw new Error(`icon file missing: ${icon.src}`);
  }
  if (!fs.existsSync('apple-touch-icon.png')) throw new Error('apple-touch-icon.png missing');
  return `${m.icons.length} icons, all files present`;
});

console.log(
  failures === 0
    ? '\nAll checks passed.\n'
    : `\n${failures} check${failures === 1 ? '' : 's'} failed.\n`
);

process.exit(failures === 0 ? 0 : 1);
