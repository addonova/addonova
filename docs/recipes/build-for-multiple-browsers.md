---
title: Build for multiple browsers
description: Configure Chrome, Chromium, Edge, and Firefox targets.
---

# Build for multiple browsers

## Configure targets

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
    permissions: ['storage', 'tabs'],
  },
});
```

```bash
addonova build
```

```text
dist/
├── chrome/
└── firefox/
```

## Per-browser manifest fields

```ts
export default defineConfig({
  browsers: {
    chrome: {
      minimum_chrome_version: '120',
    },
    edge: {
      minimum_chrome_version: '120',
    },
    firefox: {
      browser_specific_settings: {
        gecko: {
          id: 'my-extension@example.com',
          strict_min_version: '120.0',
        },
      },
    },
  },
});
```

Nested overrides are deep-merged with the base manifest.

## Restrict an entrypoint

```ts
export default defineConfig({
  entrypoints: {
    popup: { input: 'src/popup/index.html', include: ['chrome', 'edge'] },
    sidebar: { input: 'src/sidebar/index.html', include: ['firefox'] },
  },
});
```

## Manifest versions

All targets default to MV3. Force MV2 for a command:

```bash
addonova build --browser firefox --manifest-version 2
```

Per-browser versions come from browser overrides or the manifest.

## Validate every target

```bash
addonova validate
addonova analyze --browser chrome --browser firefox
```

## Development

```bash
addonova dev --browser chrome --browser firefox
```

Each target receives its own output directory, browser process, and reload loop.

## Package per target

```bash
addonova build
addonova pack
```

With multiple targets, leave `pack.outFile` unset; Addonova derives a name per
target. Add `--sources` to include Firefox source archives.

## Gotchas

- `side_panel` is Chromium-only; Firefox uses `sidebar_action`.
- Firefox extension IDs belong in `browser_specific_settings.gecko.id`.
- MV2 is deprecated for Chromium targets but still supported.
- Unsupported fields are preserved and diagnosed rather than silently removed.
