---
title: Development workflow
description: Watch mode, auto-reload, browser launching, and dev diagnostics.
---

# Development workflow

```bash
npx addonova dev
```

`dev` watches the project root and configuration file with `chokidar`,
classifies changes, and debounces rebuilds. One warm Guchho context is kept per
target.

Successful builds are published atomically. Failed rebuilds leave the last
successful output untouched.

## Useful commands

```bash
npx addonova dev
npx addonova dev --browser chrome --browser firefox
npx addonova dev --debug
npx addonova dev --no-color
```

## Development output

Development builds add:

- Source maps unless disabled.
- Minification off unless enabled.
- `MODE`, `DEV`, `PROD`, `BROWSER`, and `MANIFEST_VERSION` defines.
- A `(Development)` manifest name suffix when the launcher is enabled.
- The `tabs` permission, plus `scripting` for MV3, when the launcher is enabled.

Disable launcher-only additions with `webExt.disabled: true`.

## Auto-reload

In development mode, Addonova starts a loopback WebSocket server and injects a
reload client into the background script or service worker. After a successful
rebuild it:

1. Reloads tabs that match content-script patterns.
2. Calls `runtime.reload()` so the extension refreshes.
3. Falls back to the launcher's extension reload when no client is connected.

The reload client requires a background entrypoint. `background.page` cannot be
instrumented and prints a warning.

## Browser launcher

`dev` detects installed browsers and launches each configured target.

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  webExt: {
    binaries: {
      chrome: '/opt/google/chrome/chrome',
      firefox: '/opt/firefox/firefox',
    },
    startUrls: ['https://example.com'],
    chromiumArgs: ['--disable-gpu'],
    firefoxArgs: ['--headless'],
  },
});
```

Binary values may be absolute paths, paths relative to the project root, or
bare command names resolved through `PATH`.

## Profiles

- By default each launch uses an isolated temporary profile.
- `chromiumProfile` and `firefoxProfile` select persistent profiles.
- `keepProfileChanges: true` uses `.addonova/browser-profiles/<target>`.
- A `--user-data-dir=` entry in `chromiumArgs` or `--profile` in `firefoxArgs`
  is treated as a persistent profile.

Persistent profiles are never deleted automatically.

## Debug output

```bash
npx addonova dev --debug
```

Structured events go to stderr, including `dev.change`,
`dev.build.success`, `dev.reload.broadcast`, and `dev.rebuild.cycle`.

## Failure behavior

- Failed builds do not reload the extension.
- Launch and reload failures are warnings and do not stop the loop.
- If the browser exits, the next successful rebuild relaunches it.
- Config changes recreate targets and relaunch browsers.

Next: [Production builds](production-builds.md).
