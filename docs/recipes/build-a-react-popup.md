---
title: Build a React popup
description: Use React and TypeScript in an HTML entrypoint.
---

# Build a React popup

## Install

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
```

Use `addonova init . --template react` to start from the React template instead.

## Entrypoint

`src/entrypoints/popup/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Popup</title>
    <link rel="stylesheet" href="./popup.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./popup.tsx"></script>
  </body>
</html>
```

`src/entrypoints/popup/popup.tsx`:

```tsx
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from '@addonova/browser';

function Popup() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    void browser.storage.local.get('count').then((value) => {
      setCount(Number(value.count ?? 0));
    });
  }, []);

  async function increment() {
    const next = count + 1;
    setCount(next);
    await browser.storage.local.set({ count: next });
  }

  return (
    <main>
      <h1>My Extension</h1>
      <button type="button" onClick={increment}>
        Count: {count}
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
```

`src/entrypoints/popup/popup.css`:

```css
:root {
  color-scheme: light dark;
  font: 14px/1.4 system-ui, sans-serif;
}

body {
  margin: 0;
  min-width: 320px;
  padding: 16px;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 8px 12px;
  background: #6d5efc;
  color: white;
  cursor: pointer;
}
```

## Configuration

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome'],
  browserApi: 'bundle',
  manifest: {
    name: 'React Popup',
    version: '1.0.0',
    permissions: ['storage'],
  },
});
```

## Build

```bash
addonova build
```

The popup HTML, script, CSS, and bundled React code land in `dist/chrome/`.

## Notes

- The HTML entrypoint does not need a `definePage()` wrapper.
- Import the browser API from the package root so bundle mode can map it.
- Keep `index.html` in a directory; `popup/index.html` outputs `popup.html`.
