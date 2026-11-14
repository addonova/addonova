---
title: addonova dev
description: Watch sources, rebuild, launch browsers, and reload extensions.
---

# `addonova dev`

```bash
addonova dev [options]
```

Watches the project, rebuilds on change, launches configured browsers, and
reloads extensions after successful builds. Development mode is the default.

## Options

| Option | Description |
| --- | --- |
| `--browser <target>` | Launch a target. Repeat for multiple targets. |
| `--manifest-version <2\|3>` | Override the manifest version. |
| `--mode <mode>` | Defaults to `development`. |
| `--config <path>` | Use an explicit configuration file. |
| `--outdir <path>` | Override the output directory. |
| `--debug` | Emit structured JSON events to stderr. |
| `--no-color` | Disable colored output. |

## Examples

```bash
addonova dev
addonova dev --browser chrome --browser firefox
addonova dev --debug
addonova dev --browser chrome --config ./addonova.config.ts
```

## Behavior

- Debounces file changes and classifies them as config, manifest, entrypoint,
  source, asset, or unknown.
- Publishes successful builds atomically.
- Leaves the last successful output untouched when a rebuild fails.
- Injects a reload client into the background script or service worker.
- Reloads matching tabs and calls `runtime.reload()` after a successful build.
- Relaunches a browser if its process exited.
- Recreates targets and relaunches browsers when configuration changes.

## Development output

- Source maps on and minification off by default.
- `(Development)` manifest name suffix when the launcher is enabled.
- `tabs`, plus `scripting` for MV3, when the launcher is enabled.

Set `webExt.disabled: true` to build plain development output without launching
or reloading.

## Notes

- Auto-reload needs a background script or service worker.
- `background.page` cannot be instrumented.
- Launch and reload failures are warnings and do not stop the loop.
- The reload client is not a module-level HMR runtime.
