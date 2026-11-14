---
title: API reference
description: Public exports from the addonova package.
---

# API reference

Addonova exposes one package root and one runtime helper subpath.

```ts
import { defineConfig } from 'addonova';
import { defineBackground, defineContentScript } from 'addonova/defines';
```

## Entry points

| Import | Use |
| --- | --- |
| `addonova` | Configuration, build, packaging, hooks, modules, launcher, diagnostics. |
| `addonova/defines` | Runtime entrypoint declaration helpers. |
| `addonova/package.json` | Package metadata. |

## Export map

| Group | Page |
| --- | --- |
| Configuration | [Config](config.md) |
| Entrypoint defines | [Defines](defines.md) |
| Modules | [Modules](modules.md) |
| Hooks | [Hooks](hooks.md) |
| Build and analysis | [Build](build.md) |
| Packaging | [Packaging](packaging.md) |
| Diagnostics | [Diagnostics](diagnostics.md) |
| Launcher | [Launcher](launcher.md) |
| Manifest and locales | [Manifest and locales](manifest-and-locales.md) |
| Utilities | [Utilities](utilities.md) |

## Stability

The root exports are the supported integration surface. Internal paths such as
`dist/core/*` are not public API and may change. Error codes are stable; see
[Error codes](../reference/error-codes.md).
