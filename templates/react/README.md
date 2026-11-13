# __PROJECT_TITLE__

A React browser extension built with [Addonova](https://github.com/addonova/addonova).

## Scripts

- `npm run dev` — watch sources and rebuild on change.
- `npm run build` — build every configured browser target.
- `npm run pack` — package a previous build as an archive.
- `npm run typecheck` — type-check the project without emitting output.

## Load the extension

1. Install dependencies and build with `npm install && npm run build`.
2. Open `chrome://extensions`.
3. Enable developer mode.
4. Choose **Load unpacked** and select `dist/chrome`.

## Layout

- `src/entrypoints/background.ts` — background service worker.
- `src/entrypoints/content.ts` — content script.
- `src/entrypoints/popup/` — React popup (`main.tsx`, `App.tsx`) and styles.
- `src/_locales/en.i18n` — localized manifest name and description.
- `public/` — files copied into the build output unchanged.
- `addonova.config.ts` — browsers and manifest defaults.
