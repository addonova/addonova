import type {
  BundlerAdapter,
  BundlerBuildResult,
  BundlerInput,
  BundlerOutput,
  BundlerTransform,
} from '../bundler/adapter.ts';
import { guchhoAdapter } from '../bundler/guchho.ts';
import {
  createPluginManager,
  mergePluginDiagnostics,
} from '../plugins/manager.ts';
import { getOutputDirectory, toBundlerBuildInput } from './build.ts';
import type { ResolvedBrowser, ResolvedConfig } from './config.ts';
import { AddonovaError } from './errors.ts';

export interface ProjectAnalysis {
  browser: ResolvedBrowser;
  outdir: string;
  outputs: readonly BundlerOutput[];
  inputs: readonly BundlerInput[];
  dependencies: readonly string[];
  totalBytes: number;
}

export interface AnalyzeProjectOptions {
  adapter?: BundlerAdapter;
  dispose?: boolean;
  transforms?: readonly BundlerTransform[];
}

export async function analyzeProject(
  config: ResolvedConfig,
  options: AnalyzeProjectOptions = {},
): Promise<readonly ProjectAnalysis[]> {
  const adapter = options.adapter ?? guchhoAdapter;
  const pluginManager = createPluginManager(config.plugins);
  const transforms = [
    ...pluginManager.transforms,
    ...(options.transforms ?? []),
  ];
  const analyses: ProjectAnalysis[] = [];
  let started = false;

  try {
    await pluginManager.buildStart();
    started = true;

    for (const browser of config.browsers) {
      const outdir = getOutputDirectory(
        config.outdir,
        browser,
        config.browsers,
      );
      const result = mergePluginDiagnostics(
        await adapter.build({
          ...toBundlerBuildInput(config, browser, outdir, transforms),
          write: false,
        }),
        pluginManager.takeDiagnostics(),
      );

      if (!result.success) {
        throw analyzeFailure(browser, outdir, result);
      }

      analyses.push({
        browser,
        outdir,
        outputs: result.outputs,
        inputs: result.inputs,
        dependencies: extractDependencies(result.metafile),
        totalBytes: result.outputs.reduce(
          (total, output) => total + output.size,
          0,
        ),
      });
    }

    return analyses;
  } finally {
    try {
      if (started) {
        await pluginManager.buildEnd();
      }
    } finally {
      if (options.dispose ?? true) {
        await adapter.dispose?.();
      }
    }
  }
}

export function extractDependencies(metafile: unknown): readonly string[] {
  if (!isRecord(metafile) || !isRecord(metafile.outputs)) {
    return [];
  }

  const dependencies = new Set<string>();

  for (const output of Object.values(metafile.outputs)) {
    if (!isRecord(output) || !Array.isArray(output.imports)) {
      continue;
    }

    for (const edge of output.imports) {
      if (isRecord(edge) && typeof edge.path === 'string') {
        dependencies.add(edge.path);
      }
    }
  }

  return [...dependencies].sort();
}

function analyzeFailure(
  browser: ResolvedBrowser,
  outdir: string,
  result: BundlerBuildResult,
): AddonovaError {
  const first = result.errors[0];

  return new AddonovaError({
    code: 'ADDONOVA_ANALYZE_FAILED',
    severity: 'error',
    message: `Failed to analyze ${browser.target} MV${browser.manifestVersion}${
      first === undefined ? '.' : `: ${first.message}`
    }`,
    location: first?.location ?? { file: outdir },
    suggestion: 'Fix the reported build errors and run the analysis again.',
    ...(first === undefined ? {} : { cause: first }),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
