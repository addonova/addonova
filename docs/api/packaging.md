---
title: Packaging API
description: packProject and archive path helpers.
---

# Packaging API

## `packProject`

```ts
async function packProject(
  config: ResolvedConfig,
  options?: PackProjectOptions,
): Promise<readonly PackTargetResult[]>;
```

```ts
interface PackProjectOptions {
  pack?: PackRunner;
  format?: ArchiveFormat;
  include?: readonly string[];
  exclude?: readonly string[];
  sources?: boolean;
}
```

```ts
interface PackTargetResult {
  browser: ResolvedBrowser;
  outdir: string;
  archivePath: string;
  size: number;
  warnings: readonly string[];
  sources?: PackSourcesResult;
}

interface PackSourcesResult {
  root: string;
  archivePath: string;
  size: number;
  files: number;
  warnings: readonly string[];
}
```

Options merge over `config.pack`. CLI `pack` uses config only; `zip` sets
`format: 'zip'`. Each top-level child of the output directory is staged so
`manifest.json` stays at the archive root.

## `getArchivePath`

```ts
function getArchivePath(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
  format?: ArchiveFormat,
): string;
```

Returns `config.pack.outFile` when set. Otherwise derives a name from the
manifest name and appends target, manifest version, and manifest version string.

## `getSourcesArchivePath`

```ts
function getSourcesArchivePath(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
): string;
```

Returns `<archive-name>-sources.zip` beside the main archive.

## Default source exclusions

Sources archives skip `node_modules`, VCS directories, `.addonova`, coverage,
dotfiles, tests, and existing archives:

```text
node_modules/**
**/node_modules/**
.git/**
.hg/**
.svn/**
.addonova/**
coverage/**
.*
**/.*
**/*.test.*
**/*.spec.*
**/*.zip
**/*.tar
**/*.tar.gz
**/*.crx
**/*.xpi
```

## Behavior

- With multiple targets, `config.pack.outFile` must be `null`; otherwise
  `ADDONOVA_PACK_OUTFILE_AMBIGUOUS` is thrown.
- Filters are applied to relative paths. `manifest.json` must remain.
- `deterministic: true` uses a fixed 1980 timestamp for reproducible archives.
- Empty archives fail with `ADDONOVA_PACK_EMPTY`.
- Existing archives require `overwrite: true`.
- Sources require at least one Firefox target.
