---
title: Browsers and manifest
description: browsers, manifest, and convertManifest.
---

# Browsers and manifest

## `browsers`

Type: `BrowserTarget[] | Partial<Record<BrowserTarget, object>>`

Default: `['chrome']`

Array form:

```ts
export default defineConfig({
  browsers: ['chrome', 'chromium', 'edge', 'firefox'],
});
```

Object form supplies per-browser manifest overrides:

```ts
export default defineConfig({
  browsers: {
    chrome: {
      manifest_version: 3,
      minimum_chrome_version: '120',
    },
    firefox: {
      manifest_version: 2,
      browser_specific_settings: {
        gecko: { id: 'my-extension@example.com' },
      },
    },
  },
});
```

Overrides may be nested under `manifest`:

```ts
export default defineConfig({
  browsers: {
    chrome: { manifest: { minimum_chrome_version: '120' } },
  },
});
```

## `manifest`

Type: `Record<string, unknown> | ((context: ManifestContext) => Record<string, unknown>)`

Default: `{}`

Base manifest merged into every target.

```ts
export default defineConfig({
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
    description: 'A focused extension.',
    permissions: ['storage', 'tabs'],
    action: { default_title: 'Open' },
  },
});
```

Function form:

```ts
export default defineConfig({
  manifest: ({ browser, manifestVersion, mode, command }) => ({
    name: `My Extension (${browser})`,
    version: '1.0.0',
    description: `${mode} MV${manifestVersion} build from ${command}`,
  }),
});
```

Manifest functions require a TypeScript or JavaScript config file.

## `ManifestContext`

| Field | Type | Description |
| --- | --- | --- |
| `browser` | BrowserTarget | Current target. |
| `manifestVersion` | 2 or 3 | Current manifest version. |
| `mode` | `development` or `production` | Build mode. |
| `command` | CommandName | Command being run. |

## `convertManifest`

Type: `boolean` - default `true`.

Converts MV3-first fields to MV2 and back per target. Set to `false` for strict,
no-conversion output. Unsupported fields are preserved and diagnosed either way.

```ts
export default defineConfig({
  convertManifest: false,
});
```

## Defaults

- `name` and `version` fall back to `package.json`.
- Prerelease versions are sanitized and preserved in `version_name`.
- Icons matching `icon-<size>.(png|svg)` are discovered from `public/` and
  `public/icons/`.
- `icon-light-*` and `icon-dark-*` pairs become `theme_icons`.
