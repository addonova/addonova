---
title: Hooks API
description: Hook names, payloads, and ordering.
---

# Hooks API

Hooks observe and adjust a build. Register them in project configuration or
through a module's `hooks.on()`.

```ts
export default defineConfig({
  hooks: {
    'build:manifestGenerated': ({ manifest, diagnostics }) => {
      manifest.author = 'Me';
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_INVALID_FIELD',
        severity: 'warning',
        message: 'Checked by a hook',
      });
    },
  },
});
```

## Names

```ts
const HOOK_NAMES = [
  'config:resolved',
  'entrypoints:found',
  'entrypoints:resolved',
  'build:manifestGenerated',
  'build:publicAssets',
  'build:done',
  'dev:reload',
] as const;
```

## Payloads

| Hook | Payload |
| --- | --- |
| `config:resolved` | `{ config }` |
| `entrypoints:found` | `{ config, entrypoints, addEntrypoint, removeEntrypoint }` |
| `entrypoints:resolved` | `{ config, entrypoints, addEntrypoint, removeEntrypoint }` |
| `build:manifestGenerated` | `{ config, browser, manifest, diagnostics }` |
| `build:publicAssets` | `{ config, browser, outdir, assets }` |
| `build:done` | `{ config, reports }` |
| `dev:reload` | `{ config, target, manifestVersion, reason }` |

## Entrypoint payload

```ts
interface EntrypointsHookPayload {
  config: ResolvedConfig;
  entrypoints: ResolvedEntrypoint[];
  addEntrypoint(
    name: string,
    input: string,
    options?: HookEntrypointOptions,
  ): ResolvedEntrypoint;
  removeEntrypoint(name: string): boolean;
}

interface HookEntrypointOptions {
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  type?: EntrypointType;
}
```

`addEntrypoint` mutates `entrypoints`. `removeEntrypoint` removes by resolved
name and returns whether it removed anything.

## Manifest payload

```ts
interface ManifestGeneratedHookPayload {
  config: ResolvedConfig;
  browser: ResolvedBrowser;
  manifest: Record<string, unknown>;
  diagnostics: Diagnostic[];
}
```

Push diagnostics with severity `error` to fail the build. Warnings are printed.

## Public asset payload

```ts
interface GeneratedAsset {
  path: string;
  contents: string | Uint8Array;
}
```

Assets are written into `outdir`. Paths must stay inside it.

## Build done payload

```ts
interface BuildDoneHookPayload {
  config: ResolvedConfig;
  reports: readonly ProjectBuildResult[];
}
```

## Dev reload payload

```ts
interface DevReloadHookPayload {
  config: ResolvedConfig;
  target: BrowserTarget;
  manifestVersion: 2 | 3;
  reason: 'initial' | 'change';
}
```

`dev:reload` runs after a successful development rebuild and before reloads.

## Types

| Type | Description |
| --- | --- |
| `AddonovaHookMap` | Payload signatures per hook. |
| `AddonovaHookName` | Union of hook names. |
| `AddonovaHooks` | Partial hook map. |
| `HookPayload<K>` | Payload for a hook. |
| `HookRegistration` | Registered hook with owner. |
| `GeneratedAsset` | Generated file. |
| `HookEntrypointOptions` | Entrypoint filters and type. |

## Ordering and failure

1. Modules from `modules`, in array order.
2. Local `modules/*`, alphabetically.
3. Project configuration hooks.

Hooks run sequentially. A throwing hook stops the build with
`ADDONOVA_HOOK_FAILED`, including the hook name, owner, and original cause.

## API

| Export | Description |
| --- | --- |
| `HookManager` | Hook registry and dispatcher. |
| `createHookManager()` | Create a manager. |
| `hookError()` | Build a hook failure. |
| `toHookRegistrations()` | Normalize hook maps. |
| `validateHooks()` | Validate hook configuration. |
