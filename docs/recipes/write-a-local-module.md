---
title: Write a local module
description: Share entrypoints, aliases, generated files, and hooks from modules/.
---

# Write a local module

Local modules live in the project's top-level `modules/` directory. Files run
after configured modules, sorted by name.

```text
modules/
└── shared.ts
```

## Module

`modules/shared.ts`:

```ts
import { defineAddonovaModule } from 'addonova';

export default defineAddonovaModule({
  name: 'shared',
  setup({ hooks, addEntrypoint, addAlias, addFile }) {
    addEntrypoint('shared', 'src/shared/entry.ts');
    addAlias('@shared', './src/shared');
    addFile(
      'generated/build-info.json',
      JSON.stringify({ module: 'shared' }, null, 2),
    );

    hooks.on('build:manifestGenerated', ({ manifest }) => {
      manifest.homepage_url = 'https://example.com';
    });
  },
});
```

## Use the alias

```ts
import { formatDate } from '@shared/format-date';
```

Alias targets starting with `./`, `../`, or an absolute path resolve from the
project root. Other targets are package specifiers.

## Generated file

`addFile()` emits through `build:publicAssets` into every target:

```text
dist/chrome/generated/build-info.json
dist/firefox/generated/build-info.json
```

Paths must stay inside the output directory.

## Conditional entries

```ts
export default defineAddonovaModule({
  name: 'firefox-sidebar',
  setup({ addEntrypoint }) {
    addEntrypoint('sidebar', 'src/sidebar/index.html', {
      include: ['firefox'],
      type: 'page',
    });
  },
});
```

## Module options

Read a top-level config field with `configKey`:

```ts
import { defineAddonovaModule } from 'addonova';

export default defineAddonovaModule({
  name: 'analytics',
  configKey: 'analytics',
  setup({ options, addFile }) {
    const config = options as { enabled?: boolean };
    if (config.enabled === true) {
      addFile('generated/analytics.json', '{"enabled":true}');
    }
  },
});
```

```ts
export default defineConfig({
  analytics: { enabled: true },
});
```

## Load order

1. Modules configured in `modules`.
2. Local `modules/*` files, sorted by name.

Editing a module file during `dev` reloads module setup, hooks, aliases, and
entrypoints before rebuilding.

## Naming rules

Ignored files: dotfiles, underscore-prefixed files, declaration files, and
`*.test.*` or `*.spec.*` files. Supported extensions: `.ts`, `.tsx`, `.js`,
`.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`.
