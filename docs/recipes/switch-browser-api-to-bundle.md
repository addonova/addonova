---
title: Switch browser API to bundle
description: Bundle the target adapter into the extension.
---

# Switch browser API to bundle

Addonova keeps `@addonova/browser` external by default. Bundle mode makes the
extension self-contained and tree-shakes other target adapters.

## Install the package

```bash
npm install @addonova/browser
```

Addonova `1.0.x` targets `@addonova/browser ^0.2.0`.

## Enable bundle mode

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  browserApi: 'bundle',
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
  },
});
```

Object form:

```ts
export default defineConfig({
  browserApi: {
    mode: 'bundle',
    package: '@addonova/browser',
    define: true,
  },
});
```

## Import from the root

```ts
import { browser } from '@addonova/browser';

const tabs = await browser.tabs.query({
  active: true,
  currentWindow: true,
});
```

Do not import `@addonova/browser/chrome` or other target subpaths directly in
bundle mode. Addonova maps the package root per target:

```text
@addonova/browser -> @addonova/browser/<chrome|chromium|edge|firefox>
```

It also defines `__ADDONOVA_BROWSER__` as the target unless `define` is `false`.

## Verify

```bash
addonova doctor
addonova build
```

`doctor` fails when bundle mode is enabled and the package is missing. Builds
fail with `ADDONOVA_BROWSER_API_NOT_FOUND`.

## When to stay external

Use `browserApi: 'external'` when:

- The host or a later pipeline supplies the runtime package.
- The package is not installed in the extension project.
- You want smaller builds with the package resolved elsewhere.

External mode keeps the package and known subpaths out of the bundle and does not
require the package during the Addonova build.

## Check the result

```bash
addonova analyze --browser chrome
```

The dependency list should include only the selected adapter, not every target.
