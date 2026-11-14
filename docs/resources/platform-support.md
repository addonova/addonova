---
title: Platform support
description: Supported Node.js, operating systems, browsers, and manifest versions.
---

# Platform support

## Node.js

| Requirement | Value |
| --- | --- |
| Minimum | Node.js 20 |
| Module type | ESM package |

## Operating systems

| Command | Windows | macOS | Linux |
| --- | --- | --- | --- |
| `build`, `validate`, `pack`, `zip`, `analyze` | Yes | Yes | Yes |
| `clean` | Yes | Yes | Yes |
| `dev` browser launch | Yes | Yes | Yes |
| `doctor` binary discovery | Yes | Yes | Yes |

`clean` is especially important on Windows because the native Guchho service can
hold output files open.

## Browsers

| Target | Default manifest | Supported versions | Notes |
| --- | --- | --- | --- |
| `chrome` | 3 | 2, 3 | MV2 deprecated. |
| `chromium` | 3 | 2, 3 | MV2 deprecated. |
| `edge` | 3 | 2, 3 | MV2 deprecated. |
| `firefox` | 3 | 2, 3 | Supports `browser_specific_settings` and `sidebar_action`. |

## Feature matrix

| Feature | Chrome | Chromium | Edge | Firefox |
| --- | --- | --- | --- | --- |
| MV2 build | Yes | Yes | Yes | Yes |
| MV3 build | Yes | Yes | Yes | Yes |
| Side panel | Yes | Yes | Yes | Via sidebar |
| `browser_specific_settings` | No | No | No | Yes |
| Launcher reload via CDP | Yes | Yes | Yes | No |
| Launcher reload via WebDriver BiDi | No | No | No | Yes |

## Launcher requirements

- Chromium targets use CDP `Extensions.loadUnpacked` over
  `--remote-debugging-pipe`. Older builds fall back to `--load-extension`, where
  reloads restart the browser.
- Firefox reloads use WebDriver BiDi `webExtension.install` and require a recent
  Firefox release with extension installation support.
- Browser binaries are discovered from common install paths, `PATH`, or
  `webExt.binaries`.

## Related

- [Browser targets](../guide/browser-targets.md)
- [webExt configuration](../reference/config/web-ext.md)
- [Limitations](../guide/limitations.md)
