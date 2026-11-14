---
title: Entrypoint configuration
description: entrypoints, srcDir, and entrypointsDir.
---

# Entrypoint configuration

## `entrypoints`

Type: `string | string[] | Record<string, string | { input, include?, exclude?, type? }>`

Default: discovered from `src/entrypoints/`.

Overrides convention discovery. The object form names outputs explicitly.

```ts
export default defineConfig({
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/index.html',
  },
});
```

String form:

```ts
export default defineConfig({
  entrypoints: ['src/background.ts', 'src/popup/index.html'],
});
```

Per-entrypoint options:

```ts
export default defineConfig({
  entrypoints: {
    popup: {
      input: 'src/popup/index.html',
      include: ['chrome', 'edge'],
    },
    content: {
      input: 'src/content.ts',
      exclude: ['firefox'],
      type: 'content-script',
    },
    editor: 'src/editor.ts',
  },
});
```

Fields:

| Field | Type | Description |
| --- | --- | --- |
| `input` | string | Source file. Required in object form. |
| `include` | target[] | Build only for these targets. |
| `exclude` | target[] | Skip these targets. |
| `type` | entrypoint type | Override inferred type. |

Types: `background`, `content-script`, `content-style`, `popup`, `options`,
`sidepanel`, `devtools`, `sandbox`, `override`, `page`, `script`, `style`,
`asset`.

## `srcDir`

Type: `string` - default `src`.

Source directory, resolved from the configuration file.

```ts
export default defineConfig({
  srcDir: 'extension/src',
});
```

## `entrypointsDir`

Type: `string` - default `entrypoints`.

Entrypoint directory relative to `srcDir`.

```ts
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entries',
});
```

This scans `src/entries/`.

## Name rules

- Script and style output names omit extensions.
- HTML output names keep `.html`.
- `index` files use their parent directory name.
- Duplicate output names fail with `ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT`.
- Missing files fail with `ADDONOVA_CONFIG_ENTRYPOINT_MISSING`.
