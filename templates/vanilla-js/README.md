# __PROJECT_TITLE__

A browser extension built with [Addonova](https://github.com/addonova/addonova).

## Scripts

- `npm run dev` — watch sources and rebuild on change.
- `npm run build` — build every configured browser target.
- `npm run pack` — package a previous build as an archive.

## Load the extension

1. Build the project with `npm run build`.
2. Open `chrome://extensions`.
3. Enable developer mode.
4. Choose **Load unpacked** and select `dist/chrome`.

## Layout

- `src/entrypoints/background.js` — background service worker.
- `src/entrypoints/content.js` — content script.
- `src/entrypoints/popup/` — popup HTML, JavaScript, and CSS.
- `public/` — files copied into the build output unchanged.
- `addonova.config.js` — browsers and manifest defaults.
