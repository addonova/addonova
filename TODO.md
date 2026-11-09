# Addonova Implementation TODO

Status: Phase 5 complete. Phase 6 not started.

This file is the execution plan for the full specification in `PLAN.md`.
Complete phases in order. Do not start a phase until the previous phase's exit
criteria are met.

## Decisions

- Bundler: use the real `guchho@1.0.9` package and its published Node.js API.
- Bundler integration: dedicated adapter behind an Addonova-owned interface.
- `@addonova/browser`: future separate package. Do not add it as a dependency in
  v1 and do not couple the build engine to it.
- Runtime browser compatibility: independent from bundler and manifest logic.
- Manifest versions: build each browser's default version. `--manifest-version`
  overrides it.
- Output layout: `dist/<browser>` for one manifest version per browser.
  Use `dist/<browser>-mv2` and `dist/<browser>-mv3` only when both versions are
  built for the same browser.
- Package manager: npm. Node.js 20 or newer. ESM-first. Strict TypeScript.
- File watching: `chokidar`, paired with Guchho warm `context.rebuild()`.
- Tests: Vitest. Integration tests use temporary fixtures, never real browsers.
- Do not publish to npm without explicit authorization.

## Guchho 1.0.9 Constraints

These are verified constraints from the published package and type declarations.
The adapter must respect them.

- `build`, `context`, `watch`, `serve`, `pack`, `unpack`, `analyze`, `transform`,
  `stop`, and `version` are the relevant exports.
- `Plugin.transform` is declared but not run by the engine. Bridge Addonova
  transforms through the `load` hook for code modules, or post-process generated
  HTML where required.
- `PluginContext.resolve` rejects in this version. Do not depend on it.
- `PluginContext.emitFile` supports assets only.
- `watch()` is request-driven, not push-based. Use a separate file watcher and
  call `context.rebuild()`.
- A build has one `format`. Extension scripts default to `iife`, `bundle: true`,
  and `splitting: false`.
- `bundle` defaults to `false`. Set it to `true` explicitly.
- `pack()` names each input by its last path component. Pass every top-level
  child of the output directory so `manifest.json` lands at the archive root.
- Script entrypoint `out` names omit the extension; Guchho appends the loader
  extension. `{ out: 'background' }` becomes `background.js`. HTML entrypoint
  `out` names include `.html`.
- HTML-referenced scripts, styles, and assets are emitted under `assets/` with
  hashed names, and the HTML references are rewritten.
- `stop()` must run before deleting output on Windows because the native service
  keeps output files open.
- Installation depends on a platform native binary and `postinstall`.
- Npm 12 requires approval for the Guchho install script. The repository uses
  `allowScripts` in `package.json`.
- `guchho@1.0.9` lists unpublished optional platform packages, so `npm ci`
  rejects the generated lockfile. `package-lock.json` is temporarily ignored;
  `.npmrc` sets `include=optional` so Vitest's Rolldown binding is installed.
- Guchho does not generate `manifest.json`. Addonova writes it after the asset
  build.
- `BuildResult` provides `errors`, `warnings`, `outputs`, `inputs`, `metafile`,
  and `duration`. Map these into Addonova diagnostics and reporting.

## Target Architecture

```text
src/
├── cli/
│   ├── index.ts
│   └── commands/
│       ├── build.ts
│       ├── dev.ts
│       ├── clean.ts
│       ├── info.ts
│       ├── validate.ts
│       └── pack.ts
├── core/
│   ├── build.ts
│   ├── config.ts
│   ├── context.ts
│   └── errors.ts
├── browser/
│   ├── targets.ts
│   ├── compatibility.ts
│   └── manifest.ts
├── bundler/
│   ├── adapter.ts
│   ├── guchho.ts
│   └── index.ts
├── dev/
│   └── watcher.ts
├── plugins/
│   ├── types.ts
│   └── manager.ts
├── pack/
│   └── archive.ts
├── utils/
└── index.ts
tests/
├── unit/
├── integration/
└── fixtures/
```

## Phase 0 - Guchho Validation and Scaffold

Exit criteria: Guchho is proven usable on this platform, its output semantics are
understood, and the repository has a strict TypeScript/Vitest scaffold. Do not
build the full engine in this phase.

- [x] Inspect the repository and `PLAN.md`.
- [x] Confirm `guchho@1.0.9` metadata, exports, declarations, and limitations.
- [x] Persist this plan as `TODO.md`.
- [x] Create `package.json` with ESM, `bin.addonova`, and Node `>=20`.
- [x] Pin `guchho` to `1.0.9`.
- [x] Run `npm install` and confirm the native binary installs on Windows.
- [x] Add a smoke check for `guchho.version`.
- [x] Create a fixture with HTML, TypeScript, CSS, an imported module, and an asset.
- [x] Verify `bundle: true` inlines imported modules.
- [x] Verify `format: 'iife'` produces extension-safe scripts.
- [x] Verify explicit entrypoint output names.
- [x] Verify HTML script and stylesheet references are rewritten correctly.
- [x] Verify asset output paths and `BuildResult.outputs`.
- [x] Verify `metafile: true` returns a usable dependency graph.
- [x] Verify an Addonova transform bridged through Guchho's `load` hook changes
      emitted code.
- [x] Verify `pack()` with top-level output children puts `manifest.json` at the
      ZIP root.
- [x] Verify `unpack()` can inspect the produced archive.
- [x] Verify `stop()` releases output files so the directory can be removed on
      Windows.
- [x] Add `tsconfig.json`, `tsconfig.build.json`, and Vitest configuration.
- [x] Add `src/index.ts`, `src/bundler/adapter.ts`, and `src/bundler/guchho.ts`
      skeletons only after smoke checks pass.
- [x] Add the diagnostic model: code, severity, file, line, column, message,
      suggestion, and underlying error.
- [x] Add an initial README skeleton.
- [x] Verify a clean `npm install` installs Guchho and the Vitest Rolldown binding.
- [x] Run `npm run typecheck`, `npm test`, and the Phase 0 smoke script.

Stop after Phase 0. Report results before beginning Phase 1.

### Phase 0 Results

- Guchho `1.0.9` imports successfully and reports the expected version.
- The native Windows binary is installed and the Guchho install script is
  approved through `allowScripts`.
- The smoke fixture proves module bundling, IIFE output, explicit entrypoint
  naming, HTML rewriting, hashed assets, and metafile generation.
- The load-hook transform bridge changes emitted code as required.
- `pack()` with top-level output children produces an archive with
  `manifest.json` at the root; `unpack()` confirms the layout.
- `stop()` releases output files before directory removal on Windows.
- `npm run typecheck`, `npm test`, `npm run build`, `npm run phase0`, and
  `npm pack --dry-run` pass.
- A clean `npm install` creates a working Guchho install and Vitest runner.
- Known upstream issue: `guchho@1.0.9` lists unpublished optional platform
  packages, so `npm ci` rejects its lockfile. The lockfile is temporarily
  ignored and `.npmrc` sets `include=optional`.

## Phase 1 - CLI and Configuration

Exit criteria: the CLI parses commands and flags, discovers and validates config,
and `info` reports useful environment data.

- [x] Implement CLI entrypoint and `addonova` binary.
- [x] Implement `--version`, `--help`, `--browser`, `--manifest-version`,
      `--mode`, `--config`, `--outdir`, `--minify`, `--sourcemap`, and
      `--verbose`.
- [x] Implement commands: `build`, `dev`, `clean`, `info`, `validate`, `pack`.
- [x] Add config discovery for `addonova.config.ts`, `.js`, `.mjs`, and `.json`
      in that priority order.
- [x] Use the nearest configuration file.
- [x] Implement `defineConfig()`.
- [x] Validate config with clear errors.
- [x] Apply CLI-over-config precedence.
- [x] Normalize config into an internal model with resolved absolute paths.
- [x] Implement `info` output: Addonova version, Node version, config path,
      targets, output directories, and environment.
- [x] Add unit tests for parsing, discovery, precedence, and normalization.
- [x] Add `ADDONOVA_*` diagnostic codes for configuration and CLI failures.

### Phase 1 Results

- CLI parses all commands and supported flags, including `--no-minify`,
  `--no-sourcemap`, and `--sourcemap=<mode>`.
- Config discovery checks `.ts`, `.js`, `.mjs`, and `.json`, preferring the
  nearest directory and the first supported filename in priority order.
- TypeScript and JavaScript configs load through Jiti; JSON configs load through
  the same path.
- Config normalization resolves absolute paths, validates entrypoints and
  browsers, derives entrypoint names/kinds, merges browser overrides, and applies
  CLI-over-config precedence.
- `info` reports versions, config path, project root, mode, output paths,
  minification, source maps, entrypoints, browsers, and manifest identity.
- Commands other than `info` report explicit phase guidance until their
  implementation phases.
- `npm run typecheck`, `npm test` (25 tests), `npm run build`, and
  `npm run phase0` pass.

## Phase 2 - Build Engine and Guchho Adapter

Exit criteria: a fixture project builds valid extension assets through the real
Guchho adapter without manifest generation.

- [x] Define the Addonova-neutral `BundlerAdapter` interface.
- [x] Implement the real Guchho adapter.
- [x] Map Addonova inputs to Guchho `BuildOptions` without inventing APIs.
- [x] Set `bundle: true`, `splitting: false`, `platform: 'browser'`, and
      extension-safe `format: 'iife'` by default.
- [x] Map entrypoints to explicit Guchho `EntryPoint` output names.
- [x] Resolve and validate entrypoints; reject duplicate output names.
- [x] Process TypeScript, JavaScript, CSS, HTML, JSON, and static assets.
- [x] Support HTML entrypoints and rewritten references.
- [x] Copy `public/` assets without overwriting generated files.
- [x] Collect `BuildResult.outputs`, `inputs`, and `metafile`.
- [x] Map `BuildFailure` errors and Guchho warnings into Addonova diagnostics.
- [x] Preserve underlying bundler error text and locations.
- [x] Bridge Addonova transforms through Guchho's `load` hook.
- [x] Keep `@addonova/browser` external by default.
- [x] Add unit tests for path/entry mapping and diagnostics.
- [x] Add an integration test that builds a temporary project.

### Phase 2 Results

- The Guchho adapter maps Addonova inputs to `BuildOptions`, defaults to IIFE,
  browser platform, bundling, no splitting, production tree shaking/minification,
  overwrite-enabled repeated builds, and silent logs.
- Entrypoints use explicit Guchho output names; script/style outputs omit
  extensions, HTML outputs include `.html`, and duplicate names are rejected.
- `BuildFailure` and service errors are translated into actionable Addonova
  errors; Guchho messages preserve text, file, line, column, and suggestions.
- Build results expose outputs, inputs, duration, warnings/errors, and metafile.
- The transform bridge uses Guchho's `load` hook because Guchho 1.0.9 does not run
  `Plugin.transform`.
- `@addonova/browser` remains external by default.
- `public/` files are copied after successful builds, skipping generated-path
  collisions with warnings and skipping symlinks.
- The CLI `build` command builds every configured browser into
  `dist/<browser>` and reports status, duration, output count, warnings, and
  errors.
- `npm run typecheck`, `npm test` (34 tests), `npm run build`, `npm run phase0`,
  and `npm pack --dry-run` pass. A spawned CLI build exits cleanly after
  `dispose()` stops Guchho.

## Phase 3 - Browser Targets and Manifests

Exit criteria: Chrome, Chromium, Edge, and Firefox outputs are generated with
valid, browser-specific manifests and no silent feature removal.

- [x] Add targets for Chrome, Chromium, Edge, and Firefox.
- [x] Model default and allowed manifest versions per target.
- [x] Generate `manifest.json` outside the bundler adapter.
- [x] Merge base manifest with browser-specific overrides.
- [x] Support MV2 and MV3 background shapes.
- [x] Support action/browser_action differences with explicit diagnostics.
- [x] Validate required manifest properties.
- [x] Validate referenced files exist in the final output.
- [x] Report unsupported properties, permissions, and APIs as warnings or errors.
- [x] Never silently strip unsupported fields.
- [x] Implement `dist/<browser>` and collision output rules.
- [x] Implement `validate` without writing output.
- [x] Add manifest, compatibility, and target tests.

### Phase 3 Results

- Chrome, Chromium, Edge, and Firefox targets declare their default and allowed
  manifest versions, and Firefox declares its browser-specific settings and
  sidebar capabilities.
- Manifests are generated outside the bundler adapter by deep-merging the base
  manifest with per-browser overrides, so nested fields are preserved instead of
  replaced.
- MV2 and MV3 background shapes are supported and mismatches are reported with
  target-aware warnings; unsupported fields are always preserved.
- Action/browser_action, host permission, browser-specific field, and restricted
  permission differences produce explicit diagnostics instead of silent removal.
- Required manifest fields, version syntax, object shapes, content scripts, and
  web-accessible resources are validated.
- Build-time validation checks manifest file references against the final output
  directory. `addonova validate` checks manifests without writing output.
- Outputs use `dist/<browser>`, switching to `dist/<browser>-mv2` and
  `dist/<browser>-mv3` when both versions of one browser are present.
- `npm run typecheck` and `npm test` (49 tests, including all-target manifest
  generation) pass.

## Phase 4 - Development Workflow

Exit criteria: `addonova dev` watches sources, rebuilds through warm Guchho
contexts, keeps the last successful output, and shuts down cleanly.

- [x] Add `chokidar` as the file watcher.
- [x] Create one warm Guchho `context` per target.
- [x] Debounce changes and call `context.rebuild()`.
- [x] Classify changes: config, manifest, entrypoint, source, asset, unknown.
- [x] Recreate contexts when config or target settings change.
- [x] Build to a temporary directory and swap after success.
- [x] Preserve the last successful output when a rebuild fails.
- [x] Print clear status, duration, warnings, and errors.
- [x] Handle SIGINT and process cleanup.
- [x] Dispose contexts and call `stop()` on shutdown.
- [x] Do not require a browser installation.
- [x] Add watcher and rebuild strategy tests.

### Phase 4 Results

- `chokidar` watches the project root and config file, ignoring build output and
  dependency/VCS directories.
- Changes are classified as config, manifest, entrypoint, source, asset, or
  unknown, and rebuilds are debounced.
- One warm Guchho context is created per configured target; config changes reload
  configuration and recreate contexts while preserving the previous target set if
  reloading or context creation fails.
- Each context builds into a generation-specific staging directory. Successful
  builds copy only current outputs, public files, and the manifest into a swap
  directory, then replace the published output. Failed builds leave the last
  successful output untouched.
- Manifest file references are checked against the current build's available
  files rather than stale staging files.
- Dev builds reuse the same transform bridge, public-copy rules, diagnostics, and
  browser-specific manifest generation as production builds.
- SIGINT and SIGTERM abort the CLI dev command, which closes the watcher, disposes
  contexts, and calls Guchho `stop()`.
- `npm run typecheck`, `npm test` (55 tests), `npm run build`, and
  `npm run phase0` pass.

## Phase 5 - Production Builds and Packaging

Exit criteria: production output is optimized, cleanable, and packable with
`manifest.json` at the archive root.

- [x] Enable Guchho `minify` and `minifyHtml` in production.
- [x] Support CSS minification through Guchho.
- [x] Enable tree shaking and dead-code elimination deliberately.
- [x] Support source maps in development and by configuration.
- [x] Ensure minified output keeps extension behavior valid.
- [x] Implement `clean` with `stop()` before deleting output.
- [x] Implement `pack` using Guchho `pack()` if Phase 0 confirms root layout.
- [x] Fall back to a dedicated ZIP library only if Guchho cannot preserve the
      archive root.
- [x] Support deterministic archive names and timestamps.
- [x] Refuse to overwrite an existing archive unless configured.
- [x] Verify archive contents and root `manifest.json`.
- [x] Verify `npm pack` excludes tests, fixtures, and development files.

### Phase 5 Results

- Production builds enable Guchho `minify`, `minifyHtml`, CSS minification, and
  deliberate tree shaking/dead-code elimination. Minified scripts keep their
  IIFE wrapper and runtime behavior.
- Source maps are enabled by default in development and can be enabled in
  production through `sourcemap` configuration or CLI overrides.
- `clean` disposes the Guchho service with `stop()` before removing output and
  refuses unsafe output directories that contain the project, entrypoints,
  public files, or the configuration file.
- `pack` uses Guchho `pack()` with every top-level output child as an input, so
  `manifest.json` stays at the archive root. ZIP, TAR, and TAR.GZ formats are
  supported, and a dedicated ZIP fallback was not needed.
- Archive names are derived from target, manifest version, and extension
  version. Deterministic packs use a fixed 1980-01-01 timestamp and produce
  byte-identical archives.
- Existing archives are refused unless `pack.overwrite` is enabled. Missing
  build output and ambiguous single `outFile` values for multiple targets
  produce actionable errors.
- `npm pack` includes only `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, and
  `package.json`; tests, fixtures, source files, and stale development modules
  are excluded.
- `npm run typecheck`, `npm test` (70 tests), and `npm run build` pass after a
  clean rebuild.

## Phase 6 - Plugins, Runtime Boundary, and Documentation

Exit criteria: the plugin API works within Guchho's real capabilities, and the
runtime boundary is documented without claiming unsupported integration.

- [x] Implement the Addonova plugin interface: `buildStart`, `transform`, and
      `buildEnd`.
- [x] Register and order plugins deterministically.
- [x] Bridge `transform` through Guchho `load`.
- [x] Document that Guchho 1.0.9 does not execute `Plugin.transform` directly.
- [x] Report plugin errors with plugin name and source location.
- [x] Do not expose unsupported Guchho hooks as if they work.
- [x] Keep `@addonova/browser` optional and external.
- [x] Document the future separate `@addonova/browser` package boundary.
- [x] Add working examples for HTML, background, content script, and assets.
- [x] Complete README sections 1-17 from `PLAN.md`.

### Phase 6 Results

- `AddonovaPlugin` exposes only `name`, `buildStart`, `transform`, and
  `buildEnd`. Unknown hooks are rejected during config normalization, and
  plugin names must be unique and non-empty.
- Plugins run in registration order. Lifecycle hooks run once per build target,
  and `buildEnd` runs only after `buildStart` succeeded.
- Guchho 1.0.9 does not execute `Plugin.transform`, so Addonova creates one
  Guchho plugin per transform and bridges it through the `load` hook. This
  limitation is documented instead of exposing unsupported Guchho hooks.
- Transform and lifecycle failures report the plugin name, hook, source file,
  message, and suggestion. Precise plugin diagnostics replace Guchho's coarser
  plugin error copy.
- `@addonova/browser` remains external in every build and is not published or
  injected by this repository. README documents the future separate package
  boundary.
- `examples/basic` builds a real extension with an HTML popup, TypeScript and
  CSS, a background service worker, a content script, an imported SVG, and a
  public icon. An integration test builds the example and verifies the manifest
  and output files.
- README now covers all 17 required sections.
- `npm run typecheck` and `npm test` (79 tests) pass.

## Phase 7 - Hardening and Acceptance

Exit criteria: every acceptance criterion in `PLAN.md` section 20 is verified.

- [x] Add fixtures for Chrome MV2, Chrome MV3, Edge, and Firefox.
- [x] Add Windows path, file-lock, and cleanup tests.
- [x] Add tests for Guchho service lifecycle and repeated builds.
- [x] Add tests for diagnostics and exit codes.
- [x] Verify `npm install` succeeds from a clean checkout.
- [x] Verify `npm run build` succeeds.
- [x] Verify `npm test` passes.
- [x] Verify `npm run typecheck` passes.
- [x] Verify `addonova --version` works.
- [x] Verify `addonova build --browser chrome` works.
- [x] Verify `addonova build --browser firefox` works.
- [x] Verify `addonova build --browser edge` works.
- [x] Verify generated outputs are independently loadable.
- [x] Verify manifest validation works.
- [x] Verify production builds work.
- [x] Verify `addonova clean` works.
- [x] Verify `addonova pack` works.
- [x] Verify README examples match actual behavior.
- [x] Verify `npm pack` succeeds.
- [x] Review all diagnostics for actionable codes and suggestions.
- [x] Review dependencies for necessity and license compatibility.

### Phase 7 Results

- Added target fixtures covering Chrome MV2, Chrome MV3, Edge MV3, and Firefox MV3 with HTML, background, content script, and public assets. A dedicated integration test verifies per-target manifests, actions/browser_action, background shapes, Firefox-specific settings, and loadable outputs.
- Added hardening coverage: repeated builds across Guchho service restarts, build and CLI dispose/lifecycle behavior, unsafe clean directory rejection, Windows space-path builds/cleans, missing pack output diagnostics, CLI build failures with exit codes, and Windows path separator normalization in config resolution.
- Added `scripts/acceptance-smoke.mjs` and `npm run acceptance`. The acceptance run verifies `--version`, builds all four targets in production, validates manifests, packs Chrome MV3, unpacks and inspects the archive root, cleans output, and builds the `examples/basic` project.
- `npm install`, `npm run typecheck`, `npm run build`, `npm run phase0`, `npm run acceptance`, and `npm test` all pass (90 tests). Diagnostics use `ADDONOVA_*` codes with suggestions across config, bundler, manifest, plugins, dev, pack, and clean flows.
- `npm pack --dry-run` includes only `dist`, `README.md`, `LICENSE`, `package.json` (and the published files set). Dependencies are limited to runtime/build tooling and all have compatible licenses (MIT/Apache-2.0).

## Non-Goals for v1

- Browser launching and automatic extension reloading.
- Injecting runtime compatibility code.
- Publishing `@addonova/browser` from this repository.
- Implementing a full Rollup-compatible plugin framework.
- Claiming compatibility that is not validated by target rules and tests.
- Automatic conversion of unsupported manifest fields or browser APIs.
