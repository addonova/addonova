---
title: Manifest versions
description: How Addonova generates, converts, and validates MV2 and MV3 manifests.
---

# Manifest versions

All four targets default to Manifest V3. Override the version per command or in
configuration:

```bash
npx addonova build --manifest-version 2
npx addonova validate --manifest-version 3
```

```ts
export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: {
    manifest_version: 3,
    name: 'My Extension',
    version: '1.0.0',
  },
});
```

Per-browser overrides can set different versions:

```ts
export default defineConfig({
  browsers: {
    chrome: { manifest_version: 3 },
    firefox: { manifest_version: 2 },
  },
});
```

## Background shapes

MV3 uses a service worker:

```json
{
  "background": {
    "service_worker": "background.js"
  }
}
```

MV2 uses scripts:

```json
{
  "background": {
    "scripts": ["background.js"]
  }
}
```

A mismatch produces a diagnostic. With `convertManifest: true` (the default),
Addonova converts supported fields in both directions.

## What conversion covers

- `action` and `browser_action`.
- Background service workers and scripts.
- Host permissions (`host_permissions` and `permissions`).
- Web accessible resources.
- Restricted permissions that differ by version.

Unsupported fields are preserved and diagnosed, never silently removed.

## Required fields

A manifest must have a name and a valid version. When omitted, Addonova reads
them from `package.json`:

```json
{
  "name": "my-extension",
  "version": "1.2.3"
}
```

Prerelease versions are sanitized for the manifest and preserved in
`version_name`.

## Validation

`build` checks referenced files against the final output directory. `dev` runs
the same checks before publishing output. `validate` performs the checks
without writing files:

```bash
npx addonova validate --browser chrome --browser firefox
```

Common manifest diagnostics include:

| Code | Meaning |
| --- | --- |
| `ADDONOVA_MANIFEST_REQUIRED_FIELD` | Missing name or version. |
| `ADDONOVA_MANIFEST_REFERENCE_MISSING` | A referenced file is missing. |
| `ADDONOVA_MANIFEST_BACKGROUND_VERSION` | Background shape does not match the manifest version. |
| `ADDONOVA_MANIFEST_ACTION_VERSION` | `action`/`browser_action` mismatch. |
| `ADDONOVA_MANIFEST_PERMISSION` | Permission is not valid for the target. |
| `ADDONOVA_MANIFEST_TARGET_FIELD` | Field is browser-specific. |
| `ADDONOVA_MANIFEST_DEPRECATED_VERSION` | MV2 is deprecated for this target. |

## Localized manifests

Addonova accepts two locale layouts:

```text
public/_locales/<locale>/messages.json
src/_locales/<locale>.i18n
```

Example `src/_locales/en.i18n`:

```text
@app_name
My Extension

@app_description
A localized extension description.
```

```ts
export default defineConfig({
  manifest: {
    default_locale: 'en',
    name: '__MSG_app_name__',
    description: '__MSG_app_description__',
  },
});
```

If any locales exist, `default_locale` is required and must match a collected
locale. Missing keys in the default locale are errors; missing keys in other
locales are warnings.

Next: [Browser targets](browser-targets.md).
