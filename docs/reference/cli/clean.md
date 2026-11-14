---
title: addonova clean
description: Stop the bundler service and remove generated output.
---

# `addonova clean`

```bash
addonova clean [options]
```

Stops the Guchho service, then removes the configured output directory. This is
required on Windows because the native service can keep output files open.

## Options

| Option | Description |
| --- | --- |
| `--config <path>` | Use an explicit configuration file. |
| `--outdir <path>` | Override the output directory. |

## Examples

```bash
addonova clean
addonova clean --outdir dist
addonova clean --config ./configs/release.ts
```

## Safety checks

`clean` refuses to remove an output directory that contains the project root,
source entrypoints, the public directory, or the configuration file. The failure
code is `ADDONOVA_CLEAN_UNSAFE_OUTDIR`.
