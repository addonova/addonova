---
title: Limitations
description: Known constraints, non-goals, and backend boundaries.
---

# Limitations

## Auto-reload

- Reloads are full extension reloads, not module-level HMR.
- A background script or service worker is required.
- `background.page` manifests cannot be instrumented and print a warning.
- Tabs reload only when they match content-script patterns.
- Extension state is not preserved across reloads.

## Browser launching

- Chromium loading uses the CDP `Extensions.loadUnpacked` command over
  `--remote-debugging-pipe`.
- Older Chromium builds fall back to `--load-extension`; reloads restart the
  browser process.
- Firefox reloads use WebDriver BiDi `webExtension.install` and require a recent
  Firefox release.
- Missing browsers are doctor warnings, not fatal errors.

## Modules and hooks

- Local modules are discovered only from the top-level `modules/` directory.
- Hooks and modules run in-process and are not sandboxed.
- Module and hook failures stop the build; they are not isolated.
- Hook order is deterministic but not parallel.

## Manifest and locales

- Unsupported manifest fields are preserved and diagnosed, not converted.
- Manifest validation checks structure and referenced files, not full store
  policy.
- Localization checks cover manifest values, not `__MSG_` usage inside scripts
  or styles.
- MV2 is deprecated for Chrome, Chromium, and Edge.

## Runtime package

- `@addonova/browser` is maintained separately and published from its own
  repository.
- Runtime compatibility code is bundled only in `bundle` mode.
- Addonova does not publish the runtime package.

## Backend

- The plugin API is intentionally small and not Rollup-compatible.
- Guchho 1.0.9 has upstream limitations around plugin `transform`, `resolve`,
  `emitFile`, and optional platform packages.
- Addonova works around the transform and watch limitations and does not expose
  unsupported hooks.

## Non-goals

- Safari app-wrapper generation.
- Store listing creation or asset generation.
- A full Rollup-compatible plugin framework.
