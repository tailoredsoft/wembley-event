# Wembley Parking

Seven boxes: today plus the next six days. Red means there's a Wembley Stadium event that day (expect parking restrictions), green means there isn't.

## How it fits together

```
Wembley events page  →  scrape.js (daily, on a server)  →  events.json  →  index.html
```

The app never touches wembleystadium.com directly. It can't — the site sends no CORS headers, so a browser or WebView fetch would be blocked. The scraper runs server-side on a schedule and publishes a small JSON file the app is allowed to read.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole app — HTML, CSS, JS in one file. No build step, no framework. |
| `events.json` | The data feed. Currently seeded with real event dates through Oct 2026. |
| `scrape.js` | Fetches and parses the events page, rewrites `events.json`. Node 18+, zero dependencies. |
| `sw.js` | Service worker: makes it installable and offline-capable. |
| `manifest.webmanifest` | PWA metadata (name, icons, standalone display). |
| `test.js` | Parser and date-window tests. |
| `.github/workflows/scrape.yml` | Runs the scrape daily and deploys to GitHub Pages. |

## Try it locally

```bash
cd wembley-event
python3 -m http.server 8000
# open http://localhost:8000
```

Serve it rather than opening the file directly — `fetch` and service workers don't work over `file://`.

Run the scraper and the tests:

```bash
node scrape.js   # rewrites events.json from the live page
node test.js     # parser + date logic
```

## Deploy (GitHub Pages route)

1. Push this folder to a GitHub repo.
2. Settings → Pages → Source: **GitHub Actions**. Nothing deploys until this is set — the `deploy-pages` step fails without it.
3. Actions tab → run **Scrape Wembley events** once by hand to confirm it works.

Live at **https://tailoredsoft.github.io/wembley-event/** — note the trailing slash, and that the path must match the repo name exactly.

After that it deploys on every push to `main` and re-scrapes every morning at 05:17 UTC.

Cloudflare Workers + Cron Triggers works equally well if you'd rather not use Pages.

## Ship to the App Store / Play Store

The PWA is installable already ("Add to Home Screen"), which may be all you need. For actual store listings, wrap the same files with Capacitor:

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Wembley Parking" com.yourname.wembleyparking --web-dir=.
npx cap add ios
npx cap add android
npx cap open ios      # needs Xcode + Apple Developer account (~£79/yr)
npx cap open android  # needs Android Studio
```

Point `DATA_URL` in `index.html` at your deployed `events.json` first — a bundled app has no same-origin copy to fall back on.

## Design notes

A few decisions worth knowing about if you change things:

**The parser ignores CSS classes.** It scans page text for `25 Jul 2026`-style dates and takes the next heading as the event name. Class names change on every site redesign; the visible date format almost never does. It also rejects impossible dates, script contents, and the `© 2001 - 2026` footer year.

**The scraper refuses to write an empty file.** If parsing yields zero events it exits non-zero and leaves the old `events.json` alone, so a Wembley redesign gives you a failed Actions run rather than an app that quietly says "no events" for a month.

**Dates are computed in local time,** not via `toISOString()`. The latter converts to UTC, which would show tomorrow's date during a British Summer Time evening. Day arithmetic anchors at midday to stay clear of DST transitions.

**Three layers of data.** Live fetch → `localStorage` cache → data baked into `index.html`. The app always paints something, even on a first launch with no signal.

**Colour isn't the only signal.** Each box also carries a `!` or `✓` and a text label, for red-green colour blindness and for glanceability.

## Two things to check before relying on it

**Scope of the feed.** `events.json` covers Wembley *Stadium* only. OVO Arena Wembley (12,500 capacity, next door) has its own listing. Worth confirming whether Brent's event-day restrictions are triggered by arena events too — if so, you'll want a second source.

**Terms of use.** Wembley's [terms](https://www.wembleystadium.com/public/terms-of-use) may restrict automated access. Fine for a personal daily fetch in most readings, but read them before publishing this to a store. Brent Council publishes event-day parking information directly and may be a more appropriate source for a public app.

Neither is a code problem, but both affect whether you'd want to ship this.
