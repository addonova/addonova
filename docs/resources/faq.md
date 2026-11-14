---
title: FAQ
description: Short answers to common Addonova questions.
---

# FAQ

### What is Addonova?

A browser extension framework for building, developing, and packaging extensions
for Chrome, Chromium, Edge, and Firefox from one project.

### Which Node.js version is required?

Node.js `>=20`.

### Which browsers are supported?

`chrome`, `chromium`, `edge`, and `firefox`. All default to MV3.

### Where is configuration read from?

The nearest `addonova.config.ts`, `.js`, `.mjs`, or `.json`, searching upward from
the working directory. `--config` overrides discovery.

### How are entrypoints found?

From `src/entrypoints/` by default. Single files and `name/index.*` forms work.
Recognized names determine manifest roles.

### How do I change the manifest?

Use `manifest` in configuration. It accepts an object or a function receiving
`{ browser, manifestVersion, mode, command }`.

### How do I add a content script?

Create `content.ts` with `defineContentScript()` and required `matches`. See
[Add a content script](../recipes/add-a-content-script.md).

### Why does output live in `dist/<browser>`?

Each target gets isolated output so manifests and target-specific files do not
collide. A browser built with both MV2 and MV3 uses `dist/<browser>-mv2` and
`dist/<browser>-mv3`.

### Why must I run `addonova clean` on Windows?

The native Guchho service can keep output files open. `clean` stops the service
before removing output.

### Does `dev` do hot module replacement?

No. It performs full extension reloads. It does not hot-swap modules or preserve
extension state. Auto-reload needs a background script or service worker.

### What is the difference between `external` and `bundle` browser API mode?

`external` keeps `@addonova/browser` out of the bundle and does not require it at
build time. `bundle` maps the package root to the target adapter and bundles only
that adapter.

### Why does bundle mode fail the build?

The package must be installed. Missing it produces
`ADDONOVA_BROWSER_API_NOT_FOUND`. Run `addonova doctor` to confirm.

### Can I import target subpaths in bundle mode?

No. Import from `@addonova/browser`. Addonova performs the root mapping.

### How do modules differ from plugins?

Modules contribute entrypoints, aliases, files, and hooks during setup. Plugins
observe builds and transform bundled code through `buildStart`, `transform`, and
`buildEnd`.

### Where do local modules live?

In the top-level `modules/` directory. Nested directories are not scanned.

### Why does packing say `manifest.json` is excluded?

Every archive must contain `manifest.json`. Adjust `include`/`exclude` filters.

### Can I pack multiple targets with one `outFile`?

No. `pack.outFile` is only valid for a single target. Otherwise use derived names.

### Is MV2 supported?

Yes, but deprecated for Chromium targets. Firefox still accepts it. Unsupported
fields are preserved and diagnosed.

### Does `pack` build the extension?

No. Run `build` first. `pack` and `zip` package existing output.

### Where can I find error codes?

See [Error codes](../reference/error-codes.md). Use `--verbose` for stack traces
when a command fails.
