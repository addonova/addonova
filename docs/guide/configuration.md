---
title: Configuration
description: How Addonova discovers and resolves addonova.config.* files.
---

# Configuration

Configuration is discovered from the nearest directory containing one of these
files, in priority order:

1. `addonova.config.ts`
2. `addonova.config.js`
3. `addonova.config.mjs`
4. `addonova.config.json`

Use `--config <path>` to select a file explicitly.

## Basic configuration

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
  },
});
```

`defineConfig()` is an identity helper for editor types. A plain object export
works at runtime.

## Main options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entrypoints` | string, string[], or object | discovered | Overrides convention discovery. |
| `srcDir` | string | `src` | Source directory, resolved from the config file. |
| `entrypointsDir` | string | `entrypoints` | Entrypoint directory relative to `srcDir`. |
| `browsers` | target[] or object | `['chrome']` | Targets and per-browser manifest overrides. |
| `manifest` | object or function | `{}` | Base manifest merged into every target. |
| `convertManifest` | boolean | `true` | Convert MV3-first fields per target. |
| `outdir` | string | `dist` | Output directory. |
| `publicDir` | string | `public` | Files copied into each target. |
| `mode` | `development` or `production` | `production` | Build mode. |
| `minify` | boolean | by mode | JavaScript, CSS, and HTML minification. |
| `sourcemap` | boolean or mode | by mode | `inline`, `external`, `linked`, `both`, or `none`. |
| `browserApi` | mode or object | `external` | How `@addonova/browser` is handled. |
| `webExt` | object | `{}` | Browser launcher settings. |
| `plugins` | plugin[] | `[]` | Build plugins. |
| `modules` | module[] | `[]` | Modules in registration order. |
| `hooks` | object | `{}` | Build lifecycle hooks. |
| `pack` | object | `{}` | Archive settings. |

See the [configuration reference](../reference/config/README.md) for every
option, default, and nested field.

## CLI overrides

CLI flags override configuration values. For example:

```bash
npx addonova build --browser firefox --manifest-version 2 --no-minify
```

## User-level launcher defaults

A user-level `~/.addonova/addonova.config.*` file can supply `webExt`
defaults. Only the `webExt` field is read from that file. Project
configuration overrides user-level values.

```ts
// ~/.addonova/addonova.config.ts
import { defineConfig } from 'addonova';

export default defineConfig({
  webExt: {
    startUrls: ['https://example.com'],
  },
});
```

See [webExt configuration](../reference/config/web-ext.md) for merge rules.

Next: [CLI overview](cli-overview.md).
