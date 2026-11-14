---
title: Getting started
description: Install Addonova, scaffold a project, and run a first build.
---

# Getting started

## Requirements

- Node.js 20 or newer.
- A Chromium browser, Microsoft Edge, or Firefox for `addonova dev`.

## Install

Add Addonova to a project:

```bash
npm install --save-dev addonova
npm install @addonova/browser
```

Or scaffold a complete project:

```bash
npx addonova init my-extension
cd my-extension
npm install
```

Bundled templates are `vanilla-ts`, `vanilla-js`, and `react`. Use a remote
template with a `gh:` source:

```bash
npx addonova init my-extension --template gh:owner/repo/path#ref
```

## First build

```bash
npx addonova build
```

By default the build targets Chrome with Manifest V3 and writes to `dist/chrome/`:

```text
dist/
└── chrome/
    ├── manifest.json
    ├── background.js
    └── ...
```

Build several targets:

```bash
npx addonova build --browser chrome --browser firefox
```

## Development

```bash
npx addonova dev
```

`dev` watches the project, rebuilds on change, launches each configured
browser, and reloads the extension after successful rebuilds.

## Package

```bash
npx addonova pack
```

Archives are written beside the output unless `pack.outFile` is configured.
For Firefox review, add `--sources` or set `pack.sources`.

Next: [Core concepts](core-concepts.md).
