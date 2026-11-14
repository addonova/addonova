---
title: Why Addonova
description: The design choices behind Addonova's extension-first build model.
---

# Why Addonova

Browser extensions are not ordinary web apps. They have a manifest, browser
targets, background contexts, content scripts, and store packaging. Addonova
puts those concerns at the center instead of layering them on afterward.

## File conventions first

A file named `background.ts` or `popup.html` already says what it is. Addonova
scans `src/entrypoints/` and derives manifest roles from file names, then lets
explicit configuration override discovery when needed.

## One project, many targets

The same source builds for Chrome, Chromium, Edge, and Firefox. Addonova
converts manifest fields per target instead of asking every project to maintain
separate manifests.

## MV3-first, MV2-aware

Manifest V3 is the default. Addonova still understands Manifest V2 background
scripts, browser actions, and host permissions, and reports mismatches instead
of silently producing invalid manifests.

## A small, deterministic extension layer

Addonova owns configuration, entrypoints, manifest generation, and packaging.
Guchho owns parsing and bundling. The boundary stays explicit, which keeps
builds predictable and makes it possible to swap the backend later.

## Extensible without a plugin framework

Hooks and modules cover generated files, shared entrypoints, aliases, and
manifest adjustments. They run in-process, in a documented order, and fail
loudly with stable error codes.

Continue with [Core concepts](core-concepts.md).
