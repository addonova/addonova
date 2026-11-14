---
title: Core concepts
description: Entrypoints, manifests, targets, modes, and the build pipeline.
---

# Core concepts

## Entrypoints

An entrypoint is a source file that becomes part of the extension. Addonova
recognizes background scripts, content scripts, content styles, HTML pages,
styles, scripts, and assets.

```text
src/entrypoints/
├── background.ts
├── content.ts
├── popup.html
└── popup.ts
```

Output names come from the entrypoint name. Scripts and styles omit their
extension; HTML pages keep `.html`.

## Manifest

The manifest is generated per target. Addonova merges:

1. `package.json` defaults for name and version.
2. The base `manifest` configuration.
3. Per-browser overrides from `browsers`.
4. Fields derived from entrypoints.
5. Development-only additions when using the launcher.

Unsupported fields are preserved and diagnosed. They are not silently removed.

## Targets

Targets are `chrome`, `chromium`, `edge`, and `firefox`. Each target has a
default manifest version and its own output directory:

```text
dist/
├── chrome/
├── chromium/
├── edge/
└── firefox/
```

If one browser builds both MV2 and MV3, directories become
`dist/<browser>-mv2` and `dist/<browser>-mv3`.

## Modes

`mode` is `production` or `development`. It controls minification, source maps,
development defines, and development-only manifest additions. `dev` defaults to
development; `build` defaults to production.

## Build pipeline

1. Resolve configuration and apply CLI overrides.
2. Discover entrypoints.
3. Run modules and entrypoint hooks.
4. Build target assets with Guchho.
5. Generate and validate the manifest.
6. Copy public assets and hook-generated files.
7. Report, watch, or package.

## Public assets

Files in `public/` are copied after a successful build. Generated output wins
over a colliding public file, and Addonova prints a warning instead of
overwriting generated content.

Next: [Configuration](configuration.md).
