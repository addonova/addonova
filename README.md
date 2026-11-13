# Addonova

Next-generation browser extension framework.

Addonova is a TypeScript-first build tool for browser extensions. It targets
Chrome, Chromium, Edge, and Firefox, supports Manifest V2 and V3 where each
browser supports them, and keeps browser compatibility separate from the build
engine.

## 1. Introduction

Addonova turns a small configuration file and a set of entry points into one
independently loadable extension directory per browser target. JavaScript,
TypeScript, CSS, HTML, and static assets are processed through a bundler adapter,
then Addonova writes a browser-specific `manifest.json`.

The build engine is separate from browser compatibility rules, from the runtime
helper package, and from the bundler integration. That separation keeps output
predictable and makes validation explicit.

Status: implementation phases 0 through 7 are complete, and `@addonova/browser`
is integrated through the `external` and `bundle` modes. The `init` command
scaffolds projects from bundled and remote templates. The test suite covers all
supported targets, production builds, packaging, plugins, development rebuilds,
browser API bundling, and Windows hardening, and `npm run acceptance` verifies
the built CLI end to end.

## 2. Features

- Project scaffolding with `addonova init` and bundled or remote templates.
- Chrome, Chromium, Edge, and Firefox targets.
- Manifest V2 and V3 generation with per-browser overrides and automatic
  MV2/MV3 field conversion.
- File-based entrypoints from `src/entrypoints/` with `define*` helpers.
- Manifest synthesis for background, content scripts, popup, options,
  side panel, devtools, sandbox, and URL overrides.
- TypeScript and JavaScript bundling with extension-safe IIFE output.
- HTML entry points with rewritten script, stylesheet, and asset references.
- `package.json` defaults, icon auto-discovery, and dotenv-based
  `import.meta.env` values.
- CSS processing, static assets, and `public/` copying.
- Browser-specific manifest validation before output is published.
- Development watcher with warm rebuild contexts, last-successful-output
  preservation, and auto-reload of matching tabs and extensions.
- Native browser launcher with automatic binary detection, isolated or
  persistent profiles, and extension reloads on rebuild. No `web-ext`
  dependency.
- Production minification, HTML/CSS minification, tree shaking, and source maps.
- Small plugin API with deterministic ordering and lifecycle hooks.
- Extensibility hooks and a module system for entrypoints, aliases, generated
  files, and manifest customization.
- Per-target `@addonova/browser` integration with `external` and `bundle` modes.
- `addonova doctor` environment diagnostics for Node.js, Guchho, configuration,
  entrypoints, browser binaries, and the browser API package.
- Colored, timed CLI output with file-tree build summaries and a TTY-aware
  spinner.
- ZIP, TAR, and TAR.GZ packaging with `manifest.json` at the archive root.
- Actionable diagnostics with error codes, locations, and suggestions.

## 3. Installation

```bash
npm install --save-dev addonova
```

Requirements:

- Node.js 20 or newer.
- npm.

Addonova depends on the published `guchho@1.0.9` bundler and its native binary.
Some npm versions ask for approval before running Guchho's install script.

## 4. Project setup

Scaffold a new project with a bundled template:

```bash
npx addonova init my-extension
cd my-extension
npm install
npm run dev
```

`init` defaults to the `vanilla-ts` template, the current directory, git
initialization, and a package manager inferred from the environment. Pass
`--no-git`, `--offline`, or `--force` as needed.

### Templates

| Template | Description |
| --- | --- |
| `vanilla-ts` | TypeScript background, content script, and popup. |
| `vanilla-js` | JavaScript version of the same structure. |
| `react` | React and TypeScript popup with DOM typings. |
| `vanilla` | Alias for `vanilla-ts`. |

Remote templates are supported through GitHub sources such as
`gh:owner/repo/path#ref`. Use `--offline` to guarantee that only bundled
templates are used.

All bundled templates depend on `@addonova/browser` and set
`browserApi: 'bundle'`, so the generated extension uses the unified browser API
and builds standalone after `npm install`.

A minimal project:

```text
my-extension/
├── addonova.config.ts
├── public/
│   └── icons/
│       └── icon.svg
└── src/
    └── entrypoints/
        ├── background.ts
        ├── content.ts
        └── popup/
            ├── index.html
            ├── popup.ts
            └── style.css
```

```ts
// src/entrypoints/background.ts
import { defineBackground } from 'addonova/defines';

export default defineBackground(() => {
  console.log('background ready');
});
```

```ts
// src/entrypoints/content.ts
import { defineContentScript } from 'addonova/defines';

export default defineContentScript({
  matches: ['https://example.com/*'],
  main() {
    console.log('content script ready');
  },
});
```

```ts
// addonova.config.ts
import { defineConfig } from 'addonova';

export default defineConfig({
  manifest: {
    name: 'My Extension',
    permissions: ['storage'],
    icons: {
      '48': 'icons/icon.svg',
    },
  },
});
```

Entrypoints are discovered from `src/entrypoints/`, and Addonova synthesizes
the background, content script, popup action, and icon manifest fields. Set
`entrypoints` explicitly to override discovery.

```bash
npx addonova build --browser chrome
```

The output is written to `dist/chrome` and can be loaded as an unpacked
extension.

## 5. Configuration

Configuration is discovered from the nearest directory containing one of these
files, in priority order:

1. `addonova.config.ts`
2. `addonova.config.js`
3. `addonova.config.mjs`
4. `addonova.config.json`

Use `--config <path>` to select a file explicitly. `defineConfig()` is an
identity helper that provides editor types. A user-level
`~/.addonova/addonova.config.*` file can provide `webExt` launcher defaults; its
other fields are ignored.

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome', 'firefox'],
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
  },
  outdir: 'dist',
  publicDir: 'public',
  mode: 'production',
  minify: true,
  sourcemap: false,
  browserApi: 'bundle',
  convertManifest: true,
  webExt: {
    disabled: false,
    binaries: {},
    chromiumArgs: [],
    firefoxArgs: [],
    keepProfileChanges: false,
    startUrls: [],
  },
  plugins: [],
  modules: [],
  hooks: {},
  pack: {
    format: 'zip',
    overwrite: false,
    deterministic: false,
    include: ['**/*'],
    exclude: [],
    sources: false,
  },
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entrypoints` | string, string[], or object | discovered | Scripts, HTML files, styles, or assets to build. Overrides convention discovery. |
| `srcDir` | string | `src` | Source directory, resolved from the config file. |
| `entrypointsDir` | string | `entrypoints` | Entrypoint directory relative to `srcDir`. |
| `browsers` | target[] or override object | `['chrome']` | Targets to build. Overrides may set manifest fields. |
| `manifest` | object or function | `{}` | Base manifest merged into every target. Functions receive `{ browser, manifestVersion, mode, command }`. |
| `convertManifest` | boolean | `true` | Convert MV3-first fields to MV2 and back per target. |
| `outdir` | string | `dist` | Output directory, resolved from the config file. |
| `publicDir` | string | `public` | Files copied after a successful build. |
| `mode` | `development` or `production` | `production` | Build mode. `dev` defaults to development. |
| `minify` | boolean | production | Enables JavaScript, CSS, and HTML minification. |
| `sourcemap` | boolean or mode | development | `true`, `false`, `inline`, `external`, `linked`, `both`, or `none`. |
| `browserApi` | mode or object | `'external'` | How `@addonova/browser` is handled. `'external'` keeps it external; `'bundle'` aliases and bundles the target adapter. The object form is `{ mode, package, define }`. |
| `webExt.disabled` | boolean | `false` | Disable automatic browser launching during `dev`. |
| `webExt.binaries` | object | `{}` | Custom browser executables keyed by target: `chrome`, `chromium`, `edge`, `firefox`. |
| `webExt.chromiumArgs` | string[] | `[]` | Extra arguments for Chromium-based browsers. Required launcher flags are protected. |
| `webExt.firefoxArgs` | string[] | `[]` | Extra arguments for Firefox. Required launcher flags are protected. |
| `webExt.chromiumProfile` | string | isolated | Persistent Chromium profile directory, resolved from the project root. |
| `webExt.firefoxProfile` | string | isolated | Persistent Firefox profile directory, resolved from the project root. |
| `webExt.keepProfileChanges` | boolean | `false` | Reuse a persistent profile under `.addonova/browser-profiles/<target>` instead of a temporary profile. |
| `webExt.startUrls` | string[] | `[]` | URLs opened when the browser launches. |
| `plugins` | plugin[] | `[]` | Addonova plugins in registration order. |
| `modules` | module[] | `[]` | Addonova modules as objects, package names, or `[package, options]` tuples. Local `modules/*` files are discovered automatically. |
| `hooks` | object | `{}` | Build lifecycle hooks keyed by hook name. |
| `pack.format` | `zip`, `tar`, or `tar.gz` | `zip` | Archive format. |
| `pack.outFile` | string | derived | Explicit archive path. Not allowed for multiple targets. |
| `pack.level` | 0-9 | engine default | Compression level for ZIP and TAR.GZ. |
| `pack.overwrite` | boolean | `false` | Replace an existing archive. |
| `pack.deterministic` | boolean | `false` | Use a fixed archive timestamp. |
| `pack.include` | string[] | `['**/*']` | Glob patterns for files to include in extension archives. |
| `pack.exclude` | string[] | `[]` | Glob patterns for files to exclude from extension archives. `manifest.json` must remain included. |
| `pack.sources` | boolean or object | `false` | Also write a `*-sources.zip` archive for Firefox targets. The object form is `{ include, exclude, root }`. |

`browserApi` controls the runtime helper package:

- `external` keeps `@addonova/browser` and its known subpaths external. The
  package is resolved by the extension host or a later build step, and it is not
  required while Addonova builds.
- `bundle` aliases `@addonova/browser` to `@addonova/browser/<target>`, sets
  `__ADDONOVA_BROWSER__` to the target, and bundles only that adapter. The
  package must be installed in the project.

Alias and externalization are mutually exclusive. The object form supports
`{ mode, package, define }`, where `package` defaults to `@addonova/browser` and
`define` defaults to `true` in bundle mode.

CLI options override configuration values. Browser overrides may be written as a
direct object or nested under `manifest`:

```ts
export default {
  browsers: {
    chrome: {
      background: { service_worker: 'background.js' },
    },
    firefox: {
      background: { scripts: ['background.js'] },
      browser_specific_settings: {
        gecko: { id: 'my-extension@example.com' },
      },
    },
  },
};
```

Nested manifest fields are deep-merged. Unsupported fields are reported as
warnings or errors; they are never silently removed.

### Entrypoints

Addonova scans `src/entrypoints/` for scripts, HTML pages, styles, and assets.
Single files and `name/index.*` forms are supported. Recognized names derive
their manifest role automatically:

| Entrypoint | Manifest output |
| --- | --- |
| `background.ts` | `background.service_worker` or `background.scripts`. |
| `content.ts`, `name.content.ts` | `content_scripts[]` with `matches` from `defineContentScript()`. |
| `popup.html` | `action.default_popup` (or `browser_action`). |
| `options.html` | `options_ui.page`. |
| `sidepanel.html` | `side_panel.default_path` or `sidebar_action`. |
| `devtools.html` | `devtools_page`. |
| `newtab.html`, `bookmarks.html`, `history.html` | `chrome_url_overrides`. |
| `sandbox.html` | `sandbox.pages`. |

Use `define*` helpers from `addonova/defines` to declare metadata:

```ts
import {
  defineBackground,
  defineContentScript,
  definePage,
  defineUnlistedScript,
} from 'addonova/defines';
```

`defineContentScript()` accepts `matches`, `excludeMatches`, `includeGlobs`,
`excludeGlobs`, `runAt`, `allFrames`, `world`, `cssInjectionMode`, `include`,
and `exclude`. Content scripts must declare `matches`. Use `include`/`exclude`
on any helper to restrict browsers. HTML entrypoints can also declare
`manifest.type`, `manifest.include`, and `manifest.exclude` meta tags.

Explicit configuration still works and overrides discovered entrypoints:

```ts
export default {
  entrypoints: {
    background: 'src/background.ts',
    popup: {
      input: 'src/popup/index.html',
      include: ['chrome'],
    },
  },
};
```

### Defaults and environment

When the manifest omits `name` or `version`, Addonova reads them from
`package.json`. Prerelease versions are sanitized for the manifest and preserved
in `version_name`. Icons matching `icon-<size>.(png|svg)` are discovered from
`public/` and `public/icons/`; matching `icon-light-*` and `icon-dark-*` files
become `theme_icons`.

Dotenv files are loaded in this order, with later files overriding earlier
ones: `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`, `.env.<browser>`,
`.env.<browser>.local`. Only `ADDONOVA_*` and `VITE_*` variables are exposed to
`import.meta.env`, alongside `MODE`, `DEV`, `PROD`, `BROWSER`, and
`MANIFEST_VERSION`.

## 6. CLI reference

```bash
addonova <command> [options]
```

Commands:

| Command | Description |
| --- | --- |
| `init [directory]` | Scaffold a new extension from a bundled or remote template. |
| `build` | Build every configured browser target. |
| `dev` | Watch sources, rebuild, and preserve the last successful output. |
| `clean` | Stop the bundler service and remove generated output. |
| `info` | Print environment, configuration, targets, and entry points. |
| `doctor` | Diagnose Node.js, Guchho, configuration, browsers, and the browser API package. |
| `validate` | Validate configuration and manifests without writing output. |
| `pack` | Package a previously built extension. |
| `zip` | Package a previously built extension as a ZIP archive, regardless of `pack.format`. |
| `analyze` | Report bundle inputs, outputs, dependencies, and total size without writing output. |

Options:

| Option | Description |
| --- | --- |
| `--browser <target>` | Select a target. Repeat for multiple targets. |
| `--manifest-version <2\|3>` | Override the manifest version. |
| `--mode <mode>` | `development` or `production`. |
| `--config <path>` | Use an explicit configuration file. |
| `--outdir <path>` | Override the output directory. |
| `--minify` / `--no-minify` | Enable or disable minification. |
| `--sourcemap[=mode]` | Enable source maps or select a mode. |
| `--no-sourcemap` | Disable source maps. |
| `--browser-api <mode>` | Set `@addonova/browser` integration to `external` or `bundle`. |
| `--include <glob>` | Include matching files when packing. Repeat for multiple patterns. |
| `--exclude <glob>` | Exclude matching files when packing. Repeat for multiple patterns. |
| `--sources` | Also pack a Firefox source archive. |
| `--json` | Print the report as JSON (`analyze` and `doctor`). |
| `--verbose` | Print underlying stack traces on failure. |
| `--debug` | Emit structured JSON dev diagnostics to stderr. |
| `--no-color` | Disable colored output. |
| `-h`, `--help` | Show help. |
| `-V`, `--version` | Show the Addonova version. |

`init` options:

| Option | Description |
| --- | --- |
| `-t`, `--template <name>` | Template name or a `gh:owner/repo[/path][#ref]` source. |
| `--pm <manager>` | Package manager: `npm`, `pnpm`, `yarn`, or `bun`. |
| `--git` / `--no-git` | Enable or disable `git init` (default: enabled). |
| `--force` | Scaffold into a non-empty directory. |
| `--offline` | Use bundled templates only; never download. |

### Terminal output

Commands print an `Addonova <version>` header and end with a timed success or
failure line. `build` and `dev` print a file tree with per-file sizes,
per-extension colors, and a total size. Colors and the spinner are enabled only when
stdout is a terminal. Set `NO_COLOR=1` to disable color, `FORCE_COLOR=1` to force
it, or pass `--no-color` per command.

## 7. Browser targets

Supported targets are `chrome`, `chromium`, `edge`, and `firefox`.

Output layout:

```text
dist/
├── chrome/
├── chromium/
├── edge/
└── firefox/
```

When one browser is configured for both Manifest V2 and V3, its directories use
`dist/<browser>-mv2` and `dist/<browser>-mv3` instead. Files from different
targets are never mixed.

Each target supports Manifest V2 and V3. Chrome, Chromium, and Edge mark V2 as
deprecated; Firefox supports both. Firefox is the only target that accepts
`browser_specific_settings` and `sidebar_action` without a compatibility
warning.

## 8. Manifest versions

Each target uses its default manifest version unless configuration or
`--manifest-version` overrides it. All four targets currently default to MV3.

Background shapes are target-aware:

```json
{ "background": { "service_worker": "background.js" } }
```

```json
{ "background": { "scripts": ["background.js"] } }
```

Mismatches between the manifest version and background shape produce diagnostics.
`action` and `browser_action`, host permissions, restricted permissions, and
browser-specific fields are validated per target.

Manifests must include at least a name and a valid version. Referenced files are
checked against the final output directory during `build` and before publishing
during `dev`.

## 9. Entry points

Entry points may be a single path, an array, or an object of names to paths:

```ts
export default {
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/index.html',
    styles: 'src/styles.css',
    readme: 'src/readme.txt',
  },
};
```

- Script and style output names omit extensions; `background` becomes
  `background.js`.
- HTML output names include `.html`; `popup` becomes `popup.html`.
- For array and string forms, names are derived from file names. An `index`
  file uses its parent directory name.
- Scripts default to `iife`, bundling enabled, splitting disabled, and a browser
  platform.
- HTML-referenced scripts, styles, and assets are emitted under `assets/` with
  hashed names and rewritten references.
- Duplicate output names are rejected before the build starts.
- Files in `public/` are copied after a successful build. A collision with a
  generated path produces a warning instead of overwriting generated output.

Addonova keeps `@addonova/browser` external by default. Set
`browserApi: 'bundle'` to alias the package to the selected target adapter and
include it in the output instead.

## 10. Development workflow

```bash
npx addonova dev
```

`dev` watches the project root and configuration file with `chokidar`, classifies
changes as config, manifest, entrypoint, source, asset, or unknown, and debounces
rebuilds.

One warm Guchho context is created per target. Successful builds are copied into
a staging directory and published with a swap, so stale files are removed.
Failed rebuilds leave the last successful output untouched. Config changes reload
configuration and recreate contexts; if reloading fails, the previous targets and
output remain active.

### Auto-reload

In development mode, `dev` starts a loopback WebSocket server and injects a small
reload client into each target's background script or service worker. After a
successful rebuild the client reloads tabs that match the manifest's content-script
patterns, then calls `runtime.reload()` so the extension and its content scripts
refresh. When no client is connected, the launcher falls back to its own extension
reload. Manifest edits take the same rebuild path, while config changes recreate
targets and relaunch browsers.

Development builds also add the `tabs` permission (and `scripting` for MV3) and a
` (Development)` manifest name suffix. The reload client and these additions are
applied only when the browser launcher is enabled; set `webExt.disabled: true` to
build plain development output.

The reload client requires a background entrypoint. Manifests that use
`background.page` cannot be instrumented and print a warning; add a background
script or service worker to enable auto-reload. Pass `--debug` to emit structured
JSON lifecycle events (`dev.change`, `dev.build.success`, `dev.reload.broadcast`,
`dev.rebuild.cycle`, and others) to stderr.

### Browser launcher

`dev` launches every configured target after its first successful build using a
native in-repo launcher. Chrome, Chromium, Edge, and Firefox are supported, and
`web-ext` is not required.

Installed browsers are detected automatically. Use `webExt.binaries` to point at
a custom executable; absolute paths, paths relative to the project root, and bare
command names resolved through `PATH` are supported.

```ts
export default defineConfig({
  browsers: ['chrome', 'firefox'],
  webExt: {
    binaries: {
      firefox: '/opt/firefox/firefox',
      chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    },
    startUrls: ['https://example.com'],
  },
});
```

- By default each launch uses an isolated profile under the OS temp directory
  that is removed on shutdown.
- Set `chromiumProfile` or `firefoxProfile` to reuse a persistent profile, or set
  `keepProfileChanges: true` to use
  `.addonova/browser-profiles/<target>`. Persistent profiles are never deleted
  automatically.
- A `--user-data-dir=` entry in `chromiumArgs` or `--profile` in `firefoxArgs` is
  treated as a persistent profile. Explicit profile configuration wins over
  conflicting custom arguments, and a warning is printed.
- `chromiumArgs` and `firefoxArgs` extend the required launcher flags. Conflicting
  flags are ignored with a warning so extension loading keeps working.
- Set `webExt.disabled: true` to skip detection, profile creation, and launching
  entirely.

Successful rebuilds reload the loaded extension. Failed rebuilds do not reload,
and launch or reload failures are reported as warnings without stopping the dev
loop. If the browser process exits unexpectedly, the next successful rebuild
relaunches it. Config changes close existing launchers before recreating targets.

### Launcher defaults in addonova config

Launcher defaults use the same configuration convention as the rest of
Addonova:

- Project: `<projectRoot>/addonova.config.*` → `webExt`
- User: `~/.addonova/addonova.config.*` → `webExt`

Only the `webExt` field is read from the user-level file. Dedicated
`web-ext.config.*` files are not read; put launcher settings under `webExt` in
`addonova.config.*`.

```ts
// ~/.addonova/addonova.config.ts
import { defineConfig } from 'addonova';

export default defineConfig({
  webExt: {
    startUrls: ['https://example.com'],
  },
});
```

Options are merged from lowest to highest precedence:

1. Built-in defaults.
2. `~/.addonova/addonova.config.*` → `webExt`.
3. `<projectRoot>/addonova.config.*` → `webExt`.

Higher-precedence top-level values override lower ones, `binaries` is merged
key-by-key, arrays are replaced rather than concatenated, and explicit
`undefined` values do not erase lower-precedence values. Changes to the project
`addonova.config.*` trigger a config reload; the user-level file is not watched.

## 11. Production builds

Production is the default mode for `build`:

- Guchho minification is enabled.
- HTML and CSS are minified.
- Tree shaking and dead-code elimination are enabled.
- Source maps are off unless configured.
- Development defaults to source maps on and minification off.

Override settings per command:

```bash
npx addonova build --browser chrome --no-minify
npx addonova build --browser chrome --sourcemap=inline
```

`clean` stops the Guchho service before deleting output, which is required on
Windows where the native service keeps output files open. It refuses output
directories that contain the project root, source entry points, the public
directory, or the configuration file.

`pack` uses Guchho's packer with every top-level output child as an input, so
`manifest.json` stays at the archive root. Existing archives are refused unless
`pack.overwrite` is enabled. Deterministic packs use a fixed timestamp and
produce byte-identical archives for unchanged output.

Use `zip` to produce a ZIP archive even when `pack.format` is set to `tar` or
`tar.gz`:

```bash
npx addonova zip
npx addonova zip --exclude '**/*.map' --include 'manifest.json' --include 'icons/**'
```

Filtering uses glob patterns matched against paths relative to each target's
output directory. `*` stays within one path segment, `**` crosses segments, and
braces such as `*.{js,css}` expand to alternatives. Filtered archives are staged
in a temporary directory before packing, so nested directories keep their
structure. The archive must keep `manifest.json`; otherwise packing fails with
`ADDONOVA_PACK_MANIFEST_EXCLUDED`.

Firefox source archives are enabled with `pack.sources` or `--sources`:

```ts
export default {
  pack: {
    sources: {
      root: '.',
      include: ['src/**', 'public/**', 'manifest.json', 'package.json'],
      exclude: ['src/**/*.test.ts'],
    },
  },
};
```

The default source set is the project root minus dependency, VCS, hidden,
coverage, test, and archive files. The output directory and existing archives are
always excluded. Source archives are named `<archive>-sources.zip` beside the
extension archive, so the default Firefox output includes both
`addonova-firefox-mv3-<version>.zip` and
`addonova-firefox-mv3-<version>-sources.zip`. Enabling source archives without a
Firefox target fails with `ADDONOVA_PACK_SOURCES_UNSUPPORTED`.

`analyze` runs the build in memory and reports per-target outputs, transitive
inputs, external dependencies, and total bytes without writing files:

```bash
npx addonova analyze
npx addonova analyze --json
```

JSON reports include `browser`, `manifestVersion`, `outdir`, `totalBytes`,
`dependencies`, `inputs` (path and bytes), and `outputs` (path and size).

`doctor` checks the local build environment: the Node.js version against the
package engine range, Guchho resolution, configuration discovery, entrypoints,
browser binaries for every configured target, and the `@addonova/browser`
package when `browserApi` is `bundle`. Missing browsers are warnings; missing
required dependencies are failures and exit with code 1:

```bash
npx addonova doctor
npx addonova doctor --json
```

## 12. Bundler integration

Addonova targets the published `guchho@1.0.9` Node.js API through a dedicated
adapter behind an Addonova-owned interface. The adapter maps inputs to Guchho
build options without inventing unsupported APIs.

Important integration details:

- Script builds use one `format` per build. Extension scripts default to `iife`,
  `bundle: true`, and `splitting: false`.
- `browserApi: 'bundle'` maps to a Guchho alias and `define`; external mode maps
  to Guchho `external` entries instead. The two are never combined.
- HTML-referenced files are emitted under `assets/` and references are rewritten
  by Guchho.
- Guchho does not generate `manifest.json`; Addonova writes it after the asset
  build.
- Guchho 1.0.9 declares `Plugin.transform` but does not run it. Addonova bridges
  transforms through Guchho's `load` hook.
- `PluginContext.resolve` is not usable in this version. Addonova does not expose
  it.
- `PluginContext.emitFile` supports assets only. Addonova does not expose it.
- `watch()` is request-driven, so Addonova uses `chokidar` and calls
  `context.rebuild()`.
- `pack()` names each input by its last path component; passing top-level output
  children keeps the archive root correct.
- `stop()` runs before output removal on Windows.

Bundler errors and warnings preserve their original text, file, line, column, and
suggestion where Guchho provides them. Adapter output includes outputs, inputs,
duration, warnings, errors, and the metafile.

## 13. Plugin development

Plugins are small objects registered in configuration order:

```ts
import { defineConfig } from 'addonova';
import type { AddonovaPlugin } from 'addonova';

const banner: AddonovaPlugin = {
  name: 'banner',
  buildStart() {
    console.log('build starting');
  },
  transform(code, id) {
    if (!id.endsWith('.ts')) {
      return null;
    }

    return `${code}\nconsole.log('built by Addonova');`;
  },
  buildEnd() {
    console.log('build finished');
  },
};

export default defineConfig({
  entrypoints: { background: 'src/background.ts' },
  plugins: [banner],
});
```

Rules:

- Every plugin needs a unique, non-empty `name`.
- Hooks run in registration order.
- `buildStart` and `buildEnd` run once per build cycle; `transform` runs per
  processed module.
- A transform may return new code or `null` to leave the module unchanged.
- Transform failures are reported with the plugin name, source file, message,
  and suggestion. Lifecycle failures include the plugin name and failing hook.
- Only `buildStart`, `transform`, and `buildEnd` are supported. Addonova does not
  pretend to support Guchho hooks such as `resolveId`, `load`, `emitFile`, or a
  full Rollup plugin API.

Because Guchho 1.0.9 does not execute `Plugin.transform` directly, each Addonova
plugin transform is bridged through a Guchho `load` hook. This is an
implementation detail, not a guarantee that arbitrary Guchho plugins are
compatible.

## 14. Hooks and modules

Hooks and modules extend a build without replacing the bundler. They are useful
for generated files, shared entrypoints, aliases, and manifest or diagnostic
adjustments.

### Hooks

Declare hooks under `hooks` in the project configuration:

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  entrypoints: { background: 'src/background.ts' },
  hooks: {
    'entrypoints:resolved': ({ addEntrypoint }) => {
      addEntrypoint('shared', 'src/shared-entry.ts');
    },
    'build:publicAssets': ({ assets }) => {
      assets.push({ path: 'generated/config.json', contents: '{"ok":true}' });
    },
    'build:manifestGenerated': ({ manifest }) => {
      manifest.description = 'Generated by Addonova';
    },
  },
});
```

| Hook | Payload | Purpose |
| --- | --- | --- |
| `config:resolved` | `{ config }` | Inspect the resolved configuration before entrypoints run. |
| `entrypoints:found` | `{ config, entrypoints, addEntrypoint, removeEntrypoint }` | Adjust entrypoints after discovery and module setup. |
| `entrypoints:resolved` | `{ config, entrypoints, addEntrypoint, removeEntrypoint }` | Final entrypoint pass before the build starts. |
| `build:publicAssets` | `{ config, browser, outdir, assets }` | Add generated files alongside copied public assets. |
| `build:manifestGenerated` | `{ config, browser, manifest, diagnostics }` | Inspect or mutate the manifest and its diagnostics per target. |
| `build:done` | `{ config, reports }` | Run after every target build completes. |
| `dev:reload` | `{ config, target, manifestVersion, reason }` | Observe successful development rebuilds before reloads. |

Hooks run sequentially in deterministic order:

1. Hooks registered by modules in `modules` order.
2. Hooks registered by local `modules/*` files, sorted alphabetically.
3. Hooks declared in the project configuration.

A failing hook stops the build and is reported as `ADDONOVA_HOOK_FAILED` with the
hook name, owner, and original cause. Manifest diagnostics appended to the
`diagnostics` array are printed and can fail the build when their severity is
`error`.

### Modules

Modules are setup functions that can contribute entrypoints, aliases, generated
files, and hooks. Use `defineAddonovaModule()` for editor types:

```ts
import { defineAddonovaModule } from 'addonova';

export default defineAddonovaModule({
  name: 'shared-ui',
  setup({ hooks, addEntrypoint, addAlias, addFile }) {
    addEntrypoint('shared', 'src/shared-entry.ts');
    addAlias('@shared', './src/shared');
    addFile('generated/module.json', '{"source":"module"}');

    hooks.on('build:manifestGenerated', ({ manifest }) => {
      manifest.author = 'shared-ui';
    });
  },
});
```

Register modules explicitly in configuration, or place them in the project's
`modules/` directory:

```ts
export default {
  modules: [
    'addonova-module-example',
    ['addonova-module-configured', { feature: true }],
  ],
};
```

- `modules: [...]` accepts a module object, a package name, or a
  `[package, options]` tuple. Configured modules run first, in array order.
- Local `modules/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}` files run next, sorted by
  file name. Files starting with `.` or `_`, declaration files, and `*.test.*`
  or `*.spec.*` files are ignored.
- `configKey` reads module options from the config field of that name. The same
  options are passed to configured and local modules.
- `addEntrypoint()` uses the same name, input, include/exclude, and type rules as
  explicit configuration.
- `addAlias()` resolves targets starting with `./`, `../`, or an absolute path
  from the project root. Other targets are treated as package specifiers.
- `addFile()` is emitted through `build:publicAssets` into every target output.
  Paths must stay inside the output directory.

During `dev`, editing a module file or the project configuration reloads module
setup, hooks, aliases, and entrypoints before rebuilding. Module failures are
reported as `ADDONOVA_MODULE_LOAD_FAILED`, `ADDONOVA_MODULE_INVALID`,
`ADDONOVA_MODULE_SETUP_FAILED`, or `ADDONOVA_MODULE_DUPLICATE`.

## 15. Runtime integration

The runtime helper package is `@addonova/browser`:

```ts
import { browser } from '@addonova/browser';

const tabs = await browser.tabs.query({
  active: true,
  currentWindow: true,
});

console.log(tabs);
```

`@addonova/browser` is maintained as a separate package and is declared as an
optional peer dependency. Addonova supports two integration modes.

### External (default)

`browserApi: 'external'` keeps `@addonova/browser` and its known subpaths out of
the bundle. The extension host or a later build step supplies the package. No
copy is bundled, and the package is not required while Addonova builds.

### Bundle

`browserApi: 'bundle'` follows the `@addonova/browser` build contract:

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome', 'firefox'],
  browserApi: 'bundle',
});
```

For each target, Addonova maps the package root:

```text
@addonova/browser -> @addonova/browser/<chrome|chromium|edge|firefox>
```

It also sets `__ADDONOVA_BROWSER__` to the same target. Only the selected adapter
is reachable, so API-level tree shaking removes unrelated modules. The package
must be installed in the project; otherwise the build fails with
`ADDONOVA_BROWSER_API_NOT_FOUND`.

Application code should import from the package root. Do not import target
subpaths directly when using bundle mode. The object form is
`{ mode, package, define }`; set `define: false` to skip the compile-time
definition.

Addonova `1.0.x` targets `@addonova/browser ^0.2.0`. That release adds typed
storage items, type-safe messaging and proxy services, content-script context
and UI helpers, i18n helpers, and a fake browser with a Vitest plugin. See the
`@addonova/browser` README for the runtime API and testing guides.

## 16. Limitations

- Auto-reload performs full extension reloads rather than module-level HMR. It
  needs a background script or service worker; manifests using `background.page`
  print a warning and fall back to launcher reloads. Tabs are reloaded only when
  they match content-script patterns.
- Chromium extension loading uses the CDP `Extensions.loadUnpacked` command over
  `--remote-debugging-pipe`. Older Chromium builds that lack this command fall
  back to `--load-extension`, and reloads restart the browser process.
- Firefox reloads use WebDriver BiDi `webExtension.install`. A recent Firefox
  release with BiDi extension installation support is required.
- The reload client is disabled when `webExt.disabled` is true, and it does not
  hot-swap modules or preserve extension state across reloads.
- Runtime compatibility code is bundled only in `bundle` mode and only from the
  installed `@addonova/browser` package.
- `@addonova/browser` is maintained separately and is an optional peer
  dependency; this repository does not publish it.
- The plugin API is intentionally small and is not a Rollup-compatible plugin
  framework.
- Local modules are discovered only from the top-level `modules/` directory;
  nested directories are not scanned. Hooks and modules run in-process and are
  not sandboxed.
- Unsupported manifest fields are preserved and diagnosed; Addonova does not
  convert them automatically.
- Guchho 1.0.9 has upstream limitations around plugin `transform`, `resolve`,
  `emitFile`, and optional platform packages. Addonova works around the
  transform and watch limitations and does not expose unsupported hooks.
- Manifest validation checks structure and referenced files, not full store
  policy compliance.

## 17. License

MIT
