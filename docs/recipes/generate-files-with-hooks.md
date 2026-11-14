---
title: Generate files with hooks
description: Emit build metadata, adjust the manifest, and add entrypoints.
---

# Generate files with hooks

Hooks run in-process during a build. They can add files, adjust the manifest, and
change entrypoints.

## Emit a build file

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  hooks: {
    'build:publicAssets': ({ assets, browser, config }) => {
      assets.push({
        path: 'generated/build.json',
        contents: JSON.stringify(
          {
            browser: browser.target,
            manifestVersion: browser.manifestVersion,
            mode: config.mode,
          },
          null,
          2,
        ),
      });
    },
  },
});
```

Output:

```text
dist/chrome/generated/build.json
```

Paths must stay inside the target output directory.

## Add an entrypoint

```ts
export default defineConfig({
  hooks: {
    'entrypoints:resolved': ({ addEntrypoint }) => {
      addEntrypoint('shared', 'src/shared/entry.ts', {
        type: 'script',
      });
    },
  },
});
```

`entrypoints:found` runs after discovery and module setup;
`entrypoints:resolved` is the final pass before building.

## Adjust the manifest

```ts
export default defineConfig({
  hooks: {
    'build:manifestGenerated': ({ manifest, browser, diagnostics }) => {
      manifest.short_name = 'My Ext';
      manifest.homepage_url = 'https://example.com';

      if (browser.target === 'firefox') {
        manifest.default_locale = 'en';
      }

      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
        severity: 'info',
        message: 'Manifest adjusted by project hook',
      });
    },
  },
});
```

Diagnostics with severity `error` fail the build.

## Inspect results

```ts
export default defineConfig({
  hooks: {
    'build:done': ({ reports }) => {
      for (const report of reports) {
        console.log(
          report.browser.target,
          report.result.success ? 'ok' : 'failed',
          report.outdir,
        );
      }
    },
    'dev:reload': ({ target, reason }) => {
      console.log(`reloading ${target} (${reason})`);
    },
  },
});
```

## Ordering

1. Configured modules.
2. Local `modules/*`, alphabetically.
3. Project configuration hooks.

A throwing hook stops the build with `ADDONOVA_HOOK_FAILED`.
