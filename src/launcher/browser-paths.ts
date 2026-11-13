import { existsSync } from 'node:fs';
import path from 'node:path';

import { AddonovaError } from '../core/errors.ts';
import type { BrowserTarget } from '../core/types.ts';
import type { WebExtConfig } from './types.ts';

export interface FindBrowserBinaryOptions {
  target: BrowserTarget;
  binaries?: WebExtConfig['binaries'];
  root?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (candidate: string) => boolean;
}

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

const WINDOWS_CANDIDATES: Readonly<Record<BrowserTarget, readonly string[]>> = {
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
  firefox: [
    '%ProgramFiles%\\Mozilla Firefox\\firefox.exe',
    '%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe',
  ],
};

const MACOS_CANDIDATES: Readonly<Record<BrowserTarget, readonly string[]>> = {
  chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
  edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  firefox: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
};

const LINUX_CANDIDATES: Readonly<Record<BrowserTarget, readonly string[]>> = {
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
  firefox: [
    '/usr/bin/firefox',
    '/snap/bin/firefox',
    '/usr/lib/firefox/firefox',
    'firefox',
  ],
};

export function tryFindBrowserBinary(
  options: FindBrowserBinaryOptions,
): string | null {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const root = options.root ?? process.cwd();
  const exists = options.exists ?? existsSync;
  const pathApi = getPathApi(platform);
  const custom = options.binaries?.[options.target];

  if (custom !== undefined) {
    return resolveCommand(custom, {
      root,
      platform,
      env,
      exists,
      pathApi,
    });
  }

  for (const candidate of getPlatformCandidates(platform, options.target)) {
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

export function findBrowserBinary(
  options: FindBrowserBinaryOptions,
): string {
  const binary = tryFindBrowserBinary(options);

  if (binary === null) {
    const custom = options.binaries?.[options.target];

    throw new AddonovaError({
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

  return binary;
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
  target: BrowserTarget,
): readonly string[] {
  if (platform === 'win32') {
    return WINDOWS_CANDIDATES[target];
  }

  if (platform === 'darwin') {
    return MACOS_CANDIDATES[target];
  }

  return LINUX_CANDIDATES[target];
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
