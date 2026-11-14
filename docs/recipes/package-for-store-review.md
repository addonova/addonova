---
title: Package for store review
description: Produce Chrome Web Store and Firefox add-on archives.
---

# Package for store review

## Build first

`pack` and `zip` package existing output; they do not build.

```bash
addonova clean
addonova build
```

## Configure archives

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: {
    name: 'My Extension',
    version: '1.2.3',
  },
  pack: {
    format: 'zip',
    overwrite: true,
    deterministic: true,
    exclude: ['**/*.map'],
    sources: true,
  },
});
```

## Package

```bash
addonova pack
```

Produces one archive per target, plus a sources archive for Firefox:

```text
addonova-chrome-mv3-1.2.3.zip
addonova-firefox-mv3-1.2.3.zip
addonova-firefox-mv3-1.2.3-sources.zip
```

`--sources` enables the same for a one-off run. Source archives are only
supported when a Firefox target is configured.

## Explicit output name

Only valid with one target:

```ts
export default defineConfig({
  browsers: ['chrome'],
  pack: {
    outFile: 'release/my-extension.zip',
    overwrite: true,
  },
});
```

```bash
addonova pack
```

With multiple targets, leave `outFile` unset. Otherwise packing fails with
`ADDONOVA_PACK_OUTFILE_AMBIGUOUS`.

## Force ZIP

```bash
addonova zip
```

Use it when `pack.format` is `tar` or `tar.gz` but a store needs a ZIP.

## Deterministic builds

```ts
export default defineConfig({
  pack: {
    deterministic: true,
  },
});
```

A fixed 1980 timestamp makes unchanged output produce byte-identical archives.

## Verify before upload

```bash
addonova validate
addonova analyze
```

Check that:

- `manifest.json` is at the archive root.
- No `.map` files, tests, or secrets are included.
- The version matches the store listing.
- Firefox includes `browser_specific_settings.gecko.id`.
- Source archives include everything needed to rebuild the submitted package.

## Upload

- Chrome Web Store: upload the extension ZIP, not the sources ZIP.
- Firefox AMO: upload the extension archive and provide the sources archive when
  the code is minified or generated.

Archives are only created after a successful build; missing output fails with
`ADDONOVA_PACK_OUTPUT_MISSING`.
