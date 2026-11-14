---
title: Modules API
description: AddonovaModule, module context, and defineAddonovaModule.
---

# Modules API

Modules are setup functions that contribute entrypoints, aliases, generated
files, and hooks.

```ts
import { defineAddonovaModule } from 'addonova';

export default defineAddonovaModule({
  name: 'shared-ui',
  setup({ hooks, addEntrypoint, addAlias, addFile }) {
    addEntrypoint('shared', 'src/shared-entry.ts');
    addAlias('@shared', './src/shared');
    addFile('generated/module.json', '{"source":"module"}');

    hooks.on('build:manifestGenerated', ({ manifest }) => {
      manifest.author = 'shared-ui';
    });
  },
});
```

## Types

```ts
interface AddonovaModule {
  name: string;
  configKey?: string;
  setup(context: AddonovaModuleContext): void | Promise<void>;
}

type AddonovaModuleInput =
  | AddonovaModule
  | string
  | readonly [string, unknown];
```

| Type | Description |
| --- | --- |
| `AddonovaModule` | Module object. |
| `AddonovaModuleContext` | Setup context. |
| `AddonovaModuleHooks` | Hook registrar. |
| `AddonovaModuleInput` | Object, package name, or tuple. |
| `ModuleEntrypointOptions` | `include`, `exclude`, and `type`. |
| `ModuleResolution` | Result of module resolution. |
| `ResolveModulesOptions` | Inputs for `resolveModules()`. |

## `defineAddonovaModule`

```ts
function defineAddonovaModule<T extends AddonovaModule>(module: T): T;
```

Identity helper for editor types.

## `AddonovaModuleContext`

```ts
interface AddonovaModuleContext {
  root: string;
  configPath: string | null;
  mode: 'development' | 'production';
  options: unknown;
  config: Readonly<AddonovaUserConfig>;
  hooks: AddonovaModuleHooks;
  addEntrypoint(name: string, input: string, options?): void;
  addAlias(name: string, target: string): void;
  addFile(relativePath: string, contents: string | Uint8Array): void;
}
```

### `addEntrypoint`

Uses the same name, input, filter, and type rules as explicit configuration.

```ts
addEntrypoint('content', 'src/content.ts', {
  include: ['chrome', 'firefox'],
  type: 'content-script',
});
```

### `addAlias`

Targets starting with `./`, `../`, or an absolute path resolve from the project
root. Other targets are package specifiers.

```ts
addAlias('@shared', './src/shared');
addAlias('react', 'preact/compat');
```

### `addFile`

Writes a generated file into every target output via `build:publicAssets`.
Paths must stay inside the output directory.

```ts
addFile('generated/config.json', JSON.stringify({ ok: true }));
```

## `resolveModules`

```ts
function resolveModules(options: ResolveModulesOptions): Promise<ModuleResolution>;
```

Loads configured modules and local `modules/*` files. Local files support
`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, and `.cts`. Dotfiles,
underscore-prefixed files, declaration files, and `*.test.*`/`*.spec.*` files are
ignored.

## Module options

Set `configKey` to read a top-level config field:

```ts
export default defineAddonovaModule({
  name: 'analytics',
  configKey: 'analytics',
  setup({ options }) {
    const { enabled } = options as { enabled: boolean };
  },
});
```

```ts
export default defineConfig({
  analytics: { enabled: true },
  modules: ['addonova-module-analytics'],
});
```

Top-level unknown keys are allowed for module options. Nested sections such as
`webExt` and `pack` reject unknown fields.

## Load order

1. Configured modules, in array order.
2. Local `modules/*` files, sorted by file name.

Each module's hooks register during setup before the build starts.
