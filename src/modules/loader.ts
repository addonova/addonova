import { readdirSync } from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';

import type { AddonovaUserConfig, ResolvedEntrypoint } from '../core/config.ts';
import {
  resolveEntrypointDefinition,
} from '../core/entrypoints.ts';
import { AddonovaError } from '../core/errors.ts';
import type { BuildMode } from '../core/types.ts';
import type { HookManager } from '../hooks/manager.ts';
import type {
  AddonovaModule,
  AddonovaModuleContext,
  AddonovaModuleInput,
  ModuleEntrypointOptions,
  ModuleResolution,
} from './types.ts';

const MODULE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

export interface ResolveModulesOptions {
  root: string;
  configPath: string | null;
  config: AddonovaUserConfig;
  mode: BuildMode;
  hooks: HookManager;
}

interface EntrypointCollector {
  entrypoints: ResolvedEntrypoint[];
  add(
    name: string,
    input: string,
    options?: ModuleEntrypointOptions,
  ): ResolvedEntrypoint;
}

interface LoadedModule {
  module: AddonovaModule;
  options: unknown;
  file: string | null;
}

export async function resolveModules(
  options: ResolveModulesOptions,
): Promise<ModuleResolution> {
  const modules: AddonovaModule[] = [];
  const files: string[] = [];
  const alias: Record<string, string> = {};
  const entrypoints = createEntrypointCollector(options.root, options.configPath);
  const names = new Set<string>();

  const register = async (
    loaded: LoadedModule,
    source: string,
  ): Promise<void> => {
    const module = loaded.module;

    if (names.has(module.name)) {
      throw moduleError(
        'ADDONOVA_MODULE_DUPLICATE',
        `Duplicate module name "${module.name}".`,
        'Give every module a unique name.',
        source,
      );
    }

    names.add(module.name);
    modules.push(module);

    if (loaded.file !== null) {
      files.push(loaded.file);
    }

    const context = createModuleContext({
      ...options,
      module,
      options: loaded.options,
      entrypoints,
      alias,
    });

    try {
      await module.setup(context);
    } catch (error) {
      if (error instanceof AddonovaError) {
        throw error;
      }

      throw moduleError(
        'ADDONOVA_MODULE_SETUP_FAILED',
        `Module "${module.name}" failed during setup: ${errorMessage(error)}`,
        'Fix the module setup function or remove the module from the build.',
        source,
        error,
      );
    }
  };

  for (const [index, input] of (options.config.modules ?? []).entries()) {
    const loaded = await loadConfiguredModule(
      input,
      index,
      options.root,
      options.configPath,
      options.config,
    );

    await register(loaded, loaded.file ?? `modules[${index}]`);
  }

  for (const file of discoverLocalModuleFiles(options.root)) {
    const loaded = await loadLocalModule(
      file,
      options.root,
      options.config,
      options.configPath,
    );

    await register(loaded, file);
  }

  return {
    modules,
    files,
    entrypoints: entrypoints.entrypoints,
    alias,
  };
}

function createModuleContext(input: {
  root: string;
  configPath: string | null;
  config: AddonovaUserConfig;
  mode: BuildMode;
  hooks: HookManager;
  module: AddonovaModule;
  options: unknown;
  entrypoints: EntrypointCollector;
  alias: Record<string, string>;
}): AddonovaModuleContext {
  return {
    root: input.root,
    configPath: input.configPath,
    mode: input.mode,
    options: input.options,
    config: input.config,
    hooks: {
      on(event, handler) {
        input.hooks.on(input.module.name, event, handler);
      },
    },
    addEntrypoint(name, entrypointInput, entrypointOptions) {
      input.entrypoints.add(name, entrypointInput, entrypointOptions);
    },
    addAlias(name, target) {
      if (name.trim() === '' || target.trim() === '') {
        throw moduleError(
          'ADDONOVA_MODULE_INVALID',
          `Module "${input.module.name}" must provide a non-empty alias name and target.`,
          'Use addAlias("@", "src").',
          input.module.name,
        );
      }

      input.alias[name] = isPathTarget(target)
        ? path.resolve(input.root, target)
        : target;
    },
    addFile(relativePath, contents) {
      const normalized = normalizeAssetPath(
        relativePath,
        input.module.name,
        input.configPath,
      );

      input.hooks.on(input.module.name, 'build:publicAssets', (payload) => {
        payload.assets.push({ path: normalized, contents });
      });
    },
  };
}

async function loadConfiguredModule(
  input: AddonovaModuleInput,
  index: number,
  root: string,
  configPath: string | null,
  config: AddonovaUserConfig,
): Promise<LoadedModule> {
  if (typeof input === 'string') {
    const file = isPathTarget(input) ? path.resolve(root, input) : null;
    const loaded = await importModule(input, root, configPath, `modules[${index}]`);
    const module = validateModule(loaded, `modules[${index}]`, configPath);

    return {
      module,
      options: readConfigKeyOptions(module, config),
      file,
    };
  }

  if (Array.isArray(input)) {
    if (input.length !== 2 || typeof input[0] !== 'string') {
      throw moduleError(
        'ADDONOVA_MODULE_INVALID',
        `Module entry at index ${index} must be [specifier, options].`,
        'Use ["addonova-module-example", { ... }] or a module object.',
        configPath ?? `modules[${index}]`,
      );
    }

    const specifier = input[0];
    const file = isPathTarget(specifier) ? path.resolve(root, specifier) : null;
    const loaded = await importModule(
      specifier,
      root,
      configPath,
      `modules[${index}]`,
    );
    const module = validateModule(loaded, `modules[${index}]`, configPath);

    return { module, options: input[1], file };
  }

  const module = validateModule(input, `modules[${index}]`, configPath);

  return {
    module,
    options: readConfigKeyOptions(module, config),
    file: null,
  };
}

async function loadLocalModule(
  file: string,
  root: string,
  config: AddonovaUserConfig,
  configPath: string | null,
): Promise<LoadedModule> {
  const loaded = await importModule(file, root, configPath, file);
  const module = validateModule(loaded, file, configPath);

  return {
    module,
    options: readConfigKeyOptions(module, config),
    file,
  };
}

async function importModule(
  specifier: string,
  root: string,
  configPath: string | null,
  source: string,
): Promise<unknown> {
  const resolved = isPathTarget(specifier)
    ? path.resolve(root, specifier)
    : specifier;
  const jiti = createJiti(path.join(root, 'package.json'), {
    fsCache: false,
    moduleCache: false,
    interopDefault: true,
  });

  try {
    return await jiti.import<unknown>(resolved, { default: true });
  } catch (error) {
    throw moduleError(
      'ADDONOVA_MODULE_LOAD_FAILED',
      `Failed to load module: ${resolved}`,
      'Check the module name or path and ensure it exports a module definition.',
      configPath ?? source,
      error,
    );
  }
}

function validateModule(
  value: unknown,
  source: string,
  configPath: string | null,
): AddonovaModule {
  if (!isPlainObject(value)) {
    throw moduleError(
      'ADDONOVA_MODULE_INVALID',
      'A module must export an object.',
      'Export defineAddonovaModule({ name, setup() { ... } }).',
      configPath ?? source,
    );
  }

  if (typeof value.name !== 'string' || value.name.trim() === '') {
    throw moduleError(
      'ADDONOVA_MODULE_INVALID',
      'A module must have a non-empty name.',
      'Provide a unique name for every module.',
      configPath ?? source,
    );
  }

  if (
    value.configKey !== undefined &&
    (typeof value.configKey !== 'string' || value.configKey.trim() === '')
  ) {
    throw moduleError(
      'ADDONOVA_MODULE_INVALID',
      `Module "${value.name}" configKey must be a non-empty string.`,
      'Remove configKey or provide a config section name.',
      configPath ?? source,
    );
  }

  if (typeof value.setup !== 'function') {
    throw moduleError(
      'ADDONOVA_MODULE_INVALID',
      `Module "${value.name}" must provide a setup() function.`,
      'Use defineAddonovaModule({ name, setup(context) { ... } }).',
      configPath ?? source,
    );
  }

  return value as unknown as AddonovaModule;
}

function readConfigKeyOptions(
  module: AddonovaModule,
  config: AddonovaUserConfig,
): unknown {
  if (module.configKey === undefined) {
    return undefined;
  }

  return (config as unknown as Record<string, unknown>)[module.configKey];
}

function createEntrypointCollector(
  root: string,
  configPath: string | null,
): EntrypointCollector {
  const entrypoints: ResolvedEntrypoint[] = [];

  return {
    entrypoints,
    add(name, input, options = {}) {
      if (entrypoints.some((entrypoint) => entrypoint.name === name)) {
        throw moduleError(
          'ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT',
          `Duplicate entrypoint name "${name}".`,
          'Give every entrypoint a unique name.',
          configPath,
        );
      }

      const descriptor = resolveEntrypointDefinition({
        root,
        name,
        input,
        selection: options,
        configPath,
      });
      const resolved: ResolvedEntrypoint = {
        name,
        input: descriptor.input,
        kind: descriptor.kind,
      };

      if (
        options.type !== undefined ||
        Object.keys(descriptor.manifestOptions).length > 0
      ) {
        resolved.type = descriptor.type;
        resolved.manifestOptions = descriptor.manifestOptions;
      }

      entrypoints.push(resolved);

      return resolved;
    },
  };
}

function discoverLocalModuleFiles(root: string): readonly string[] {
  let entries;

  try {
    entries = readdirSync(path.join(root, 'modules'), { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const name = entry.name.toLowerCase();

      return (
        !entry.name.startsWith('.') &&
        !entry.name.startsWith('_') &&
        !name.endsWith('.d.ts') &&
        !name.includes('.test.') &&
        !name.includes('.spec.') &&
        MODULE_EXTENSIONS.has(path.extname(name))
      );
    })
    .map((entry) => path.join(root, 'modules', entry.name))
    .sort((left, right) => {
      const leftName = path.basename(left);
      const rightName = path.basename(right);

      return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
    });
}

function normalizeAssetPath(
  relativePath: string,
  moduleName: string,
  configPath: string | null,
): string {
  const normalized = relativePath.replaceAll('\\', '/');

  if (
    normalized.trim() === '' ||
    path.isAbsolute(normalized) ||
    path.posix.isAbsolute(normalized) ||
    normalized.split('/').includes('..')
  ) {
    throw moduleError(
      'ADDONOVA_MODULE_INVALID',
      `Module "${moduleName}" generated an invalid asset path "${relativePath}".`,
      'Use a relative path inside the output directory, such as "generated/config.json".',
      configPath ?? moduleName,
    );
  }

  return normalized;
}

function isPathTarget(value: string): boolean {
  return (
    path.isAbsolute(value) ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('.\\') ||
    value.startsWith('..\\')
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function moduleError(
  code: string,
  message: string,
  suggestion: string,
  source: string | null,
  cause?: unknown,
): AddonovaError {
  return new AddonovaError({
    code,
    severity: 'error',
    message,
    suggestion,
    ...(source === null ? {} : { location: { file: source } }),
    ...(cause === undefined ? {} : { cause }),
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
