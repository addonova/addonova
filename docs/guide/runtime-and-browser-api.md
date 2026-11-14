---
title: Runtime and browser API
description: External and bundled integration with @addonova/browser.
---

# Runtime and browser API

Runtime helpers live in the separate `@addonova/browser` package. Addonova
declares it as an optional peer dependency and supports two integration modes.

```bash
npm install @addonova/browser
```

```ts
import { browser } from '@addonova/browser';

const tabs = await browser.tabs.query({
  active: true,
  currentWindow: true,
});

console.log(tabs);
```

## External (default)

```ts
export default defineConfig({
  browserApi: 'external',
});
```

`external` keeps `@addonova/browser` and its known subpaths out of the bundle.
The extension host or a later build step supplies the package. Nothing is
bundled, and the package is not required while Addonova builds.

## Bundle

```ts
export default defineConfig({
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome', 'firefox'],
  browserApi: 'bundle',
});
```

For each target, Addonova maps:

```text
@addonova/browser -> @addonova/browser/<chrome|chromium|edge|firefox>
```

It also defines `__ADDONOVA_BROWSER__` as the target name. Only the selected
adapter is reachable, so unused target modules are tree-shaken.

The package must be installed in the project. Otherwise the build fails with
`ADDONOVA_BROWSER_API_NOT_FOUND`.

## Object form

```ts
export default defineConfig({
  browserApi: {
    mode: 'bundle',
    package: '@addonova/browser',
    define: true,
  },
});
```

Set `define: false` to skip the compile-time target define. Alias and
externalization are mutually exclusive.

## Import rules

- Import from the package root: `@addonova/browser`.
- Do not import target subpaths directly in bundle mode.
- Keep runtime code out of build-time hooks and modules.

## Version range

Addonova `1.0.x` targets `@addonova/browser ^0.2.0`. That release adds typed
storage, type-safe messaging and proxy services, content-script context and UI
helpers, i18n helpers, and fake-browser testing utilities.

Next: [Limitations](limitations.md).
