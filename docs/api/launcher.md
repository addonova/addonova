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
  homeDir?: string;
  config: ResolvedWebExtConfig;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  exists?: (candidate: string) => boolean;
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

Throws `ADDONOVA_BROWSER_NOT_FOUND` when no executable is found. Uses the same
fallback chain as `resolveBrowserBinary`.

```ts
interface FindBrowserBinaryOptions {
  target: BrowserTarget;
  binaries?: Record<string, string>;
  root?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (candidate: string) => boolean;
  allowFallback?: boolean;
}
```

## `tryFindBrowserBinary`

```ts
function tryFindBrowserBinary(options: FindBrowserBinaryOptions): string | null;
```

Returns `null` instead of throwing. Matches the exact target only and never uses
fallbacks.

## `resolveBrowserBinary`

```ts
function resolveBrowserBinary(
  options: FindBrowserBinaryOptions,
): ResolvedBrowserBinary | null;
```

Resolves the requested target, then walks `BROWSER_FALLBACKS` for that target
when `allowFallback` is not `false`.

```ts
interface ResolvedBrowserBinary {
  binary: string;
  requestedTarget: BrowserTarget;
  matchedTarget: LauncherTarget;
}
```

## `browserNotFoundError`

```ts
function browserNotFoundError(options: FindBrowserBinaryOptions): AddonovaError;
```

Builds the `ADDONOVA_BROWSER_NOT_FOUND` error used by `findBrowserBinary` and the
launcher.

## `installChromium`

```ts
async function installChromium(
  browserProcess: ManagedProcess,
  extensionDir: string,
  options?: InstallExtensionOptions,
): Promise<ChromiumInstallResult>;
```

Connects to the browser CDP pipe and loads an unpacked extension. Returns the
client and the extension id. The client is disposed automatically on failure.

```ts
interface InstallExtensionOptions {
  timeoutMs?: number;
  onSessionEstablished?: () => void;
}

interface ChromiumInstallResult {
  cdp: CdpClient;
  extensionId: string;
}
```

## `installFirefox`

```ts
async function installFirefox(
  debuggerUrl: string,
  extensionDir: string,
  options?: InstallExtensionOptions,
): Promise<FirefoxInstallResult>;
```

Connects over WebDriver BiDi, starts a session, and installs the extension. The
`onSessionEstablished` callback fires after `session.new` succeeds. The client is
disposed automatically on failure.

```ts
interface FirefoxInstallResult {
  bidi: BidiClient;
  extensionId: string;
}
```

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
