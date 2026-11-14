---
title: Addonova Documentation
description: Next-gen browser extension framework for Chrome, Chromium, Edge, and Firefox.
---

# Addonova Documentation

Addonova builds browser extensions from TypeScript and JavaScript with
file-based entrypoints, manifest synthesis, MV2/MV3 conversion, browser
launching, auto-reload, and packaging.

These docs are plain Markdown. Every directory has a `README.md` that acts as
its index, so the whole tree is readable directly on GitHub.

## Start here

- [Introduction](guide/introduction.md) - what Addonova is and how it thinks.
- [Getting started](guide/getting-started.md) - install, scaffold, and build.
- [Core concepts](guide/core-concepts.md) - entrypoints, manifests, targets.

## Contents

### Guide - learning-oriented

| Page | What it covers |
| --- | --- |
| [Introduction](guide/introduction.md) | The extension-first model |
| [Getting started](guide/getting-started.md) | Install, scaffold, build |
| [Why Addonova](guide/why-addonova.md) | File conventions and one build graph |
| [Core concepts](guide/core-concepts.md) | Entrypoints, manifests, targets |
| [Configuration](guide/configuration.md) | `addonova.config.*` and defaults |
| [CLI overview](guide/cli-overview.md) | Every command at a glance |
| [Entrypoints](guide/entrypoints.md) | Conventions and define helpers |
| [Manifest versions](guide/manifest-versions.md) | MV2/MV3 conversion |
| [Browser targets](guide/browser-targets.md) | Chrome, Chromium, Edge, Firefox |
| [Development workflow](guide/development-workflow.md) | Watch, reload, launch |
| [Production builds](guide/production-builds.md) | Build, validate, pack |
| [Hooks and modules](guide/hooks-and-modules.md) | Extend the build |
| [Runtime and browser API](guide/runtime-and-browser-api.md) | `@addonova/browser` |
| [Limitations](guide/limitations.md) | Known constraints |

### Reference - look-up material

- [CLI reference](reference/cli/README.md) - every command and option.
- [Configuration reference](reference/config/README.md) - every option.
- [Error codes](reference/error-codes.md) - stable diagnostics.
- [Environment variables](reference/environment-variables.md) - dotenv and defines.
- [Exit codes](reference/exit-codes.md) - what a run returns.
- [Manifest fields](reference/manifest-fields.md) - generated and validated fields.

### API - programmatic surface

- [API overview](api/README.md) - public exports.
- [Configuration types](api/config.md) - `AddonovaUserConfig` and friends.
- [Define helpers](api/defines.md) - `addonova/defines`.
- [Modules](api/modules.md) - module API.
- [Hooks](api/hooks.md) - hook payloads and ordering.
- [Build](api/build.md) - build, analyze, clean, and doctor APIs.
- [Packaging](api/packaging.md) - `packProject()` and archive names.
- [Diagnostics](api/diagnostics.md) - errors and diagnostics.
- [Launcher](api/launcher.md) - browser launch and discovery.
- [Manifest and locales](api/manifest-and-locales.md) - manifest and locale helpers.
- [Utilities](api/utilities.md) - init, env, globs, entrypoints, dev.

### More

- [Recipes](recipes/README.md)
- [Resources](resources/README.md)
- [Release notes](release-notes/README.md)
- [Blog](blog/README.md)
- [Versions](versions/README.md)

---

Addonova is licensed under **MIT**. Copyright © [CodeHemu](https://github.com/code-hemu).
