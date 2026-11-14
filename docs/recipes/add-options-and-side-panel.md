---
title: Add options and a side panel
description: Create settings and side panel entrypoints.
---

# Add options and a side panel

## Options page

`src/entrypoints/options/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Settings</title>
    <link rel="stylesheet" href="./options.css" />
  </head>
  <body>
    <label>
      <input id="enabled" type="checkbox" />
      Enable on all sites
    </label>
    <script type="module" src="./options.ts"></script>
  </body>
</html>
```

`src/entrypoints/options/options.ts`:

```ts
import { browser } from '@addonova/browser';

const input = document.querySelector<HTMLInputElement>('#enabled');

async function init() {
  const { enabled = false } = await browser.storage.local.get('enabled');
  if (input) input.checked = enabled;
}

input?.addEventListener('change', async () => {
  await browser.storage.local.set({ enabled: input.checked });
});

void init();
```

Generated manifest:

```json
{
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

Set `open_in_tab` through the manifest when desired.

## Side panel

`src/entrypoints/sidepanel/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Details</title>
  </head>
  <body>
    <p id="status">Ready</p>
    <script type="module" src="./sidepanel.ts"></script>
  </body>
</html>
```

Generated fields:

| Target | Field |
| --- | --- |
| Chrome, Chromium, Edge | `side_panel.default_path` |
| Firefox | `sidebar_action.default_panel` |

Firefox needs a sidebar title and icon in the manifest:

```ts
export default defineConfig({
  browsers: ['chrome', 'firefox'],
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
    sidebar_action: {
      default_title: 'Details',
      default_icon: 'icons/icon-48.png',
    },
  },
});
```

## Target filters

```ts
export default defineConfig({
  entrypoints: {
    options: { input: 'src/entrypoints/options/index.html' },
    sidepanel: {
      input: 'src/entrypoints/sidepanel/index.html',
      include: ['chrome', 'edge'],
    },
  },
});
```

## Build and open

```bash
addonova build --browser chrome
```

Open the options page from `chrome://extensions` or call
`browser.runtime.openOptionsPage()`. Open the side panel from the browser UI.
