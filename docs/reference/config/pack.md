---
title: Pack configuration
description: Archive format, naming, filters, and Firefox source archives.
---

# Pack configuration

## `pack.format`

Type: `'zip' | 'tar' | 'tar.gz'` - default `'zip'`.

```ts
export default defineConfig({
  pack: { format: 'tar.gz' },
});
```

## `pack.outFile`

Type: `string` - default derived from manifest name, target, and version.

Not allowed when building multiple targets.

```ts
export default defineConfig({
  pack: { outFile: 'release/my-extension.zip' },
});
```

## `pack.level`

Type: integer `0-9` - default engine default.

Compression level for ZIP and TAR.GZ. Not supported for `tar`.

```ts
export default defineConfig({
  pack: { format: 'tar.gz', level: 9 },
});
```

## `pack.overwrite`

Type: `boolean` - default `false`.

Replace an existing archive.

## `pack.deterministic`

Type: `boolean` - default `false`.

Uses a fixed archive timestamp, producing byte-identical archives for unchanged
output.

## `pack.include` and `pack.exclude`

Type: `string[]`.

`include` defaults to `['**/*']`; `exclude` defaults to `[]`.

```ts
export default defineConfig({
  pack: {
    include: ['**/*'],
    exclude: ['**/*.map', '**/*.test.js'],
  },
});
```

`manifest.json` must remain included; otherwise packing fails with
`ADDONOVA_PACK_MANIFEST_EXCLUDED`.

## `pack.sources`

Type: `boolean | { include?, exclude?, root? }` - default `false`.

Adds a Firefox source archive named `<archive>-sources.zip`.

```ts
export default defineConfig({
  pack: {
    sources: true,
  },
});
```

Object form:

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

The default source set excludes dependencies, VCS, hidden files, coverage,
tests, archives, and the output directory. Enabling sources without a Firefox
target fails with `ADDONOVA_PACK_SOURCES_UNSUPPORTED`.
