# Basic Addonova Example

This example contains a background service worker, a content script, an HTML
popup with TypeScript and CSS, and static assets.

## Build

From the repository root:

```bash
npm run build
node dist/cli/index.js --config examples/basic/addonova.config.ts build
```

The build writes a loadable Chrome extension to `examples/basic/dist/chrome`.

## Develop

```bash
node dist/cli/index.js --config examples/basic/addonova.config.ts dev
```

The dev command rebuilds on changes and keeps the last successful output when a
rebuild fails.

## Package

```bash
node dist/cli/index.js --config examples/basic/addonova.config.ts pack
```

The archive is written to `examples/basic/dist` with `manifest.json` at its root.

## Load the extension

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Choose **Load unpacked** and select `examples/basic/dist/chrome`.
