---
title: Production builds
description: Build, validate, analyze, clean, and package extensions for release.
---

# Production builds

Production is the default mode for `build`:

- Guchho minification is enabled.
- HTML and CSS are minified.
- Tree shaking and dead-code elimination are enabled.
- Source maps are off unless configured.

## Build

```bash
npx addonova build
npx addonova build --browser chrome --browser firefox
npx addonova build --browser chrome --no-minify
npx addonova build --browser chrome --sourcemap=inline
```

Override the output directory or config:

```bash
npx addonova build --outdir release
npx addonova build --config ./configs/production.ts
```

## Validate

`validate` runs the same configuration, manifest, locale, and reference checks
as `build` without writing output:

```bash
npx addonova validate
npx addonova validate --browser chrome --browser firefox
```

## Analyze

`analyze` builds in memory and reports per-target outputs, transitive inputs,
external dependencies, and total bytes:

```bash
npx addonova analyze
npx addonova analyze --json
```

JSON reports include `browser`, `manifestVersion`, `outdir`, `totalBytes`,
`dependencies`, `inputs`, and `outputs`.

## Clean

```bash
npx addonova clean
```

`clean` stops the Guchho service before deleting output. It refuses output
directories that contain the project root, source entrypoints, the public
directory, or the configuration file.

## Pack

```bash
npx addonova pack
npx addonova pack --sources
```

`pack` uses every top-level output child as input so `manifest.json` stays at
the archive root. Existing archives are refused unless `pack.overwrite` is set.

### Formats

```ts
export default defineConfig({
  pack: {
    format: 'tar.gz',
    outFile: 'release/extension.tar.gz',
    deterministic: true,
  },
});
```

### Filters

```bash
npx addonova pack --exclude '**/*.map' --include 'manifest.json' --include 'icons/**'
```

Glob rules:

- `*` stays within one path segment.
- `**` crosses segments.
- `{js,css}` expands alternatives.

The archive must keep `manifest.json`; otherwise packing fails with
`ADDONOVA_PACK_MANIFEST_EXCLUDED`.

### Firefox source archives

```ts
export default defineConfig({
  pack: {
    sources: {
      root: '.',
      include: ['src/**', 'public/**', 'manifest.json', 'package.json'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
```

Source archives are written as `<archive>-sources.zip` beside the extension
archive. Enabling sources without a Firefox target fails with
`ADDONOVA_PACK_SOURCES_UNSUPPORTED`.

## ZIP convenience command

```bash
npx addonova zip
```

`zip` always writes a ZIP archive even when `pack.format` is `tar` or `tar.gz`.

## Doctor

```bash
npx addonova doctor
npx addonova doctor --json
```

`doctor` checks Node.js, Guchho, configuration, entrypoints, browser binaries,
and `@addonova/browser` in bundle mode. Missing browsers are warnings; missing
required dependencies exit with code 1.

Next: [Hooks and modules](hooks-and-modules.md).
