---
title: Defines API
description: defineBackground, defineContentScript, defineUnlistedScript, and definePage.
---

# Defines API

Import from the `addonova/defines` subpath.

```ts
import {
  defineBackground,
  defineContentScript,
  definePage,
  defineUnlistedScript,
} from 'addonova/defines';
```

The helpers attach manifest metadata and run `main` when the module is imported.
They are not event registrars.

## `defineBackground`

```ts
function defineBackground(
  definition: BackgroundDefinition | (() => void | Promise<void>),
): BackgroundDefinition;
```

```ts
import { defineBackground } from 'addonova/defines';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('installed');
  });
});
```

Object form:

```ts
export default defineBackground({
  persistent: false,
  type: 'module',
  include: ['chrome', 'firefox'],
  main() {
    console.log('background ready');
  },
});
```

| Field | Type | Description |
| --- | --- | --- |
| `persistent` | boolean | MV2 persistence. |
| `type` | `'module'` | Module background. |
| `main` | function | Runs on import. |
| `include` | target[] | Restrict targets. |
| `exclude` | target[] | Skip targets. |

## `defineContentScript`

```ts
function defineContentScript(
  definition: ContentScriptDefinition,
): ContentScriptDefinition;
```

```ts
export default defineContentScript({
  matches: ['https://example.com/*'],
  excludeMatches: ['https://example.com/private/*'],
  runAt: 'document_idle',
  allFrames: false,
  world: 'ISOLATED',
  cssInjectionMode: 'manifest',
  main(context) {
    console.log('content script ready', context.isValid);
  },
});
```

`main` runs immediately unless `registration: 'runtime'` is set. Runtime
registration leaves loading to application code using the `scripting` API.

| Field | Type | Description |
| --- | --- | --- |
| `matches` | string[] | Required match patterns. |
| `excludeMatches` | string[] | Excluded match patterns. |
| `includeGlobs` | string[] | Include globs. |
| `excludeGlobs` | string[] | Exclude globs. |
| `allFrames` | boolean | Run in all frames. |
| `runAt` | `document_start`, `document_end`, `document_idle` | Injection timing. |
| `matchAboutBlank` | boolean | Match `about:blank`. |
| `matchOriginAsFallback` | boolean | Fall back to origin matching. |
| `world` | `ISOLATED`, `MAIN` | Execution world. |
| `cssInjectionMode` | `manifest`, `manual`, `none` | CSS handling. |
| `registration` | `manifest`, `runtime` | Who registers the script. |
| `include` | string[] | Include filter. |
| `exclude` | string[] | Exclude filter. |

The manifest requires `matches`; without it the build reports
`ADDONOVA_MANIFEST_CONTENT_SCRIPT_MATCHES`.

## `ContentScriptContext`

```ts
interface ContentScriptContext {
  readonly isValid: boolean;
  onInvalidated(callback: () => void): () => void;
  setTimeout(callback, delay?, ...args): number;
  clearTimeout(id): void;
  setInterval(callback, delay?, ...args): number;
  clearInterval(id): void;
}
```

Timers are cancelled when the extension context is invalidated. The
`onInvalidated` callback returns an unsubscribe function.

```ts
export default defineContentScript({
  matches: ['https://example.com/*'],
  main(context) {
    const id = context.setInterval(() => {
      console.log('still valid', context.isValid);
    }, 1000);

    context.onInvalidated(() => {
      console.log('context gone');
      context.clearInterval(id);
    });
  },
});
```

## `defineUnlistedScript`

```ts
function defineUnlistedScript(
  definition: UnlistedScriptDefinition | (() => void | Promise<void>),
): UnlistedScriptDefinition;
```

Builds a script without adding it to the manifest. Other code or a runtime
mechanism loads it.

```ts
export default defineUnlistedScript(() => {
  console.log('unlisted script ready');
});
```

## `definePage`

```ts
function definePage(definition?: PageDefinition): PageDefinition;
```

Marks an HTML entrypoint as a page and provides target filters without adding a
manifest field by itself.

```ts
export default definePage({
  include: ['chrome', 'edge'],
});
```

## HTML meta tags

HTML entrypoints may declare:

```html
<meta name="manifest.type" content="sandbox" />
<meta name="manifest.include" content="chrome,edge" />
<meta name="manifest.exclude" content="firefox" />
```

## Error handling

If `main` throws or rejects, Addonova logs
`[addonova] Entrypoint failed:` and continues. Build-time validation does not
execute entrypoints.
