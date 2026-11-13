# Changelog

All notable changes to `addonova` are documented here.


## [Unreleased]

### Added

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


