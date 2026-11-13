# Changelog

All notable changes to `addonova` are documented here.


## [Unreleased]

### Added

- File-based entrypoint discovery under `src/entrypoints/`, including
  background, content scripts, HTML pages, styles, and assets.
- `defineBackground`, `defineContentScript`, `defineUnlistedScript`,
  `definePage`, and content script context helpers through the `addonova/defines`
  subpath.
- Manifest synthesis for background, content scripts and CSS, popup, options,
  side panel, devtools, sandbox, and URL overrides.
- Manifest functions with a per-target context, `package.json` name/version
  defaults, prerelease `version_name` handling, and icon auto-discovery.
- Dotenv loading with `import.meta.env` defines for mode, browser, manifest
  version, `ADDONOVA_*`, and `VITE_*` variables.
- Automatic MV2/MV3 conversion for action, host permissions, background, and web
  accessible resources, with an opt-out `convertManifest` setting.
- `srcDir`, `entrypointsDir`, and per-entrypoint browser `include`/`exclude`
  configuration.
- `addonova init [directory]` command that scaffolds a working extension
  without loading a project configuration.
- Bundled `vanilla-ts`, `vanilla-js`, and `react` templates, plus the `vanilla`
  alias for `vanilla-ts`.
- Templates now depend on `@addonova/browser` and use it with
  `browserApi: 'bundle'` in background, content, and popup code.
- Remote templates through `giget` using `gh:owner/repo[/path][#ref]` sources.
- `--template`, `--pm`, `--git`/`--no-git`, `--force`, and `--offline` init
  options.
- `initProject`, template metadata, package-manager detection, and related types
  exported from the public API.
- Unit and integration coverage for scaffolding, generated project builds, and
  git handling.
- Native browser launcher for `addonova dev`, supporting Chrome, Chromium, Edge,
  and Firefox without depending on `web-ext`.
- Automatic browser binary detection per platform, plus custom executables via
  `webExt.binaries`.
- `webExt` configuration for `chromiumArgs`, `firefoxArgs`, `startUrls`,
  persistent profiles, `keepProfileChanges`, and `disabled`.
- Global `~/.addonova/web-ext.config.{ts,js,mjs,json}` and project
  `web-ext.config.*` files merged with `addonova.config.*`, with
  `defineWebExtConfig()`.
- Isolated temporary browser profiles by default, with cleanup on shutdown and
  persistent profile support.
- Chromium extension loading through CDP over `--remote-debugging-pipe` with a
  `--load-extension` fallback, and Firefox extension loading through WebDriver
  BiDi.
- Automatic extension reload after successful rebuilds, relaunch after browser
  exits, and non-fatal launch warnings.
- Development auto-reload: a loopback WebSocket client is injected into the
  background script or service worker to reload matching tabs and the extension
  after successful rebuilds.
- Development-only manifest additions: `tabs`, MV3 `scripting`, and a
  ` (Development)` name suffix.
- `--debug` for structured JSON dev lifecycle diagnostics on stderr.
- Extensibility hooks: `config:resolved`, `entrypoints:found`,
  `entrypoints:resolved`, `build:manifestGenerated`, `build:publicAssets`,
  `build:done`, and `dev:reload`, with deterministic module-then-config ordering.
- Module system with `modules` configuration, automatic `modules/*` discovery,
  `defineAddonovaModule()`, module entrypoints, aliases, generated files, and
  typed hooks.
- Generated asset writing for `build:publicAssets`, exported as
  `writeGeneratedAssets()`.
- `ADDONOVA_HOOK_FAILED`, `ADDONOVA_MODULE_LOAD_FAILED`,
  `ADDONOVA_MODULE_INVALID`, `ADDONOVA_MODULE_SETUP_FAILED`,
  `ADDONOVA_MODULE_DUPLICATE`, and `ADDONOVA_GENERATED_ASSET_INVALID`
  diagnostics.
- `ADDONOVA_WEB_EXT_CONFIG_LOAD_FAILED`, `ADDONOVA_WEB_EXT_CONFIG_INVALID`,
  `ADDONOVA_BROWSER_NOT_FOUND`, `ADDONOVA_BROWSER_LAUNCH_FAILED`, and
  `ADDONOVA_BROWSER_EXTENSION_LOAD_FAILED` diagnostics.
- Public exports for launcher configuration, browser detection, adapters, and
  launcher types.

### Changed

- `addonova dev` now launches configured browsers and reloads the extension on
  rebuilds.
- Build and dev now run public-asset and manifest hooks for every target and
  merge module-provided aliases into the bundler alias map.
- Editing a module file in `dev` reloads configuration and module setup before
  rebuilding.
- Dev rebuilds now print cycle timing and target success counts; launcher reloads
  are skipped when an injected reload client handles the rebuild.
- Dev output is published in place while a browser is running so Windows file
  locks are avoided; the directory swap is still used when no browser is
  running.

- Bundled templates now use convention-based `src/entrypoints/` layouts and
  `define*` helpers instead of explicit entrypoint configuration.

### Fixed

- `browserApi: 'bundle'` now detects installed ESM-only browser API packages
  that do not expose a CommonJS `require` export.

## [1.0.6] - 2026-11-10

### Added

- `browserApi` configuration option with `external` and `bundle` modes.
- `--browser-api <external|bundle>` CLI option.
- Per-target aliasing of `@addonova/browser` to its browser-specific subpath in
  bundle mode.
- `__ADDONOVA_BROWSER__` compile-time definition in bundle mode.
- `ADDONOVA_BROWSER_API_NOT_FOUND` diagnostic when bundle mode is selected but
  the package cannot be resolved.
- Optional peer dependency on `@addonova/browser`.

### Changed

- `@addonova/browser` externalization is now controlled by configuration instead
  of being forced by the Guchho adapter.
- `addonova info` reports the active browser API mode.
- `build` and `dev` summaries now show output files and sizes instead of a
  compact output count.
- `info` prints an aligned key/value table.
- `validate`, `clean`, and `pack` use styled success, warning, and error output.

### Notes

- `external` remains the default mode, so existing projects keep their current
  behavior.
- Alias and externalization are mutually exclusive; bundle mode never
  externalizes `@addonova/browser`.


