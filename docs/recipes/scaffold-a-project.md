---
title: Scaffold a project
description: Create an extension with addonova init and make the first build.
---

# Scaffold a project

## Create

```bash
npx addonova init my-extension
cd my-extension
npm install
```

Pick another template or package manager:

```bash
npx addonova init my-extension --template react --pm pnpm
npx addonova init my-extension --template vanilla-js --pm bun
```

Templates: `vanilla-ts`, `vanilla-js`, `react`.

## Inspect

```text
my-extension/
├── addonova.config.ts
├── package.json
├── public/
│   └── icons/logo.svg
└── src/
    ├── entrypoints/
    │   ├── background.ts
    │   ├── content.ts
    │   └── popup/
    │       ├── index.html
    │       ├── popup.ts
    │       └── style.css
    └── _locales/en/messages.json
```

Bundled templates set:

```ts
export default defineConfig({
  browsers: ['chrome'],
  browserApi: 'bundle',
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
  },
});
```

## Build

```bash
npm run build
# or
npx addonova build --browser chrome
```

Output:

```text
dist/chrome/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── popup.css
└── icons/
    ├── logo.svg
    ├── logo-32.png
    ├── logo-48.png
    ├── logo-64.png
    └── logo-128.png
```

The bundled `logo.svg` is rasterized to the configured sizes at build time (see
the `icons` option in the configuration reference).

## Load unpacked

- Chrome: open `chrome://extensions`, enable Developer mode, choose **Load
  unpacked**, select `dist/chrome`.
- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary
  Add-on**, select `dist/firefox/manifest.json`.

## Develop

```bash
npm run dev -- --browser chrome
```

Add `--browser firefox` in a second terminal to run both.

## Next

- [Add a content script](add-a-content-script.md)
- [Build for multiple browsers](build-for-multiple-browsers.md)
