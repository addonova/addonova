---
title: addonova analyze
description: Report bundle inputs, outputs, dependencies, and total size.
---

# `addonova analyze`

```bash
addonova analyze [--json] [options]
```

Builds in memory and reports per-target outputs, transitive inputs, external
dependencies, and total bytes. No files are written.

## Options

| Option | Description |
| --- | --- |
| `--json` | Print a machine-readable report. |
| `--browser <target>` | Analyze a target. Repeat for multiple targets. |
| `--config <path>` | Use an explicit configuration file. |

## Examples

```bash
addonova analyze
addonova analyze --json
addonova analyze --browser firefox
```

## JSON shape

The JSON report is an array with one entry per target:

```json
[
  {
    "browser": "chrome",
    "manifestVersion": 3,
    "outdir": "/project/dist/chrome",
    "totalBytes": 18432,
    "dependencies": ["@addonova/browser"],
    "inputs": [
      { "path": "/project/src/entrypoints/background.ts", "bytes": 1024 }
    ],
    "outputs": [
      { "path": "background.js", "size": 4096 }
    ]
  }
]
```

Use it to spot oversized inputs or unexpected dependencies before release.
