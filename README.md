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
is integrated through the `external` and `bundle` modes. The test suite covers
all supported targets, production builds, packaging, plugins, development
rebuilds, browser API bundling, and Windows hardening, and `npm run acceptance`
verifies the built CLI end to end.

## 2. Features

- Chrome, Chromium, Edge, and Firefox targets.
- Manifest V2 and V3 generation with per-browser overrides.
- TypeScript and JavaScript bundling with extension-safe IIFE output.
- HTML entry points with rewritten script, stylesheet, and asset references.
- CSS processing, static assets, and `public/` copying.
- Browser-specific manifest validation before output is published.
- Development watcher with warm rebuild contexts and last-successful-output
  preservation.
- Production minification, HTML/CSS minification, tree shaking, and source maps.
- Small plugin API with deterministic ordering and lifecycle hooks.
- Per-target `@addonova/browser` integration with `external` and `bundle` modes.
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

A minimal project:

```text
my-extension/
├── addonova.config.ts
├── public/
│   └── icons/
│       └── icon.svg
└── src/
    ├── background.ts
    └── popup/
        ├── index.html
        ├── popup.ts
        └── style.css
```

```ts
// addonova.config.ts
import { defineConfig } from 'addonova';

export default defineConfig({
  entrypoints: {
    background: 'src/background.ts',
    popup: 'src/popup/index.html',
  },
  manifest: {
    name: 'My Extension',
    version: '1.0.0',
    background: {
      service_worker: 'background.js',
    },
    action: {
      default_popup: 'popup.html',
    },
    icons: {
      '48': 'icons/icon.svg',
    },
  },
});
```

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
identity helper that provides editor types.

```ts
import { defineConfig } from 'addonova';

export default defineConfig({
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/index.html',
  },
  browsers: ['chrome', 'firefox'],
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
  plugins: [],
  pack: {
    format: 'zip',
    overwrite: false,
    deterministic: false,
  },
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entrypoints` | string, string[], or object | `{}` | Scripts, HTML files, styles, or assets to build. |
| `browsers` | target[] or override object | `['chrome']` | Targets to build. Overrides may set manifest fields. |
| `manifest` | object | `{}` | Base manifest merged into every target. |
| `outdir` | string | `dist` | Output directory, resolved from the config file. |
| `publicDir` | string | `public` | Files copied after a successful build. |
| `mode` | `development` or `production` | `production` | Build mode. `dev` defaults to development. |
| `minify` | boolean | production | Enables JavaScript, CSS, and HTML minification. |
| `sourcemap` | boolean or mode | development | `true`, `false`, `inline`, `external`, `linked`, `both`, or `none`. |
| `browserApi` | mode or object | `'external'` | How `@addonova/browser` is handled. `'external'` keeps it external; `'bundle'` aliases and bundles the target adapter. The object form is `{ mode, package, define }`. |
| `plugins` | plugin[] | `[]` | Addonova plugins in registration order. |
| `pack.format` | `zip`, `tar`, or `tar.gz` | `zip` | Archive format. |
| `pack.outFile` | string | derived | Explicit archive path. Not allowed for multiple targets. |
| `pack.level` | 0-9 | engine default | Compression level for ZIP and TAR.GZ. |
| `pack.overwrite` | boolean | `false` | Replace an existing archive. |
| `pack.deterministic` | boolean | `false` | Use a fixed archive timestamp. |

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

## 6. CLI reference

```bash
addonova <command> [options]
```

Commands:

| Command | Description |
| --- | --- |
| `build` | Build every configured browser target. |
| `dev` | Watch sources, rebuild, and preserve the last successful output. |
| `clean` | Stop the bundler service and remove generated output. |
| `info` | Print environment, configuration, targets, and entry points. |
| `validate` | Validate configuration and manifests without writing output. |
| `pack` | Package a previously built extension. |

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
| `--verbose` | Print underlying stack traces on failure. |
| `--no-color` | Disable colored output. |
| `-h`, `--help` | Show help. |
| `-V`, `--version` | Show the Addonova version. |

### Terminal output

Commands print an `Addonova <version>` header and end with a timed success or
failure line. `build` and `dev` print a file tree with per-file sizes, WXT-style
extension colors, and a total size. Colors and the spinner are enabled only when
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

No browser installation is required. Browser launching and automatic extension
reloading are not part of v1.

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

## 14. Runtime integration

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

## 15. Limitations

- Browser launching, automatic extension reloading, and browser automation are
  not included.
- Runtime compatibility code is bundled only in `bundle` mode and only from the
  installed `@addonova/browser` package.
- `@addonova/browser` is maintained separately and is an optional peer
  dependency; this repository does not publish it.
- The plugin API is intentionally small and is not a Rollup-compatible plugin
  framework.
- Unsupported manifest fields are preserved and diagnosed; Addonova does not
  convert them automatically.
- Guchho 1.0.9 has upstream limitations around plugin `transform`, `resolve`,
  `emitFile`, and optional platform packages. Addonova works around the
  transform and watch limitations and does not expose unsupported hooks.
- Manifest validation checks structure and referenced files, not full store
  policy compliance.

## 16. Examples

A complete working example lives in [`examples/basic`](examples/basic). It
includes:

- an HTML popup with TypeScript and CSS,
- a background service worker,
- a content script,
- an imported SVG asset,
- a `public/` icon referenced by the manifest.

```bash
npm run build
node dist/cli/index.js --config examples/basic/addonova.config.ts build
node dist/cli/index.js --config examples/basic/addonova.config.ts dev
node dist/cli/index.js --config examples/basic/addonova.config.ts pack
```

The example is covered by an integration test that builds it and verifies its
manifest and output files.

A browser API integration example lives in
[`examples/browser-api`](examples/browser-api). It uses bundle mode and requires
`@addonova/browser` to be installed in the project.

## 17. License

MIT
