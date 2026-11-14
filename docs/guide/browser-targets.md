---
title: Browser targets
description: Build output and manifest behavior for Chrome, Chromium, Edge, and Firefox.
---

# Browser targets

Supported targets are `chrome`, `chromium`, `edge`, and `firefox`.

| Target | Default | MV2 | MV3 | Notes |
| --- | --- | --- | --- | --- |
| `chrome` | MV3 | deprecated | supported | Chrome Web Store |
| `chromium` | MV3 | deprecated | supported | Chromium distributions |
| `edge` | MV3 | deprecated | supported | Microsoft Edge Add-ons |
| `firefox` | MV3 | supported | supported | `browser_specific_settings`, `sidebar_action` |

## Output layout

```text
dist/
├── chrome/
├── chromium/
├── edge/
└── firefox/
```

Building one browser for both manifest versions uses suffixed directories:

```text
dist/
├── chrome-mv2/
└── chrome-mv3/
```

Files from different targets are never mixed.

## Selecting targets

```bash
npx addonova build --browser chrome --browser firefox
```

```ts
export default defineConfig({
  browsers: ['chrome', 'firefox'],
});
```

The first browser is used by `info` when a manifest name or version is needed.

## Per-browser manifest overrides

```ts
export default defineConfig({
  browsers: {
    chrome: {
      manifest_version: 3,
    },
    firefox: {
      manifest_version: 2,
      browser_specific_settings: {
        gecko: { id: 'my-extension@example.com' },
      },
    },
  },
});
```

Overrides can also be nested under `manifest`:

```ts
export default defineConfig({
  browsers: {
    chrome: {
      manifest: {
        minimum_chrome_version: '120',
      },
    },
  },
});
```

Nested manifest fields are deep-merged.

## Manifest functions

Manifest functions receive the target context:

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  manifest: ({ browser, manifestVersion, mode }) => ({
    name: `My Extension (${browser})`,
    version: '1.0.0',
    description: `${mode} build for MV${manifestVersion}`,
  }),
});
```

The context is `{ browser, manifestVersion, mode, command }`. Function manifests
require a TypeScript or JavaScript config file; JSON configuration cannot hold
functions.

## Target-specific fields

Firefox is the only target that accepts `browser_specific_settings` and
`sidebar_action` without a compatibility warning. Fields that are unsupported
for a target produce `ADDONOVA_MANIFEST_TARGET_FIELD`.

Next: [Development workflow](development-workflow.md).
