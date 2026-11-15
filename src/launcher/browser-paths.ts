import { existsSync } from 'node:fs';
import path from 'node:path';

import { AddonovaError } from '../core/errors.ts';
import type { BrowserTarget } from '../core/types.ts';
import type { LauncherTarget, WebExtConfig } from './types.ts';

export interface FindBrowserBinaryOptions {
  target: BrowserTarget;
  binaries?: WebExtConfig['binaries'];
  root?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (candidate: string) => boolean;
  allowFallback?: boolean;
}

export interface ResolvedBrowserBinary {
  binary: string;
  requestedTarget: BrowserTarget;
  matchedTarget: LauncherTarget;
}

export const BROWSER_FALLBACKS: Readonly<
  Partial<Record<BrowserTarget, readonly LauncherTarget[]>>
> = {
  chrome: [
    'chromium',
    'chrome-canary',
    'chrome-beta',
    'chrome-dev',
    'brave',
    'edge',
  ],
  chromium: ['chrome', 'brave', 'edge'],
  edge: ['chrome', 'chromium'],
  firefox: ['firefox-developer-edition', 'firefox-nightly', 'zen'],
};

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

type PlatformKey = 'win32' | 'darwin' | 'linux';

const BROWSER_PATHS: Readonly<
  Record<PlatformKey, Partial<Record<LauncherTarget, readonly string[]>>>
> = {
  win32: {
    chrome: [
      '%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe',
      '%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe',
      '%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe',
    ],
    chromium: [
      '%ProgramFiles%\\Chromium\\Application\\chrome.exe',
      '%LOCALAPPDATA%\\Chromium\\Application\\chrome.exe',
    ],
    edge: [
      '%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe',
      '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe',
      '%LOCALAPPDATA%\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    brave: [
      '%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      '%ProgramFiles(x86)%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    ],
    arc: [
      '%LOCALAPPDATA%\\Arc\\Arc.exe',
      '%ProgramFiles%\\Arc\\Arc.exe',
    ],
    dia: [
      '%LOCALAPPDATA%\\Dia\\Application\\Dia.exe',
      '%ProgramFiles%\\Dia\\Application\\Dia.exe',
    ],
    'chrome-beta': [
      '%ProgramFiles%\\Google\\Chrome Beta\\Application\\chrome.exe',
      '%ProgramFiles(x86)%\\Google\\Chrome Beta\\Application\\chrome.exe',
      '%LOCALAPPDATA%\\Google\\Chrome Beta\\Application\\chrome.exe',
    ],
    'chrome-canary': [
      '%LOCALAPPDATA%\\Google\\Chrome SxS\\Application\\chrome.exe',
    ],
    'chrome-dev': [
      '%ProgramFiles%\\Google\\Chrome Dev\\Application\\chrome.exe',
      '%ProgramFiles(x86)%\\Google\\Chrome Dev\\Application\\chrome.exe',
      '%LOCALAPPDATA%\\Google\\Chrome Dev\\Application\\chrome.exe',
    ],
    'edge-beta': [
      '%ProgramFiles%\\Microsoft\\Edge Beta\\Application\\msedge.exe',
      '%ProgramFiles(x86)%\\Microsoft\\Edge Beta\\Application\\msedge.exe',
    ],
    'edge-canary': [
      '%LOCALAPPDATA%\\Microsoft\\Edge SxS\\Application\\msedge.exe',
    ],
    'edge-dev': [
      '%ProgramFiles%\\Microsoft\\Edge Dev\\Application\\msedge.exe',
      '%ProgramFiles(x86)%\\Microsoft\\Edge Dev\\Application\\msedge.exe',
    ],
    firefox: [
      '%ProgramFiles%\\Mozilla Firefox\\firefox.exe',
      '%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe',
    ],
    'firefox-nightly': [
      '%ProgramFiles%\\Nightly\\firefox.exe',
      '%ProgramFiles(x86)%\\Nightly\\firefox.exe',
    ],
    'firefox-developer-edition': [
      '%ProgramFiles%\\Firefox Developer Edition\\firefox.exe',
      '%ProgramFiles(x86)%\\Firefox Developer Edition\\firefox.exe',
    ],
    zen: [
      '%LOCALAPPDATA%\\Zen Browser\\zen.exe',
      '%ProgramFiles%\\Zen Browser\\zen.exe',
    ],
  },
  darwin: {
    chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
    edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    brave: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
    arc: ['/Applications/Arc.app/Contents/MacOS/Arc'],
    dia: ['/Applications/Dia.app/Contents/MacOS/Dia'],
    'chrome-beta': [
      '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
    ],
    'chrome-canary': [
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ],
    'chrome-dev': [
      '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
    ],
    'edge-beta': [
      '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta',
    ],
    'edge-canary': [
      '/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary',
    ],
    'edge-dev': [
      '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev',
    ],
    firefox: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
    'firefox-nightly': [
      '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
    ],
    'firefox-developer-edition': [
      '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
    ],
    zen: ['/Applications/Zen.app/Contents/MacOS/zen'],
  },
  linux: {
    chrome: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      'google-chrome',
      'google-chrome-stable',
    ],
    chromium: [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      'chromium',
      'chromium-browser',
    ],
    edge: [
      '/usr/bin/microsoft-edge',
      '/opt/microsoft/msedge/msedge',
      'microsoft-edge',
      'microsoft-edge-stable',
    ],
    brave: [
      '/usr/bin/brave-browser',
      '/usr/bin/brave',
      '/opt/brave.com/brave/brave',
      'brave-browser',
      'brave',
    ],
    arc: ['arc'],
    dia: ['dia'],
    'chrome-beta': ['/usr/bin/google-chrome-beta', 'google-chrome-beta'],
    'chrome-canary': ['google-chrome-canary'],
    'chrome-dev': ['/usr/bin/google-chrome-unstable', 'google-chrome-unstable'],
    'edge-beta': ['/usr/bin/microsoft-edge-beta', 'microsoft-edge-beta'],
    'edge-canary': ['microsoft-edge-canary'],
    'edge-dev': ['/usr/bin/microsoft-edge-dev', 'microsoft-edge-dev'],
    firefox: [
      '/usr/bin/firefox',
      '/snap/bin/firefox',
      '/usr/lib/firefox/firefox',
      'firefox',
    ],
    'firefox-nightly': ['/usr/bin/firefox-nightly', 'firefox-nightly'],
    'firefox-developer-edition': [
      '/usr/bin/firefox-developer-edition',
      'firefox-developer-edition',
    ],
    zen: [
      '/usr/bin/zen-browser',
      '/opt/zen-browser-bin/zen-bin',
      'zen-browser',
      'zen',
    ],
  },
};

export function tryFindBrowserBinary(
  options: FindBrowserBinaryOptions,
): string | null {
  return tryFindBinaryForTarget(options, options.target);
}

export function resolveBrowserBinary(
  options: FindBrowserBinaryOptions,
): ResolvedBrowserBinary | null {
  const allowFallback = options.allowFallback ?? true;
  const candidates: readonly LauncherTarget[] = allowFallback
    ? [options.target, ...(BROWSER_FALLBACKS[options.target] ?? [])]
    : [options.target];

  for (const candidate of candidates) {
    const binary = tryFindBinaryForTarget(options, candidate);

    if (binary !== null) {
      return {
        binary,
        requestedTarget: options.target,
        matchedTarget: candidate,
      };
    }
  }

  return null;
}

export function findBrowserBinary(
  options: FindBrowserBinaryOptions,
): string {
  const resolved = resolveBrowserBinary(options);

  if (resolved === null) {
    throw browserNotFoundError(options);
  }

  return resolved.binary;
}

export function browserNotFoundError(
  options: FindBrowserBinaryOptions,
): AddonovaError {
  const custom = options.binaries?.[options.target];

  return new AddonovaError({
    code: 'ADDONOVA_BROWSER_NOT_FOUND',
    severity: 'error',
    message:
      custom === undefined
        ? `Could not find an installed ${options.target} browser.`
        : `Could not find the configured ${options.target} browser binary: ${custom}`,
    suggestion:
      custom === undefined
        ? `Install ${options.target} or set "webExt.binaries.${options.target}" in your configuration.`
        : `Check the "webExt.binaries.${options.target}" path.`,
  });
}

function tryFindBinaryForTarget(
  options: FindBrowserBinaryOptions,
  target: LauncherTarget,
): string | null {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const root = options.root ?? process.cwd();
  const exists = options.exists ?? existsSync;
  const pathApi = getPathApi(platform);
  const custom = options.binaries?.[target];

  if (custom !== undefined) {
    return resolveCommand(custom, {
      root,
      platform,
      env,
      exists,
      pathApi,
    });
  }

  for (const candidate of getPlatformCandidates(platform, target)) {
    const expanded = expandEnvironmentVariables(candidate, env);

    if (isCommandName(expanded, pathApi)) {
      const resolved = resolveCommand(expanded, {
        root,
        platform,
        env,
        exists,
        pathApi,
      });

      if (resolved !== null) {
        return resolved;
      }

      continue;
    }

    if (exists(expanded)) {
      return expanded;
    }
  }

  return null;
}

interface ResolveCommandOptions {
  root: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  exists: (candidate: string) => boolean;
  pathApi: typeof path.win32;
}

function resolveCommand(
  command: string,
  options: ResolveCommandOptions,
): string | null {
  const { root, platform, env, exists, pathApi } = options;

  if (pathApi.isAbsolute(command)) {
    return exists(command) ? command : null;
  }

  if (!isCommandName(command, pathApi)) {
    const candidate = pathApi.resolve(root, command);
    return exists(candidate) ? candidate : null;
  }

  const pathEntries = (env.PATH ?? env.Path ?? '')
    .split(pathApi.delimiter)
    .filter((entry) => entry.length > 0);

  const extensions =
    platform === 'win32'
      ? getPathExtensions(command, env.PATHEXT)
      : [''];

  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = pathApi.join(directory, `${command}${extension}`);

      if (exists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function getPathExtensions(
  command: string,
  pathext: string | undefined,
): readonly string[] {
  if (path.extname(command).length > 0) {
    return [''];
  }

  const configured = (pathext ?? DEFAULT_PATHEXT)
    .split(';')
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0);

  return ['', ...configured];
}

function getPlatformCandidates(
  platform: NodeJS.Platform,
  target: LauncherTarget,
): readonly string[] {
  return BROWSER_PATHS[getPlatformKey(platform)][target] ?? [];
}

function getPlatformKey(platform: NodeJS.Platform): PlatformKey {
  if (platform === 'win32') {
    return 'win32';
  }

  if (platform === 'darwin') {
    return 'darwin';
  }

  return 'linux';
}

function getPathApi(platform: NodeJS.Platform): typeof path.win32 {
  return platform === 'win32' ? path.win32 : path.posix;
}

function isCommandName(value: string, pathApi: typeof path.win32): boolean {
  return !pathApi.isAbsolute(value) && !/[\\/]/.test(value);
}

function expandEnvironmentVariables(
  value: string,
  env: NodeJS.ProcessEnv,
): string {
  return value.replace(/%([^%]+)%/g, (match, name: string) => {
    const replacement = env[name];
    return replacement === undefined ? match : replacement;
  });
}
