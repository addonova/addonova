---
title: Utilities API
description: Init, environment, globs, entrypoints, bundler, and dev helpers.
---

# Utilities API

## Init

```ts
async function initProject(options: InitProjectOptions): Promise<InitProjectResult>;
```

```ts
interface InitProjectOptions {
  cwd: string;
  directory?: string;
  template?: string;
  packageManager?: PackageManager;
  git?: boolean;
  force?: boolean;
  offline?: boolean;
  env?: NodeJS.ProcessEnv;
  downloader?: TemplateDownloader;
  gitInit?: (root: string) => Promise<boolean>;
}

interface InitProjectResult {
  root: string;
  template: string;
  label: string;
  packageManager: PackageManager;
  gitInitialized: boolean;
  files: readonly string[];
  warnings: readonly string[];
}
```

Constants and helpers:

```ts
const BUILTIN_TEMPLATES = ['vanilla-ts', 'vanilla-js', 'react'];
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
const DEFAULT_TEMPLATE = 'vanilla-ts';
const TEMPLATE_LABELS: Record<BuiltinTemplate, string>;

function isBuiltinTemplate(value: unknown): value is BuiltinTemplate;
function resolveBuiltinTemplate(value: string): BuiltinTemplate | null;
function isPackageManager(value: unknown): value is PackageManager;
function detectPackageManager(options): Promise<PackageManager>;
```

## Environment

```ts
function loadBuildEnv(options: LoadBuildEnvOptions): BuildEnv;

interface LoadBuildEnvOptions {
  root: string;
  mode: BuildMode;
  browser: BrowserTarget;
  manifestVersion?: ManifestVersion;
}

interface BuildEnv {
  values: Readonly<Record<string, string>>;
  mode: BuildMode;
  browser: BrowserTarget;
  manifestVersion: ManifestVersion;
  dev: boolean;
  prod: boolean;
}
```

```ts
function toImportMetaEnvDefines(env: BuildEnv): Record<string, string>;
```

Produces defines for built-ins and exposed `ADDONOVA_*`/`VITE_*` values.

## Globs

```ts
function matchesGlob(relativePath: string, pattern: string): boolean;
function matchesAny(relativePath: string, patterns: readonly string[]): boolean;
function filterPaths(
  paths: readonly string[],
  include: readonly string[],
  exclude: readonly string[],
): readonly string[];
function matchesDirectory(relativePath: string, patterns: readonly string[]): boolean;
function expandBraces(pattern: string): readonly string[];
```

Supports `*`, `**`, `?`, character classes, and `{a,b}` alternatives. Paths use
forward slashes.

## Entrypoints

```ts
const ENTRYPOINT_TYPES: readonly EntrypointType[];

function discoverEntrypoints(options: DiscoverEntrypointsOptions): readonly DiscoveredEntrypoint[];
function detectEntrypointKind(input: string): EntrypointKind;
function inferEntrypointType(input: string): EntrypointType;
function isEntrypointForBrowser(entrypoint, browser): boolean;
function isEntrypointType(value: unknown): value is EntrypointType;
```

Types:

| Type | Description |
| --- | --- |
| `DiscoveredEntrypoint` | Discovered entrypoint metadata. |
| `DiscoverEntrypointsOptions` | Scan root, src dir, and entrypoint dir. |
| `EntrypointManifestOptions` | Manifest options from a define helper. |
| `EntrypointSelection` | Include/exclude filters. |
| `EntrypointType` | Manifest role union. |

## Bundler

```ts
const guchhoAdapter: BundlerAdapter;

interface BundlerAdapter {
  build(input: BundlerBuildInput): Promise<BundlerBuildResult>;
  dispose?(): Promise<void>;
}
```

Bundler types: `BundlerAdapter`, `BundlerBuildInput`, `BundlerBuildResult`,
`BundlerContext`, `BundlerEntrypoint`, `BundlerFormat`, `BundlerInput`,
`BundlerOutput`, `BundlerTransform`.

`guchhoAdapter` is the default adapter used when none is supplied. It wraps the
Guchho bundler and normalizes results.

## Development

```ts
class DevSession;

function createDevSession(options: DevSessionOptions): Promise<DevSession>;
function classifyChange(file: string, config: ResolvedConfig): ChangeKind;
```

```ts
type ChangeKind =
  | 'config'
  | 'manifest'
  | 'entrypoint'
  | 'source'
  | 'asset'
  | 'unknown';
```

Dev types: `BrowserLauncherFactory`, `DevSessionOptions`, `DevWatcher`,
`DevWatcherFactory`, `DevWatcherOptions`.

## Plugin types

```ts
interface AddonovaPlugin {
  name: string;
  buildStart?(): Promise<void> | void;
  transform?(code: string, id: string): Promise<string | null> | string | null;
  buildEnd?(): Promise<void> | void;
}
```

Plugin helpers: `createPluginManager()`, `mergePluginDiagnostics()`,
`validatePlugins()`, and the `PluginManager` type.
