---
title: addonova zip
description: Package a built extension as a ZIP archive regardless of pack.format.
---

# `addonova zip`

```bash
addonova zip [options]
```

Packages output as a ZIP archive even when `pack.format` is `tar` or `tar.gz`.

## Options

| Option | Description |
| --- | --- |
| `--include <glob>` | Include matching files. Repeatable. |
| `--exclude <glob>` | Exclude matching files. Repeatable. |
| `--sources` | Also write a Firefox source archive. |
| `--config <path>` | Use an explicit configuration file. |

## Examples

```bash
addonova zip
addonova zip --exclude '**/*.map'
addonova zip --include 'manifest.json' --include 'icons/**'
```

## Behavior

- Uses the same filters and staging rules as `pack`.
- Keeps nested directory structure.
- Refuses archives that would exclude `manifest.json`.
- Honours `pack.outFile` naming rules. With multiple targets, omit `outFile`
  and let Addonova derive per-target names.
