# Browser API Addonova Example

This example builds a Chrome and Firefox extension that imports from
`@addonova/browser` in bundle mode. Addonova aliases the package root to the
target-specific subpath and bundles only the selected adapter.

## Requirements

Install the runtime package in this example (or in the parent project) before
building:

```bash
npm install @addonova/browser
```

## Build

From the repository root:

```bash
npm run build
node dist/cli/index.js --config examples/browser-api/addonova.config.ts build
```

The build writes `examples/browser-api/dist/chrome` and
`examples/browser-api/dist/firefox`.

Firefox uses a background event page (`background.scripts`) while Chrome uses a
service worker. Addonova generates the correct manifest per target.

## Develop

```bash
node dist/cli/index.js --config examples/browser-api/addonova.config.ts dev
```

## How the integration works

`browserApi: 'bundle'` produces these bundler settings per target:

```text
alias:  @addonova/browser -> @addonova/browser/<chrome|chromium|edge|firefox>
define: __ADDONOVA_BROWSER__ = "<target>"
```

Application code keeps importing from the package root:

```ts
import { runtime, storage } from '@addonova/browser';
```

Alias and externalization are mutually exclusive. Use `browserApi: 'external'`
(the default) when the extension resolves the package at runtime instead.
