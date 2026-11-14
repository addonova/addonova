---
title: Manifest and locales API
description: Manifest generation, validation, locale parsing, and target metadata.
---

# Manifest and locales API

## `buildManifest`

```ts
function buildManifest(
  baseManifest: ManifestInput,
  browser: ResolvedBrowser,
  options?: BuildManifestOptions,
): BuiltManifest;
```

```ts
interface BuildManifestOptions {
  outdir?: string;
  checkFiles?: boolean;
  availableFiles?: Iterable<string>;
  mode?: 'development' | 'production';
  command?: string;
  defaults?: ManifestDefaults;
  entrypoints?: readonly ResolvedEntrypoint[];
  convertManifest?: boolean;
  iconDir?: string;
  contentScriptCss?: ReadonlyMap<string, readonly string[]>;
  locales?: LocaleCollection;
}

interface BuiltManifest {
  manifest: Record<string, unknown>;
  diagnostics: readonly Diagnostic[];
  hasErrors: boolean;
}
```

Generates entrypoint fields, applies defaults and icons, converts versions, and
validates. When `checkFiles` is `true`, pass either `outdir` or `availableFiles`.

## `resolveManifestObject`

```ts
function resolveManifestObject(
  input: ManifestInput,
  browser: ResolvedBrowser,
  options?: BuildManifestOptions,
): Record<string, unknown>;
```

Resolves a static manifest or calls a manifest function with browser, manifest
version, mode, and command.

## `writeManifest`

```ts
function writeManifest(
  outdir: string,
  manifest: Readonly<Record<string, unknown>>,
): string;
```

Writes formatted `manifest.json` and returns its path.

## `collectLocales`

```ts
function collectLocales(options: CollectLocalesOptions): LocaleCollection;
```

```ts
interface CollectLocalesOptions {
  root: string;
  srcDir: string;
  publicDir: string;
  defaultLocale?: string;
}
```

Reads `public/_locales` and `src/<srcDir>/_locales`, normalizing flat and standard
layouts.

## `validateManifestLocales`

```ts
function validateManifestLocales(
  manifest: Readonly<Record<string, unknown>>,
  collection?: LocaleCollection,
): readonly Diagnostic[];
```

Checks `default_locale`, locale codes, and `__MSG_*__` references.

## `collectManifestMessageReferences`

```ts
function collectManifestMessageReferences(
  manifest: Readonly<Record<string, unknown>>,
): readonly ManifestMessageReference[];
```

Returns every `__MSG_key__` occurrence with field, key, and token.

## `parseI18nMessages` and `parseMessagesJson`

```ts
function parseI18nMessages(
  source: string,
  file: string,
  severity?: DiagnosticSeverity,
): LocaleParseResult;

function parseMessagesJson(
  source: string,
  file: string,
  severity?: DiagnosticSeverity,
): LocaleParseResult;
```

Parse Chrome `.i18n` or JSON messages. Default severity is `warning`.

## `formatLocaleMessages`

```ts
function formatLocaleMessages(messages: LocaleMessages): string;
```

Serializes messages as JSON with a trailing newline.

## `isValidLocaleCode`

```ts
function isValidLocaleCode(locale: string): boolean;
```

Accepts forms such as `en`, `en-US`, and `zh_CN`.

## Targets

```ts
const BROWSER_TARGET_INFO: Record<BrowserTarget, BrowserTargetInfo>;
function getBrowserTargetInfo(target: BrowserTarget): BrowserTargetInfo;
function supportsManifestVersion(target: BrowserTarget, version: ManifestVersion): boolean;
```

```ts
interface BrowserTargetInfo {
  target: BrowserTarget;
  displayName: string;
  defaultManifestVersion: 2 | 3;
  supportedManifestVersions: readonly (2 | 3)[];
  deprecatedManifestVersions: readonly (2 | 3)[];
  supportsBrowserSpecificSettings: boolean;
  supportsSidebarAction: boolean;
}
```

## Browser API integration

```ts
const BROWSER_API_SUBPATHS: readonly string[];
function assertBrowserApiInstalled(root: string, config: ResolvedBrowserApiConfig): void;
function getBrowserApiBundlerSettings(
  root: string,
  config: ResolvedBrowserApiConfig,
): BrowserApiBundlerSettings;
```
