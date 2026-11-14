---
title: addonova pack
description: Package a previously built extension.
---

# `addonova pack`

```bash
addonova pack [options]
```

Packages built output using `pack` configuration and CLI filters. Every
top-level output child is an input, so `manifest.json` stays at the archive root.

## Options

| Option | Description |
| --- | --- |
| `--include <glob>` | Include matching files. Repeatable. |
| `--exclude <glob>` | Exclude matching files. Repeatable. |
| `--sources` | Also write a Firefox source archive. |
| `--config <path>` | Use an explicit configuration file. |

## Examples

```bash
addonova pack
addonova pack --sources
addonova pack --exclude '**/*.map'
addonova pack --include 'manifest.json' --include 'icons/**'
```

## Configuration

```ts
export default defineConfig({
  pack: {
    format: 'zip',
    outFile: 'release/my-extension.zip',
    level: 9,
    overwrite: true,
    deterministic: true,
    include: ['**/*'],
    exclude: ['**/*.map'],
  },
});
```

## Glob rules

- `*` stays within one path segment.
- `**` crosses segments.
- `{js,css}` expands alternatives.
- `manifest.json` must remain included.

## Errors

| Code | Meaning |
| --- | --- |
| `ADDONOVA_PACK_OUTPUT_MISSING` | Build output does not exist. |
| `ADDONOVA_PACK_OUTPUT_EXISTS` | Archive exists and overwrite is off. |
| `ADDONOVA_PACK_MANIFEST_EXCLUDED` | Filters remove `manifest.json`. |
| `ADDONOVA_PACK_OUTFILE_AMBIGUOUS` | `outFile` is used with multiple targets. |
| `ADDONOVA_PACK_SOURCES_UNSUPPORTED` | Sources requested without Firefox. |
