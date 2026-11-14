---
title: Launcher API
description: Browser launcher creation, binary discovery, and webExt normalization.
---

# Launcher API

## `createBrowserLauncher`

```ts
function createBrowserLauncher(
  options: CreateBrowserLauncherOptions,
): BrowserLauncher;
```

```ts
interface CreateBrowserLauncherOptions {
  target: BrowserTarget;
  extensionDir: string;
  projectRoot: string;
  config: ResolvedWebExtConfig;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  spawn?: SpawnFunction;
  launchTimeoutMs?: number;
  protocolTimeoutMs?: number;
  onWarning?: (diagnostic: Diagnostic) => void;
}
```

```ts
interface BrowserLauncher extends RunningBrowser {
  readonly target: BrowserTarget;
  launch(): Promise<void>;
}

interface RunningBrowser {
  readonly extensionId: string;
  readonly isRunning: boolean;
  reload(): Promise<void>;
  close(): Promise<void>;
}
```

Temporary profiles are removed on close. Persistent profiles are kept.

## `launchBrowser`

```ts
async function launchBrowser(options: LaunchBrowserOptions): Promise<RunningBrowser>;
```

Creates, launches, and returns a running browser.

## `findBrowserBinary`

```ts
function findBrowserBinary(options: FindBrowserBinaryOptions): string;
```

Throws `ADDONOVA_BROWSER_NOT_FOUND` when no executable is found.

```ts
interface FindBrowserBinaryOptions {
  target: BrowserTarget;
  binaries?: Record<string, string>;
  root?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (candidate: string) => boolean;
}
```

## `tryFindBrowserBinary`

```ts
function tryFindBrowserBinary(options: FindBrowserBinaryOptions): string | null;
```

Returns `null` instead of throwing.

## `mergeWebExtConfig`

```ts
function mergeWebExtConfig(
  ...sources: readonly (WebExtConfig | undefined)[]
): WebExtConfig;
```

Merges `binaries` key by key. Replaces every other array or scalar. `undefined`
values do not erase lower-precedence values.

## `normalizeWebExtConfig`

```ts
function normalizeWebExtConfig(
  config: WebExtConfig | undefined,
  configPath: string | null,
): ResolvedWebExtConfig;
```

## `createDefaultWebExtConfig`

```ts
function createDefaultWebExtConfig(): ResolvedWebExtConfig;
```

## `getBrowserAdapter`

```ts
function getBrowserAdapter(target: BrowserTarget): BrowserAdapter;
```

Returns the Chromium or Firefox launcher adapter.

## Types

| Type | Description |
| --- | --- |
| `WebExtConfig` | User-facing launcher config. |
| `ResolvedWebExtConfig` | Normalized launcher config. |
| `BrowserLauncher` | Launcher with `launch()`. |
| `RunningBrowser` | Active browser process. |
| `BrowserProfilePlan` | Profile path and persistence. |
| `BrowserAdapter` | Adapter interface. |
| `LaunchBrowserOptions` | Adapter launch options. |
