import type {
  BundlerBuildResult,
  BundlerTransform,
} from '../bundler/adapter.ts';
import {
  AddonovaError,
  toDiagnostic,
} from '../core/errors.ts';
import type {
  Diagnostic,
  DiagnosticLocation,
} from '../core/errors.ts';
import type { AddonovaPlugin } from './types.ts';

export interface PluginManager {
  readonly plugins: readonly AddonovaPlugin[];
  readonly transforms: readonly BundlerTransform[];
  buildStart(): Promise<void>;
  buildEnd(): Promise<void>;
  takeDiagnostics(): readonly Diagnostic[];
}

const NO_PLUGINS: readonly AddonovaPlugin[] = [];

export function validatePlugins(
  plugins: readonly unknown[] | undefined,
  location?: DiagnosticLocation,
): readonly AddonovaPlugin[] {
  if (plugins === undefined) {
    return NO_PLUGINS;
  }

  if (!Array.isArray(plugins)) {
    throw pluginError(
      'ADDONOVA_PLUGIN_INVALID',
      'Config "plugins" must be an array.',
      'Pass an array of plugin objects.',
      location,
    );
  }

  const validated: AddonovaPlugin[] = [];
  const names = new Set<string>();

  for (const candidate of plugins) {
    if (!isPlainObject(candidate)) {
      throw pluginError(
        'ADDONOVA_PLUGIN_INVALID',
        'Every plugin must be an object with a name.',
        'Use { name: "my-plugin", transform(code, id) { ... } }.',
        location,
      );
    }

    const name = candidate.name;

    if (typeof name !== 'string' || name.trim() === '') {
      throw pluginError(
        'ADDONOVA_PLUGIN_INVALID',
        'Every plugin must have a non-empty name.',
        'Give each plugin a unique name such as "my-plugin".',
        location,
      );
    }

    if (names.has(name)) {
      throw pluginError(
        'ADDONOVA_PLUGIN_DUPLICATE_NAME',
        `Duplicate plugin name "${name}".`,
        'Give every plugin a unique name so errors can identify it.',
        location,
      );
    }

    for (const hook of ['buildStart', 'transform', 'buildEnd'] as const) {
      const value = candidate[hook];

      if (value !== undefined && typeof value !== 'function') {
        throw pluginError(
          'ADDONOVA_PLUGIN_INVALID',
          `Plugin "${name}" hook "${hook}" must be a function.`,
          `Remove the "${hook}" property or provide a function.`,
          location,
        );
      }
    }

    names.add(name);
    validated.push(candidate as unknown as AddonovaPlugin);
  }

  return validated;
}

export function createPluginManager(
  plugins: readonly AddonovaPlugin[],
): PluginManager {
  const normalized = validatePlugins(plugins);
  const diagnostics: Diagnostic[] = [];
  const transforms = normalized
    .filter((plugin) => plugin.transform !== undefined)
    .map((plugin) => createTransform(plugin, diagnostics));

  return {
    plugins: normalized,
    transforms,
    async buildStart(): Promise<void> {
      await runHook(
        normalized,
        'buildStart',
        'ADDONOVA_PLUGIN_BUILD_START_FAILED',
      );
    },
    async buildEnd(): Promise<void> {
      await runHook(normalized, 'buildEnd', 'ADDONOVA_PLUGIN_BUILD_END_FAILED');
    },
    takeDiagnostics(): readonly Diagnostic[] {
      return diagnostics.splice(0);
    },
  };
}

export function mergePluginDiagnostics(
  result: BundlerBuildResult,
  diagnostics: readonly Diagnostic[],
): BundlerBuildResult {
  if (diagnostics.length === 0) {
    return result;
  }

  return {
    ...result,
    success: false,
    errors: [
      ...result.errors.filter(
        (diagnostic) => diagnostic.code !== 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
      ),
      ...diagnostics,
    ],
  };
}

function createTransform(
  plugin: AddonovaPlugin,
  diagnostics: Diagnostic[],
): BundlerTransform {
  const transform = plugin.transform;

  if (transform === undefined) {
    throw new Error(`Plugin "${plugin.name}" has no transform hook.`);
  }

  return {
    name: plugin.name,
    async transform(code: string, id: string): Promise<string | null> {
      try {
        return await transform.call(plugin, code, id);
      } catch (error) {
        diagnostics.push(transformDiagnostic(plugin.name, id, error));
        throw error;
      }
    },
  };
}

async function runHook(
  plugins: readonly AddonovaPlugin[],
  hook: 'buildStart' | 'buildEnd',
  code: string,
): Promise<void> {
  for (const plugin of plugins) {
    const callback = plugin[hook];

    if (callback === undefined) {
      continue;
    }

    try {
      await callback.call(plugin);
    } catch (error) {
      throw pluginError(
        code,
        `Plugin "${plugin.name}" failed in ${hook}(): ${errorMessage(error)}`,
        'Fix the plugin hook or remove it from the plugin.',
        undefined,
        error,
      );
    }
  }
}

function transformDiagnostic(
  pluginName: string,
  file: string,
  error: unknown,
): Diagnostic {
  const diagnostic: Diagnostic = {
    code: 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
    severity: 'error',
    message: `Plugin "${pluginName}" failed while transforming "${file}": ${errorMessage(error)}`,
    location: { file },
    suggestion: 'Fix the plugin transform or the source file it processes.',
    cause: error,
  };

  const underlying = toDiagnostic(error);

  if (underlying.location !== undefined) {
    diagnostic.location = {
      file,
      ...(underlying.location.line === undefined
        ? {}
        : { line: underlying.location.line }),
      ...(underlying.location.column === undefined
        ? {}
        : { column: underlying.location.column }),
    };
  }

  return diagnostic;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pluginError(
  code: string,
  message: string,
  suggestion: string,
  location: DiagnosticLocation | undefined,
  cause?: unknown,
): AddonovaError {
  return new AddonovaError({
    code,
    severity: 'error',
    message,
    suggestion,
    ...(location === undefined ? {} : { location }),
    ...(cause === undefined ? {} : { cause }),
  });
}
