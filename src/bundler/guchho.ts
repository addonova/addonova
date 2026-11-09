import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  BuildFailure,
  ServiceError,
  build as guchhoBuild,
  context as guchhoContext,
  stop as stopGuchho,
  version as guchhoVersion,
} from 'guchho';
import type {
  BuildContext as GuchhoBuildContext,
  BuildOptions,
  BuildResult as GuchhoBuildResult,
  EntryPoint,
  Loader,
  Message,
  Plugin,
  PluginContext,
} from 'guchho';

import { AddonovaError } from '../core/errors.ts';
import type { Diagnostic } from '../core/errors.ts';
import type {
  BundlerAdapter,
  BundlerBuildInput,
  BundlerBuildResult,
  BundlerContext,
  BundlerEntrypoint,
  BundlerTransform,
} from './adapter.ts';

const DEFAULT_EXTERNAL = ['@addonova/browser'] as const;

export const guchhoAdapter: BundlerAdapter = {
  name: 'guchho',
  version: guchhoVersion,

  async build(input: BundlerBuildInput): Promise<BundlerBuildResult> {
    validateBuildInput(input);

    const started = Date.now();
    const pluginNames = transformNames(input.transforms);

    try {
      const result = await guchhoBuild(toGuchhoBuildOptions(input));

      return toBundlerBuildResult(result, pluginNames);
    } catch (error) {
      return handleBuildError(error, started, pluginNames);
    }
  },

  async createContext(input: BundlerBuildInput): Promise<BundlerContext> {
    validateBuildInput(input);

    const pluginNames = transformNames(input.transforms);
    let context: GuchhoBuildContext;

    try {
      context = await guchhoContext(toGuchhoBuildOptions(input));
    } catch (error) {
      throw toContextError(error);
    }

    return {
      async rebuild(): Promise<BundlerBuildResult> {
        const started = Date.now();

        try {
          const result = await context.rebuild();

          return toBundlerBuildResult(result, pluginNames);
        } catch (error) {
          return handleBuildError(error, started, pluginNames);
        }
      },
      async dispose(): Promise<void> {
        await context.dispose();
      },
    };
  },

  async dispose(): Promise<void> {
    await stopGuchho();
  },
};

function toGuchhoBuildOptions(input: BundlerBuildInput): BuildOptions {
  const options = toGuchhoOptions(input);

  if (input.transforms !== undefined && input.transforms.length > 0) {
    options.plugins = input.transforms.map(createTransformPlugin);
  }

  return options;
}

export function toGuchhoOptions(input: BundlerBuildInput): BuildOptions {
  const options: BuildOptions = {
    absWorkingDir: input.root,
    outdir: input.outdir,
    entrypoints: input.entrypoints.map(toGuchhoEntryPoint),
    format: input.format ?? 'iife',
    platform: 'browser',
    bundle: input.bundle ?? true,
    splitting: input.splitting ?? false,
    treeShaking: input.treeShaking ?? input.mode === 'production',
    minify: input.minify ?? input.mode === 'production',
    minifyHtml: input.minifyHtml ?? input.minify ?? input.mode === 'production',
    metafile: input.metafile ?? true,
    allowOverwrite: true,
    logLevel: 'silent',
    external: [...DEFAULT_EXTERNAL, ...(input.external ?? [])],
  };

  if (input.sourcemap !== undefined) {
    options.sourcemap = input.sourcemap;
  }

  if (input.target !== undefined) {
    options.target =
      typeof input.target === 'string' ? input.target : [...input.target];
  }

  if (input.define !== undefined) {
    options.define = { ...input.define };
  }

  if (input.alias !== undefined) {
    options.alias = { ...input.alias };
  }

  if (input.loader !== undefined) {
    options.loader = { ...input.loader } as NonNullable<BuildOptions['loader']>;
  }

  return options;
}

function toBundlerBuildResult(
  result: GuchhoBuildResult,
  pluginNames: ReadonlySet<string>,
): BundlerBuildResult {
  return {
    success: result.success,
    duration: result.duration,
    outputs: result.outputs.map((output) => ({
      path: output.path,
      size: output.size,
    })),
    inputs: (result.inputs ?? []).map((file) => ({
      path: file.path,
      bytes: file.bytes,
    })),
    errors: result.errors.map((message) =>
      toDiagnostic(message, 'error', pluginNames),
    ),
    warnings: result.warnings.map((message) =>
      toDiagnostic(message, 'warning', pluginNames),
    ),
    ...(result.metafile === undefined ? {} : { metafile: result.metafile }),
  };
}

function handleBuildError(
  error: unknown,
  started: number,
  pluginNames: ReadonlySet<string>,
): BundlerBuildResult {
  if (error instanceof BuildFailure) {
    return {
      success: false,
      duration: Date.now() - started,
      outputs: [],
      inputs: [],
      errors: error.errors.map((message) =>
        toDiagnostic(message, 'error', pluginNames),
      ),
      warnings: error.warnings.map((message) =>
        toDiagnostic(message, 'warning', pluginNames),
      ),
    };
  }

  throw toContextError(error);
}

function toContextError(error: unknown): AddonovaError {
  if (error instanceof ServiceError) {
    return new AddonovaError({
      code: 'ADDONOVA_BUNDLER_SERVICE_FAILED',
      severity: 'error',
      message: `Guchho service failed: ${error.message}`,
      suggestion:
        'Reinstall the project dependencies and verify that the Guchho native binary can run.',
      cause: error,
    });
  }

  if (error instanceof AddonovaError) {
    return error;
  }

  return new AddonovaError({
    code: 'ADDONOVA_BUNDLER_FAILED',
    severity: 'error',
    message: `Guchho build failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
    suggestion: 'Run with --verbose to inspect the underlying error.',
    cause: error,
  });
}

function toGuchhoEntryPoint(entrypoint: BundlerEntrypoint): EntryPoint {
  return {
    in: entrypoint.input,
    out: entrypoint.output,
  };
}

function createTransformPlugin(transform: BundlerTransform): Plugin {
  return {
    name: transform.name,
    async load(this: PluginContext, id: string) {
      const loader = loaderForFile(id);

      if (loader === null) {
        return null;
      }

      if (transform.include !== undefined && !transform.include(id)) {
        return null;
      }

      try {
        const code = readFileSync(id, 'utf8');
        const result = await transform.transform(code, id);

        return {
          code: result ?? code,
          loader,
        };
      } catch (error) {
        this.error({
          message: `Plugin "${transform.name}" failed while transforming "${id}": ${errorMessage(error)}`,
          code: 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
        });
      }
    },
  };
}

function transformNames(
  transforms: readonly BundlerTransform[] | undefined,
): ReadonlySet<string> {
  return new Set((transforms ?? []).map((transform) => transform.name));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loaderForFile(id: string): Loader | null {
  switch (path.extname(id).toLowerCase()) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'js';
    case '.jsx':
      return 'jsx';
    case '.ts':
    case '.mts':
    case '.cts':
      return 'ts';
    case '.tsx':
      return 'tsx';
    case '.json':
      return 'json';
    case '.css':
      return 'css';
    case '.html':
    case '.htm':
      return 'html';
    case '.txt':
      return 'text';
    default:
      return null;
  }
}

function validateBuildInput(input: BundlerBuildInput): void {
  if (input.entrypoints.length === 0) {
    throw new AddonovaError({
      code: 'ADDONOVA_BUNDLER_NO_ENTRYPOINTS',
      severity: 'error',
      message: 'The Guchho adapter received no entrypoints.',
      suggestion: 'Configure at least one entrypoint before building.',
    });
  }

  const seen = new Set<string>();

  for (const entrypoint of input.entrypoints) {
    const output = entrypoint.output.trim();
    const key = output.toLowerCase();

    if (output === '') {
      throw new AddonovaError({
        code: 'ADDONOVA_BUNDLER_ENTRYPOINT_INVALID',
        severity: 'error',
        message: `Entrypoint "${entrypoint.name}" has an empty output name.`,
        suggestion: 'Give every entrypoint a non-empty output name.',
      });
    }

    if (seen.has(key)) {
      throw new AddonovaError({
        code: 'ADDONOVA_BUNDLER_ENTRYPOINT_DUPLICATE',
        severity: 'error',
        message: `Duplicate bundler output name "${entrypoint.output}".`,
        suggestion:
          'Output names must be unique because Guchho writes them to one directory.',
      });
    }

    seen.add(key);
  }
}

function toDiagnostic(
  message: Message,
  severity: 'error' | 'warning',
  pluginNames: ReadonlySet<string>,
): Diagnostic {
  const pluginError =
    severity === 'error' && pluginNames.has(message.pluginName);
  const diagnostic: Diagnostic = {
    code: pluginError
      ? 'ADDONOVA_PLUGIN_TRANSFORM_FAILED'
      : severity === 'error'
        ? 'ADDONOVA_BUNDLER_ERROR'
        : 'ADDONOVA_BUNDLER_WARNING',
    severity,
    message: message.text,
    cause: message,
  };

  if (pluginError) {
    diagnostic.suggestion =
      'Fix the plugin transform or the source file it processes.';
  }

  if (message.location !== null && message.location.file !== '') {
    diagnostic.location = {
      file: message.location.file,
      line: message.location.line,
      column: message.location.column + 1,
    };

    if (message.location.suggestion !== '') {
      diagnostic.suggestion = message.location.suggestion;
    }
  } else if (message.id !== '') {
    diagnostic.location = { file: message.id };
  }

  return diagnostic;
}
