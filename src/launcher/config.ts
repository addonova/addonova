import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { isBrowserTarget } from '../core/types.ts';
import type { BrowserTarget } from '../core/types.ts';
import { loadConfigModule } from '../core/config-module.ts';
import { AddonovaError } from '../core/errors.ts';
import type {
  ResolvedWebExtConfig,
  WebExtConfig,
} from './types.ts';

export const WEB_EXT_CONFIG_FILENAMES = [
  'web-ext.config.ts',
  'web-ext.config.js',
  'web-ext.config.mjs',
  'web-ext.config.json',
] as const;

export function defineWebExtConfig<T extends WebExtConfig>(config: T): T {
  return config;
}

export function findWebExtConfigFile(directory: string): string | null {
  for (const filename of WEB_EXT_CONFIG_FILENAMES) {
    const candidate = path.join(directory, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function loadWebExtConfigFile(
  filePath: string,
): Promise<WebExtConfig> {
  let loaded: unknown;

  if (path.extname(filePath).toLowerCase() === '.json') {
    try {
      loaded = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    } catch (error) {
      throw new AddonovaError({
        code: 'ADDONOVA_WEB_EXT_CONFIG_LOAD_FAILED',
        severity: 'error',
        message: `Failed to load web-ext configuration: ${filePath}`,
        location: { file: filePath },
        suggestion: 'Check the web-ext configuration file for syntax errors.',
        cause: error,
      });
    }
  } else {
    loaded = await loadConfigModule(filePath, {
      code: 'ADDONOVA_WEB_EXT_CONFIG_LOAD_FAILED',
      message: 'Failed to load web-ext configuration',
      suggestion: 'Check the web-ext configuration file for syntax or runtime errors.',
    });
  }

  assertWebExtConfigObject(loaded, filePath);

  return loaded;
}

export interface ResolveWebExtConfigOptions {
  root: string;
  homeDir?: string;
}

export async function resolveWebExtConfig(
  baseConfig: WebExtConfig | undefined,
  options: ResolveWebExtConfigOptions,
): Promise<WebExtConfig> {
  const homeDir = options.homeDir ?? os.homedir();
  const globalConfigPath = findWebExtConfigFile(
    path.join(homeDir, '.addonova'),
  );
  const projectConfigPath = findWebExtConfigFile(options.root);

  const globalConfig =
    globalConfigPath === null
      ? undefined
      : await loadWebExtConfigFile(globalConfigPath);
  const projectConfig =
    projectConfigPath === null
      ? undefined
      : await loadWebExtConfigFile(projectConfigPath);

  return mergeWebExtConfig(globalConfig, baseConfig, projectConfig);
}

export function mergeWebExtConfig(
  ...sources: readonly (WebExtConfig | undefined)[]
): WebExtConfig {
  const merged: WebExtConfig = {};
  let binaries: Partial<Record<BrowserTarget, string>> | undefined;

  for (const source of sources) {
    if (source === undefined) {
      continue;
    }

    assertWebExtConfigObject(source, null);

    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) {
        continue;
      }

      if (key === 'binaries') {
        binaries = {
          ...(binaries ?? {}),
          ...(value as Partial<Record<BrowserTarget, string>>),
        };
        continue;
      }

      (merged as Record<string, unknown>)[key] = value;
    }
  }

  if (binaries !== undefined) {
    merged.binaries = binaries;
  }

  return merged;
}

export function normalizeWebExtConfig(
  config: WebExtConfig | undefined,
  configPath: string | null,
): ResolvedWebExtConfig {
  if (config === undefined) {
    return createDefaultWebExtConfig();
  }

  assertWebExtConfigObject(config, configPath);

  const binaries = config.binaries ?? {};

  return {
    disabled: config.disabled ?? false,
    binaries: { ...binaries },
    chromiumArgs: config.chromiumArgs ?? [],
    firefoxArgs: config.firefoxArgs ?? [],
    chromiumProfile: config.chromiumProfile ?? null,
    firefoxProfile: config.firefoxProfile ?? null,
    keepProfileChanges: config.keepProfileChanges ?? false,
    startUrls: config.startUrls ?? [],
  };
}

export function createDefaultWebExtConfig(): ResolvedWebExtConfig {
  return {
    disabled: false,
    binaries: {},
    chromiumArgs: [],
    firefoxArgs: [],
    chromiumProfile: null,
    firefoxProfile: null,
    keepProfileChanges: false,
    startUrls: [],
  };
}

function assertWebExtConfigObject(
  value: unknown,
  configPath: string | null,
): asserts value is WebExtConfig {
  if (!isPlainObject(value)) {
    throw invalidWebExtConfig(
      configPath,
      'The web-ext configuration must export an object.',
    );
  }

  validateOptionalBoolean(value, 'disabled', configPath);
  validateBinaries(value.binaries, configPath);
  validateOptionalStringArray(value, 'chromiumArgs', configPath);
  validateOptionalStringArray(value, 'firefoxArgs', configPath);
  validateOptionalString(value, 'chromiumProfile', configPath);
  validateOptionalString(value, 'firefoxProfile', configPath);
  validateOptionalBoolean(value, 'keepProfileChanges', configPath);
  validateOptionalStringArray(value, 'startUrls', configPath);
}

function validateBinaries(
  value: unknown,
  configPath: string | null,
): void {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value)) {
    throw invalidWebExtConfig(
      configPath,
      'The "webExt.binaries" option must be an object.',
    );
  }

  for (const [target, binary] of Object.entries(value)) {
    if (!isBrowserTarget(target)) {
      throw invalidWebExtConfig(
        configPath,
        `The "webExt.binaries" option contains an unsupported browser target "${target}".`,
        'Use one of: chrome, chromium, edge, firefox.',
      );
    }

    if (typeof binary !== 'string' || binary.trim().length === 0) {
      throw invalidWebExtConfig(
        configPath,
        `The "webExt.binaries.${target}" option must be a non-empty string.`,
      );
    }
  }
}

function validateOptionalBoolean(
  value: Record<string, unknown>,
  key: string,
  configPath: string | null,
): void {
  const option = value[key];

  if (option !== undefined && typeof option !== 'boolean') {
    throw invalidWebExtConfig(
      configPath,
      `The "webExt.${key}" option must be a boolean.`,
    );
  }
}

function validateOptionalString(
  value: Record<string, unknown>,
  key: string,
  configPath: string | null,
): void {
  const option = value[key];

  if (
    option !== undefined &&
    (typeof option !== 'string' || option.trim().length === 0)
  ) {
    throw invalidWebExtConfig(
      configPath,
      `The "webExt.${key}" option must be a non-empty string.`,
    );
  }
}

function validateOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  configPath: string | null,
): void {
  const option = value[key];

  if (option === undefined) {
    return;
  }

  if (
    !Array.isArray(option) ||
    option.some((entry) => typeof entry !== 'string')
  ) {
    throw invalidWebExtConfig(
      configPath,
      `The "webExt.${key}" option must be an array of strings.`,
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
}

function invalidWebExtConfig(
  configPath: string | null,
  message: string,
  suggestion = 'Check the web-ext configuration and the "webExt" option.',
): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_WEB_EXT_CONFIG_INVALID',
    severity: 'error',
    message,
    ...(configPath === null ? {} : { location: { file: configPath } }),
    suggestion,
  });
}
