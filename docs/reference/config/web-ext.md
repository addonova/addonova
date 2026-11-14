---
title: webExt configuration
description: Browser launcher binaries, arguments, profiles, and start URLs.
---

# `webExt`

Type: `WebExtConfig` - default `{}`.

Settings for browser launching during `addonova dev`.

```ts
export default defineConfig({
  webExt: {
    binaries: {
      chrome: '/opt/google/chrome/chrome',
      firefox: '/opt/firefox/firefox',
    },
    chromiumArgs: ['--disable-gpu'],
    firefoxArgs: ['--headless'],
    startUrls: ['https://example.com'],
  },
});
```

## Fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `disabled` | boolean | `false` | Skip detection, profiles, and launching. |
| `binaries` | object | `{}` | Executables keyed by target. |
| `chromiumArgs` | string[] | `[]` | Extra Chromium arguments. |
| `firefoxArgs` | string[] | `[]` | Extra Firefox arguments. |
| `chromiumProfile` | string | temporary | Persistent Chromium profile. |
| `firefoxProfile` | string | temporary | Persistent Firefox profile. |
| `keepProfileChanges` | boolean | `false` | Use `.addonova/browser-profiles/<target>`. |
| `startUrls` | string[] | `[]` | URLs opened at launch. |

## Binaries

Values may be absolute paths, paths relative to the project root, or bare
command names resolved through `PATH`.

```ts
export default defineConfig({
  webExt: {
    binaries: {
      chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      edge: 'msedge',
      firefox: '/usr/bin/firefox',
    },
  },
});
```

## Profiles

- Default launches use an isolated temporary profile removed on shutdown.
- `chromiumProfile` and `firefoxProfile` reuse persistent directories.
- `keepProfileChanges: true` stores profiles under
  `.addonova/browser-profiles/<target>`.
- A `--user-data-dir=` entry in `chromiumArgs` or `--profile` in `firefoxArgs`
  is treated as a persistent profile.
- Persistent profiles are never deleted automatically.

## Arguments

Required launcher flags are protected. Conflicting custom flags are ignored with
a warning so extension loading keeps working.

## User-level defaults

```ts
// ~/.addonova/addonova.config.ts
import { defineConfig } from 'addonova';

export default defineConfig({
  webExt: {
    startUrls: ['https://example.com'],
  },
});
```

Only the `webExt` field is read from the user-level file. Merge order:

1. Built-in defaults.
2. `~/.addonova/addonova.config.*` -> `webExt`.
3. `<projectRoot>/addonova.config.*` -> `webExt`.

`binaries` merges key by key. Arrays are replaced, not concatenated. Explicit
`undefined` values do not erase lower-precedence values.
