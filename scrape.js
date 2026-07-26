#!/usr/bin/env node
/**
 * Copyright (c) 2026 Tailoredsoft. All rights reserved.
 * Proprietary — see LICENSE. Not affiliated with Wembley Stadium or The FA.
 *
 * Wembley Stadium event-day scraper.
 *
 * Fetches the public events listing, extracts every event date, and writes
 * events.json — the only file the app consumes.
 *
 * The events page is server-rendered, so no headless browser is needed.
 * Parsing is deliberately structure-agnostic: instead of depending on CSS
 * class names (which change whenever the site is redesigned), it scans text
 * content for date strings in the site's "25 Jul 2026" format and pairs each
 * one with the nearest following heading.
 *
 * Usage:
 *   node scrape.js                    # writes ./events.json
 *   node scrape.js --out path.json
 *   node scrape.js --fixture f.html   # parse a local file instead of fetching
 *
 * Requires Node 18+ (built-in fetch). No dependencies.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://www.wembleystadium.com/events';

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Strip tags/scripts so we can scan readable text, keeping headings marked. */
function toText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<h[1-6][^>]*>/gi, '\n@@H@@')
    .replace(/<\/h[1-6]>/gi, '@@/H@@\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|article|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, ' ');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Extract events from page HTML.
 * @returns {Array<{date: string, name: string}>} sorted, de-duplicated by date
 */
function parseEvents(html) {
  const text = toText(html);

  // Matches "25 Jul 2026" and "1 August 2026"
  const dateRe = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/g;

  const found = new Map(); // ISO date -> event name
  let m;

  while ((m = dateRe.exec(text)) !== null) {
    const day = parseInt(m[1], 10);
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const year = parseInt(m[3], 10);

    if (!month || day < 1 || day > 31) continue;
    if (year < 2000 || year > 2100) continue; // stray footer years

    const iso = `${year}-${pad(month)}-${pad(day)}`;

    // Reject impossible dates like 31 Feb.
    const d = new Date(`${iso}T12:00:00Z`);
    if (d.getUTCDate() !== day || d.getUTCMonth() + 1 !== month) continue;

    // The event title is the first heading after the date within the card.
    const after = text.slice(m.index, m.index + 600);
    const heading = after.match(/@@H@@\s*([^@]+?)\s*@@\/H@@/);
    let name = heading ? heading[1].trim() : '';

    // Drop boilerplate headings that aren't event names.
    if (/^(events?|sign up|experience|upcoming|past)\b/i.test(name)) name = '';
    name = name.replace(/\s+/g, ' ').slice(0, 120);

    if (!found.has(iso) || (!found.get(iso) && name)) {
      found.set(iso, name || 'Event at Wembley Stadium');
    }
  }

  return [...found.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

async function main() {
  const fixture = arg('--fixture');
  const outPath = arg('--out') || path.join(__dirname, 'events.json');

  let html;
  if (fixture) {
    html = fs.readFileSync(fixture, 'utf8');
    console.log(`Parsing fixture: ${fixture}`);
  } else {
    console.log(`Fetching ${SOURCE_URL} ...`);
    const res = await fetch(SOURCE_URL, {
      headers: {
        // Identify the scraper honestly rather than spoofing a browser.
        'User-Agent': 'wembley-parking-app/1.0 (personal parking reminder)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    html = await res.text();
  }

  const events = parseEvents(html);

  if (events.length === 0) {
    // Fail loudly rather than overwriting good data with an empty list.
    throw new Error(
      'Parsed 0 events — the page markup or date format likely changed. ' +
        'Existing events.json left untouched.'
    );
  }

  const payload = {
    source: SOURCE_URL,
    scrapedAt: new Date().toISOString(),
    eventCount: events.length,
    events,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${events.length} events to ${outPath}`);
  for (const e of events) console.log(`  ${e.date}  ${e.name}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Scrape failed:', err.message);
    process.exit(1);
  });
}

module.exports = { parseEvents, toText };
