---
title: Add a content script
description: Inject TypeScript and CSS into matching pages.
---

# Add a content script

## Create the entrypoint

`src/entrypoints/content.ts`:

```ts
import { defineContentScript } from 'addonova/defines';

export default defineContentScript({
  matches: ['https://example.com/*'],
  runAt: 'document_idle',
  main(context) {
    const badge = document.createElement('div');
    badge.textContent = 'Addonova is here';
    badge.style.cssText =
      'position:fixed;right:16px;bottom:16px;padding:8px 12px;' +
      'background:#111;color:#fff;border-radius:6px;z-index:2147483647';
    document.body.append(badge);

    context.onInvalidated(() => badge.remove());
  },
});
```

An adjacent `content.css` is injected with the script:

```css
/* src/entrypoints/content.css */
.addonova-highlight {
  outline: 2px solid #6d5efc;
}
```

## Build

```bash
addonova build --browser chrome
```

Generated manifest fragment:

```json
{
  "content_scripts": [
    {
      "matches": ["https://example.com/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ]
}
```

## Multiple scripts

Name each script after its purpose:

```text
src/entrypoints/
├── youtube.content.ts
├── github.content.ts
└── github.content.css
```

Use explicit configuration when names should differ from files:

```ts
export default defineConfig({
  entrypoints: {
    github: { input: 'src/content/github.ts', type: 'content-script' },
  },
});
```

## Restrict targets

```ts
export default defineContentScript({
  matches: ['https://example.com/*'],
  include: ['chrome', 'edge'],
  main() {},
});
```

## Runtime registration

Set `registration: 'runtime'` to keep the script out of the manifest. The
script's `main` does not run automatically.

```ts
export default defineContentScript({
  registration: 'runtime',
  matches: ['https://example.com/*'],
  main() {
    console.log('registered dynamically');
  },
});
```

Register it from the background using the `scripting` permission and the built
file name.

## Validate

```bash
addonova validate --browser chrome
```

If `matches` is missing, the build reports
`ADDONOVA_MANIFEST_CONTENT_SCRIPT_MATCHES`.
