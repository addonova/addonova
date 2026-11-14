---
title: addonova info
description: Print resolved configuration, targets, and entrypoints.
---

# `addonova info`

```bash
addonova info [options]
```

Prints the resolved project state, including the config path, root, mode,
output directory, public directory, minify and sourcemap settings, browser API
mode, entrypoints, targets, and manifest name/version.

## Options

| Option | Description |
| --- | --- |
| `--config <path>` | Use an explicit configuration file. |

## Examples

```bash
addonova info
addonova info --config ./configs/ci.ts
```

## Example output

```text
Config           /project/addonova.config.ts
Project root     /project
Mode             production
Outdir           /project/dist
Public dir       /project/public
Minify           yes
Sourcemap        off
Browser API      external (@addonova/browser)
Entrypoints      2
  background     (script) -> /project/src/entrypoints/background.ts
  popup          (html) -> /project/src/entrypoints/popup/index.html
Browsers         chrome (MV3), firefox (MV3)
Available targets chrome, chromium, edge, firefox
Manifest         My Extension 1.0.0
```

When no config file is found, the config line reads `none (using defaults)`.
Manifest name and version can fall back to `package.json`.
