/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE.
 *
 * Parser tests. Run: node test.js
 * Uses a fixture that mirrors the real page's card structure, plus the
 * footer/nav noise that a naive date regex would trip over.
 */

const assert = require('assert');
const { parseEvents } = require('./scrape.js');

const FIXTURE = `
<html><body>
<nav><a href="/events">Events</a></nav>
<h1>Events</h1>
<h2>Experience unforgettable sporting and music events</h2>

<div class="card">
  <img src="bruno.jpg">
  <div class="date">25 Jul 2026</div>
  <div class="time">TBC</div>
  <h3>Bruno&nbsp;Mars</h3>
  <p>The Romantic Tour</p>
</div>

<div class="card">
  <div class="date">01 Aug 2026</div>
  <h3>Luke Combs</h3>
  <p>My Kinda Saturday Night Tour</p>
</div>

<div class="card">
  <div class="date">30 August 2026</div>
  <h3>AEW All In: London</h3>
</div>

<!-- duplicate date should collapse to one entry -->
<div class="card">
  <div class="date">01 Aug 2026</div>
  <h3>Luke Combs</h3>
</div>

<!-- impossible date must be rejected -->
<div class="card"><div class="date">31 Feb 2026</div><h3>Nope</h3></div>

<script>var junk = "12 Jan 1999";</script>
<footer>WembleyStadium © 2001 - 2026. All Rights Reserved</footer>
</body></html>
`;

const events = parseEvents(FIXTURE);
const dates = events.map((e) => e.date);

console.log('Parsed:', events);

// 1. Finds the real events
assert.ok(dates.includes('2026-07-25'), 'should find 25 Jul 2026');
assert.ok(dates.includes('2026-08-01'), 'should find 01 Aug 2026');
assert.ok(dates.includes('2026-08-30'), 'should find full month name "30 August 2026"');

// 2. Rejects noise
assert.ok(!dates.includes('2026-02-31'), 'should reject impossible 31 Feb');
assert.ok(!dates.includes('1999-01-12'), 'should ignore dates inside <script>');

// 3. De-duplicates
assert.strictEqual(dates.filter((d) => d === '2026-08-01').length, 1, 'dates must be unique');

// 4. Sorted ascending
assert.deepStrictEqual([...dates].sort(), dates, 'output must be date-sorted');

// 5. Pulls the event name from the following heading, entities decoded
const bruno = events.find((e) => e.date === '2026-07-25');
assert.strictEqual(bruno.name, 'Bruno Mars', 'name should be "Bruno Mars", got: ' + bruno.name);

// 6. Never emits a nav/boilerplate heading as an event name
assert.ok(
  !events.some((e) => /^events?$/i.test(e.name)),
  'boilerplate headings must not become event names'
);

// --- Day-window logic, mirroring index.html ---
function isoLocal(d) {
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function window7(from) {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return isoLocal(d);
  });
}

// Spans a month boundary
assert.deepStrictEqual(window7('2026-07-28T09:00:00'), [
  '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31',
  '2026-08-01', '2026-08-02', '2026-08-03',
]);

// Spans the BST -> GMT clock change (25 Oct 2026) without dropping/repeating a day
assert.deepStrictEqual(window7('2026-10-23T23:30:00'), [
  '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26',
  '2026-10-27', '2026-10-28', '2026-10-29',
]);

// Leap-year February
assert.strictEqual(window7('2028-02-26T12:00:00')[3], '2028-02-29');

// Window always returns exactly 7 unique days
const w = window7('2026-12-29T12:00:00');
assert.strictEqual(new Set(w).size, 7, 'window must contain 7 distinct dates');

console.log('\nAll tests passed.');
