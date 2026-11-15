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
| `keepProfileChanges` | boolean | `false` | Alias for `dataPersistence: 'project'`. |
| `dataPersistence` | `'none' \| 'project' \| 'user'` | `'none'` | Profile persistence strategy. |
| `projectDataDir` | string | `.addonova/browser-profiles` | Base directory for project profiles. |
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

Keys accept the manifest targets (`chrome`, `chromium`, `edge`, `firefox`) and
additional launcher targets: `brave`, `arc`, `dia`, `chrome-beta`,
`chrome-canary`, `chrome-dev`, `edge-beta`, `edge-canary`, `edge-dev`,
`firefox-nightly`, `firefox-developer-edition`, and `zen`.

When the requested target cannot be found, Addonova falls back to another
browser of the same family (for example `chrome` -> `chromium` -> `brave`) and
reports an `ADDONOVA_BROWSER_FALLBACK` warning. Set
`binaries[target]` to pin an exact executable.

## Profiles

- Default launches use an isolated temporary profile removed on shutdown.
- `chromiumProfile` and `firefoxProfile` reuse persistent directories.
- `dataPersistence: 'project'` stores profiles under
  `projectDataDir/<target>` (default `.addonova/browser-profiles/<target>`).
- `dataPersistence: 'user'` stores profiles under
  `~/.addonova/browser-profiles/<target>`.
- `keepProfileChanges: true` is kept as an alias for
  `dataPersistence: 'project'`. When both are set, `dataPersistence` wins and an
  `ADDONOVA_WEBEXT_OPTION_CONFLICT` warning is reported.
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
