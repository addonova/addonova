---
title: Entrypoints
description: File conventions, explicit entrypoints, define helpers, and manifest roles.
---

# Entrypoints

Addonova scans `src/entrypoints/` by default. Single files and `name/index.*`
forms are supported.

## Convention discovery

| File | Type | Manifest output |
| --- | --- | --- |
| `background.ts` | background | `background.service_worker` or `background.scripts` |
| `content.ts`, `name.content.ts` | content script | `content_scripts[]` |
| `content.css`, `name.content.css` | content style | `content_scripts[].css` |
| `popup.html` | page | `action.default_popup` or `browser_action.default_popup` |
| `options.html` | page | `options_ui.page` |
| `sidepanel.html` | page | `side_panel.default_path` or `sidebar_action.default_panel` |
| `devtools.html` | page | `devtools_page` |
| `sandbox.html`, `name.sandbox.html` | sandbox page | `sandbox.pages` |
| `newtab.html`, `bookmarks.html`, `history.html` | override page | `chrome_url_overrides` |
| `name.html` | page | generic extension page |
| `name.ts`, `name.js` | script | no manifest role |
| `name.css` | style | no manifest role |
| other files | asset | no manifest role |

A directory entry uses its parent name:

```text
src/entrypoints/popup/index.html -> popup.html
src/entrypoints/popup/index.ts   -> popup.js
```

## Explicit entrypoints

Explicit configuration overrides discovery:

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/index.html',
    styles: 'src/styles.css',
    readme: 'src/readme.txt',
  },
});
```

The string and array forms derive names from file names:

```ts
export default defineConfig({
  entrypoints: [
    'src/background.ts',
    'src/content.ts',
    'src/popup/index.html',
  ],
});
```

Per-entrypoint options restrict browsers or set a type:

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
  },
});
```

## Define helpers

Import helpers from `addonova/defines`.

### Background

```ts
import { defineBackground } from 'addonova/defines';

export default defineBackground({
  persistent: false,
  type: 'module',
  main() {
    console.log('background ready');
  },
});
```

A bare function is also accepted:

```ts
import { defineBackground } from 'addonova/defines';

export default defineBackground(() => {
  console.log('background ready');
});
```

### Content script

```ts
import { defineContentScript } from 'addonova/defines';

export default defineContentScript({
  matches: ['https://example.com/*'],
  excludeMatches: ['https://example.com/admin/*'],
  runAt: 'document_idle',
  allFrames: false,
  world: 'ISOLATED',
  cssInjectionMode: 'manifest',
  main(context) {
    console.log('content script ready', context.isValid);
  },
});
```

`matches` is required unless `registration` is `runtime`. Use `include` and
`exclude` to restrict browser targets.

### Unlisted script

```ts
import { defineUnlistedScript } from 'addonova/defines';

export default defineUnlistedScript({
  main() {
    console.log('not registered in the manifest');
  },
});
```

### Page

```ts
import { definePage } from 'addonova/defines';

export default definePage({
  include: ['chrome', 'firefox'],
});
```

## HTML meta tags

HTML entrypoints can declare manifest behavior:

```html
<!doctype html>
<html>
  <head>
    <meta name="manifest.type" content="page" />
    <meta name="manifest.include" content="chrome,edge" />
    <meta name="manifest.exclude" content="firefox" />
    <title>Popup</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./popup.ts"></script>
  </body>
</html>
```

## Output names and collisions

- Script and style names omit the extension.
- HTML names keep `.html`.
- Duplicate output names fail before the build starts with
  `ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT`.
- Missing entrypoint files fail with `ADDONOVA_CONFIG_ENTRYPOINT_MISSING`.

Next: [Manifest versions](manifest-versions.md).
