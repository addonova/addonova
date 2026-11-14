---
title: Introduction
description: What Addonova is and the model it uses for browser extensions.
---

# Introduction

Addonova is a build framework for browser extensions. It turns a small project
tree into complete, browser-specific extension output for Chrome, Chromium,
Edge, and Firefox.

A typical project has entrypoints, a manifest, public assets, and optionally
modules and hooks:

```text
my-extension/
├── addonova.config.ts
├── package.json
├── public/
│   └── icons/
└── src/
    └── entrypoints/
        ├── background.ts
        ├── content.ts
        ├── popup.html
        └── popup.ts
```

```bash
npx addonova dev
npx addonova build --browser chrome --browser firefox
npx addonova pack
```

## What Addonova handles

- Entrypoint discovery from file names and HTML meta tags.
- Manifest synthesis, deep merging, and per-target overrides.
- MV2/MV3 conversion and validation for each browser target.
- JavaScript, TypeScript, HTML, CSS, and asset bundling through Guchho.
- Localized manifests from `_locales` sources.
- Browser launching, watch mode, and extension auto-reload.
- ZIP, TAR, and TAR.GZ packaging, including Firefox source archives.
- Build diagnosis with `doctor` and `analyze`.

## What Addonova does not do

- It does not publish to extension stores.
- It does not replace the extension runtime. Runtime helpers live in the
  separate `@addonova/browser` package.
- It does not sandbox hooks or modules.

## The shape of a build

1. Discover and resolve configuration.
2. Collect entrypoints from conventions and explicit config.
3. Run modules and resolve entrypoint hooks.
4. Build assets with Guchho for each browser target.
5. Generate and validate the manifest.
6. Copy public files and generated assets.
7. Report output or package the result.

Continue with [Getting started](getting-started.md).
