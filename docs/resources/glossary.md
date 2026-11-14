---
title: Glossary
description: Terms used throughout the Addonova documentation.
---

# Glossary

**Addonova**
: The build and development framework documented here.

**Browser target**
: One of `chrome`, `chromium`, `edge`, or `firefox`.

**Manifest version**
: The WebExtension manifest format, `2` or `3`. All targets default to `3`.

**Entrypoint**
: A script, HTML page, style, or asset that becomes part of an extension build.
Discovered from `src/entrypoints/` or declared in `entrypoints`.

**Define helper**
: A function from `addonova/defines` that attaches metadata and runs `main`, such
as `defineBackground()` or `defineContentScript()`.

**Content script**
: Code injected into matching web pages. Declares `matches` and optional run
timing, frames, and world.

**Background script**
: MV2 persistent or event page context.

**Service worker**
: MV3 background context.

**Module**
: A setup function that contributes entrypoints, aliases, generated files, and
hooks. Configured in `modules` or discovered from `modules/`.

**Plugin**
: An object with `name` and optional `buildStart`, `transform`, and `buildEnd`.

**Hook**
: A lifecycle callback such as `config:resolved` or `build:manifestGenerated`.

**Resolved config**
: The normalized configuration produced from the user config, CLI overrides,
defaults, and modules. Represented by `ResolvedConfig`.

**Outdir**
: The generated output directory, `dist` by default.

**Public directory**
: Files copied into each target output, `public` by default.

**Browser API mode**
: `external` keeps `@addonova/browser` out of the bundle; `bundle` aliases it to
the target adapter and bundles it.

**Diagnostic**
: A structured `{ code, severity, message }` report.

**Dev session**
: The watch, rebuild, browser launch, and reload loop used by `addonova dev`.

**Source archive**
: A Firefox submission archive containing sources needed to rebuild the
extension.

**Deterministic pack**
: Packing with a fixed archive timestamp so unchanged output produces identical
bytes.

**MV2 / MV3**
: Short names for Manifest V2 and Manifest V3.
