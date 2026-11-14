---
title: Plugins, modules, and hooks
description: Extensibility options in addonova.config.*.
---

# Plugins, modules, and hooks

## `plugins`

Type: `AddonovaPlugin[]` - default `[]`.

Plugins run in registration order and can observe builds and transform bundled
code.

```ts
export default defineConfig({
  plugins: [
    {
      name: 'example',
      buildStart() {},
      transform(code, id) {
        return code;
      },
      buildEnd() {},
    },
  ],
});
```

The plugin API is intentionally small. It is not Rollup-compatible.

## `modules`

Type: `AddonovaModuleInput[]` - default `[]`.

Accepts module objects, package names, or `[package, options]` tuples.

```ts
export default defineConfig({
  modules: [
    'addonova-module-example',
    { name: 'inline', setup() {} },
    ['addonova-module-configured', { feature: true }],
  ],
});
```

Configured modules run first, in array order. Local `modules/*` files run next,
sorted by file name.

## `hooks`

Type: `AddonovaHooks` - default `{}`.

```ts
export default defineConfig({
  hooks: {
    'config:resolved': ({ config }) => {
      console.log(config.root);
    },
    'entrypoints:resolved': ({ addEntrypoint }) => {
      addEntrypoint('shared', 'src/shared-entry.ts');
    },
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

Hook order:

1. Configured modules.
2. Local modules, alphabetically.
3. Project configuration hooks.

A failing hook stops the build with `ADDONOVA_HOOK_FAILED`.

## Module options

Use `configKey` to read custom top-level options:

```ts
export default {
  name: 'my-module',
  configKey: 'myModule',
  setup(context, options) {},
};
```

```ts
export default defineConfig({
  myModule: {
    feature: true,
  },
  modules: ['my-module'],
});
```

Top-level unknown keys are allowed for this reason. Nested sections such as
`webExt` and `pack` reject unknown fields.

See [Hooks and modules](../../guide/hooks-and-modules.md) for the full API.
