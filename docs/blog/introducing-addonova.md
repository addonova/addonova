---
title: Introducing Addonova
description: A tour of the framework, from entrypoints to store archives.
---

# Introducing Addonova

Addonova is a browser extension framework for Chrome, Chromium, Edge, and
Firefox. It keeps the familiar WebExtension model and adds convention-based
entrypoints, per-target manifests, a development loop, and packaging.

## One project, several browsers

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
    permissions: ['storage'],
  },
});
```

```bash
addonova build
```

```text
dist/chrome/manifest.json
dist/firefox/manifest.json
```

Each target owns its output, manifest conversions, and browser-specific fields.

## Entrypoints are files

```text
src/entrypoints/
├── background.ts
├── content.ts
├── popup/
│   ├── index.html
│   ├── popup.ts
│   └── popup.css
└── options.html
```

Addonova infers manifest roles from names. `defineContentScript()` supplies the
piece it cannot infer: match patterns.

```ts
import { defineContentScript } from 'addonova/defines';

export default defineContentScript({
  matches: ['https://example.com/*'],
  main() {
    console.log('ready');
  },
});
```

## A real development loop

```bash
addonova dev --browser chrome
```

Addonova watches files, rebuilds, launches the browser, and reloads the extension
after successful builds. Failures leave the last successful output in place.

## Extend without forking

Hooks adjust the manifest and emit files. Modules contribute entrypoints, aliases,
and hooks.

```ts
export default defineConfig({
  hooks: {
    'build:publicAssets': ({ assets }) => {
      assets.push({
        path: 'generated/build.json',
        contents: JSON.stringify({ ok: true }),
      });
    },
  },
});
```

## Package what you built

```bash
addonova build
addonova pack --sources
```

`pack` produces store-ready archives; `--sources` adds Firefox source archives.
`addonova validate` and `addonova doctor` catch problems before upload.

## Where to go next

- [Getting started](../guide/getting-started.md)
- [Core concepts](../guide/core-concepts.md)
- [CLI reference](../reference/cli/README.md)
- [Recipes](../recipes/README.md)
