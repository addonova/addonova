---
title: Configuration reference
description: Every Addonova configuration option, grouped by section.
---

# Configuration reference

Addonova reads the nearest of these files, searching upward from the working
directory:

1. `addonova.config.ts`
2. `addonova.config.js`
3. `addonova.config.mjs`
4. `addonova.config.json`

`--config <path>` overrides discovery. CLI flags override configuration values.

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  outdir: 'dist',
  publicDir: 'public',
  mode: 'production',
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
  },
});
```

## Top-level options

| Option | Type | Default | Section |
| --- | --- | --- | --- |
| `entrypoints` | string, string[], object | discovered | [Entrypoints](entrypoints.md) |
| `srcDir` | string | `src` | [Entrypoints](entrypoints.md) |
| `entrypointsDir` | string | `entrypoints` | [Entrypoints](entrypoints.md) |
| `browsers` | target[] or object | `['chrome']` | [Browsers and manifest](browsers-and-manifest.md) |
| `manifest` | object or function | `{}` | [Browsers and manifest](browsers-and-manifest.md) |
| `convertManifest` | boolean | `true` | [Browsers and manifest](browsers-and-manifest.md) |
| `outdir` | string | `dist` | [Build and output](build-and-output.md) |
| `publicDir` | string | `public` | [Build and output](build-and-output.md) |
| `mode` | `development` or `production` | `production` | [Build and output](build-and-output.md) |
| `minify` | boolean | by mode | [Build and output](build-and-output.md) |
| `sourcemap` | boolean or mode | by mode | [Build and output](build-and-output.md) |
| `browserApi` | mode or object | `external` | [Build and output](build-and-output.md) |
| `webExt` | object | `{}` | [webExt](web-ext.md) |
| `plugins` | plugin[] | `[]` | [Plugins, modules, hooks](plugins-modules-hooks.md) |
| `modules` | module[] | `[]` | [Plugins, modules, hooks](plugins-modules-hooks.md) |
| `hooks` | object | `{}` | [Plugins, modules, hooks](plugins-modules-hooks.md) |
| `pack` | object | `{}` | [Pack](pack.md) |

## Unknown keys

Top-level unknown keys are allowed so modules can read custom options through
`configKey`. Unknown keys inside nested sections such as `webExt` and `pack` are
rejected.
