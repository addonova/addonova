import { AddonovaError } from '../core/errors.ts';
import { DATA_PERSISTENCE_MODES, isLauncherTarget, LAUNCHER_TARGETS } from './types.ts';
import type {
  LauncherTarget,
  ResolvedWebExtConfig,
  WebExtConfig,
} from './types.ts';

export function mergeWebExtConfig(
  ...sources: readonly (WebExtConfig | undefined)[]
): WebExtConfig {
  const merged: WebExtConfig = {};
  let binaries: Partial<Record<LauncherTarget, string>> | undefined;

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
          ...(value as Partial<Record<LauncherTarget, string>>),
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
    dataPersistence: config.dataPersistence ?? 'none',
    projectDataDir: config.projectDataDir ?? null,
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
    dataPersistence: 'none',
    projectDataDir: null,
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
      'The "webExt" option must be an object.',
    );
  }

  validateOptionalBoolean(value, 'disabled', configPath);
  validateBinaries(value.binaries, configPath);
  validateOptionalStringArray(value, 'chromiumArgs', configPath);
  validateOptionalStringArray(value, 'firefoxArgs', configPath);
  validateOptionalString(value, 'chromiumProfile', configPath);
  validateOptionalString(value, 'firefoxProfile', configPath);
  validateOptionalBoolean(value, 'keepProfileChanges', configPath);
  validateDataPersistence(value.dataPersistence, configPath);
  validateOptionalString(value, 'projectDataDir', configPath);
  validateOptionalStringArray(value, 'startUrls', configPath);
}

function validateDataPersistence(
  value: unknown,
  configPath: string | null,
): void {
  if (value === undefined) {
    return;
  }

  if (
    typeof value !== 'string' ||
    !(DATA_PERSISTENCE_MODES as readonly string[]).includes(value)
  ) {
    throw invalidWebExtConfig(
      configPath,
      'The "webExt.dataPersistence" option must be "none", "project", or "user".',
      `Use one of: ${DATA_PERSISTENCE_MODES.join(', ')}.`,
    );
  }
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
    if (!isLauncherTarget(target)) {
      throw invalidWebExtConfig(
        configPath,
        `The "webExt.binaries" option contains an unsupported browser target "${target}".`,
        `Use one of: ${LAUNCHER_TARGETS.join(', ')}.`,
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
  suggestion = 'Check the "webExt" option.',
): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_WEB_EXT_CONFIG_INVALID',
    severity: 'error',
    message,
    ...(configPath === null ? {} : { location: { file: configPath } }),
    suggestion,
  });
}
