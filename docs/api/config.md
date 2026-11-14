---
title: Config API
description: defineConfig and configuration types.
---

# Config API

## `defineConfig`

```ts
function defineConfig<T extends AddonovaUserConfig>(config: T): T;
```

Identity helper that preserves the literal type for editor completion.

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: { name: 'My Extension', version: '1.0.0' },
});
```

Use the default export in `addonova.config.*`.

## Exported types

| Type | Description |
| --- | --- |
| `AddonovaUserConfig` | Object accepted by `defineConfig`. |
| `AddonovaBrowserApiConfig` | `{ mode, package, define }` object form. |
| `AddonovaPackConfig` | `pack` options. |
| `AddonovaSourcesPackConfig` | Firefox sources archive options. |
| `BrowserOverridesInput` | Per-target manifest overrides. |
| `ConfigOverrides` | Runtime overrides used by integrations. |
| `EntrypointConfigInput` | Object entrypoint with `input`, filters, and type. |
| `EntrypointsInput` | String, string array, or object map. |
| `ManifestContext` | Context passed to a manifest function. |
| `ManifestInput` | Static manifest or function. |
| `ResolvedBrowser` | Normalized target and manifest version. |
| `ResolvedBrowserApiConfig` | Normalized browser API settings. |
| `ResolvedConfig` | Fully resolved configuration. |
| `ResolvedEntrypoint` | Normalized entrypoint. |
| `ResolvedPackConfig` | Normalized pack settings. |
| `ResolvedSourcesPackConfig` | Normalized sources settings. |

## `ManifestContext`

```ts
interface ManifestContext {
  browser: BrowserTarget;
  manifestVersion: 2 | 3;
  mode: 'development' | 'production';
  command: string;
}
```

## `ResolvedConfig` highlights

```ts
interface ResolvedConfig {
  root: string;
  configPath: string | null;
  entrypoints: readonly ResolvedEntrypoint[];
  browsers: readonly ResolvedBrowser[];
  manifest: ManifestInput;
  outdir: string;
  publicDir: string;
  mode: 'development' | 'production';
  minify: boolean;
  sourcemap: SourcemapOption;
  browserApi: ResolvedBrowserApiConfig;
  webExt: ResolvedWebExtConfig;
  plugins: readonly AddonovaPlugin[];
  modules?: readonly AddonovaModule[];
  pack: ResolvedPackConfig;
}
```

See [Configuration reference](../reference/config/README.md) for every option.
