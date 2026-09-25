# Project conventions

Read this before changing `index.html` or `sw.js`.

## Both platforms, always

This app is used from the home screen on **iOS (WebKit) and Android (Chrome)**.
Every change must behave identically on both. "Works on desktop Chrome" is not
evidence that it works — desktop is the least representative of the three.

A change is not done until it has been reasoned about on both engines, and
anything touching input, layout height, or storage should be stated explicitly
in the commit or the review.

## WebKit behaviours that have already bitten this project

**Click events don't bubble from non-interactive elements.** On iOS Safari, a
tap on a `<span>` or `<div>` does not reach a listener on `document` unless the
element is natively interactive or carries `cursor: pointer`. Symptom: works on
PC, does nothing on iPhone.
→ Bind listeners to the element itself. Add `cursor: pointer` as well.

**300ms tap delay.** WebKit waits to see whether a tap is a double-tap zoom.
→ `touch-action: manipulation` on anything tappable.

**Separate storage per install.** An installed PWA gets its own
`localStorage`, `sessionStorage` and cache, distinct from Safari's. Clearing
Safari data does not touch the installed app. Private mode can make storage
throw on write.
→ Every storage access stays wrapped in `try/catch`.

**Service worker updates need the app fully closed.** Backgrounding is not
enough on iOS. A worker swap can therefore take two launches to take effect.

**Home screen label is fixed at install time.** Changing
`apple-mobile-web-app-title` or the manifest `short_name` does not relabel an
icon someone already installed.

## Android specifics

- Install eligibility needs the manifest plus 192px and 512px icons and a
  registered service worker — all present; don't remove them.
- Chrome uses manifest `name` in the install prompt and `short_name` on the
  home screen. iOS uses `apple-mobile-web-app-title`. Keep all three in step.
- Recommended minimum touch target is 48dp. Calendar cells are smaller because
  a 7-column month grid can't be; anything new should meet it.

## CSS support floor

Provide a fallback whenever a newer unit or property carries the layout:
`min-height: 100vh` before `100dvh`, and so on. The dynamic-viewport units and
`aspect-ratio` are fine on current iOS and Chrome, but the fallback costs one
line and stops an old device rendering a broken page.

Avoid SVG `dominant-baseline` for vertical centring — support has been patchy
in WebKit. Position text with `y` plus `dy` instead.

## Verifying

```bash
node check.js     # every pre-merge check; CI runs this exact script
node serve.js     # preview at http://localhost:8000
```

`check.js` and the jsdom tests run a **spec-compliant** DOM. They prove the
logic is right; they do not prove WebKit agrees. Anything input-related still
needs a real iPhone, and ideally a real Android device.

## Deployment

- `main` deploys to GitHub Pages and reaches the volunteers. Work that isn't
  ready belongs on a branch.
- The workflow never commits to the repo; it scrapes into the deploy folder, so
  `main` only moves when a person pushes.
- Bump `CACHE_VERSION` in `sw.js` on any shell change. It isn't required for
  users to see updates, but it clears stale caches.
