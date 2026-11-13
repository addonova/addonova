import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';

import type {
  BundlerAdapter,
  BundlerBuildInput,
  BundlerBuildResult,
  BundlerEntrypoint,
  BundlerTransform,
} from '../bundler/adapter.ts';
import { guchhoAdapter } from '../bundler/guchho.ts';
import {
  assertBrowserApiInstalled,
  getBrowserApiBundlerSettings,
} from '../browser/api-integration.ts';
import { collectContentScriptCss } from '../browser/content-css.ts';
import {
  buildManifest,
  writeManifest,
} from '../browser/manifest.ts';
import { isEntrypointForBrowser } from './entrypoints.ts';
import { loadBuildEnv, toImportMetaEnvDefines } from './env.ts';
import {
  createPluginManager,
  mergePluginDiagnostics,
} from '../plugins/manager.ts';
import type { Diagnostic } from './errors.ts';
import type {
  ResolvedBrowser,
  ResolvedConfig,
  ResolvedEntrypoint,
} from './config.ts';

export interface ProjectBuildResult {
  browser: ResolvedBrowser;
  outdir: string;
  result: BundlerBuildResult;
  publicWarnings: readonly Diagnostic[];
  manifest: Readonly<Record<string, unknown>> | null;
  manifestPath: string | null;
  manifestDiagnostics: readonly Diagnostic[];
}

export interface BuildProjectOptions {
  adapter?: BundlerAdapter;
  dispose?: boolean;
  transforms?: readonly BundlerTransform[];
}

export async function buildProject(
  config: ResolvedConfig,
  options: BuildProjectOptions = {},
): Promise<readonly ProjectBuildResult[]> {
  const adapter = options.adapter ?? guchhoAdapter;
  const pluginManager = createPluginManager(config.plugins);
  const transforms = [
    ...pluginManager.transforms,
    ...(options.transforms ?? []),
  ];
  const reports: ProjectBuildResult[] = [];
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
        await adapter.build(
          toBundlerBuildInput(config, browser, outdir, transforms),
        ),
        pluginManager.takeDiagnostics(),
      );
      const publicCopy = result.success
        ? copyPublicDirectory(config.publicDir, outdir)
        : { copied: [], warnings: [] };
      const builtManifest = result.success
        ? buildManifest(config.manifest, browser, {
            outdir,
            checkFiles: true,
            mode: config.mode,
            command: 'build',
            defaults: config.manifestDefaults,
            entrypoints: config.entrypoints,
            convertManifest: config.convertManifest,
            iconDir: outdir,
            contentScriptCss: collectContentScriptCss({
              config,
              browser: browser.target,
              outdir,
              metafile: result.metafile,
            }),
          })
        : null;
      const manifestPath =
        builtManifest !== null && !builtManifest.hasErrors
          ? writeManifest(outdir, builtManifest.manifest)
          : null;

      reports.push({
        browser,
        outdir,
        result,
        publicWarnings: publicCopy.warnings,
        manifest: builtManifest?.manifest ?? null,
        manifestPath,
        manifestDiagnostics: builtManifest?.diagnostics ?? [],
      });
    }

    return reports;
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

export function toBundlerBuildInput(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
  outdir: string,
  transforms?: readonly BundlerTransform[],
): BundlerBuildInput {
  assertBrowserApiInstalled(config.root, config.browserApi);

  const browserApi = getBrowserApiBundlerSettings(
    browser.target,
    config.browserApi,
  );
  const env = loadBuildEnv({
    root: config.root,
    mode: config.mode,
    browser: browser.target,
    manifestVersion: browser.manifestVersion,
  });
  const define = {
    ...browserApi.define,
    ...toImportMetaEnvDefines(env),
  };

  return {
    root: config.root,
    outdir,
    mode: config.mode,
    entrypoints: toBundlerEntrypoints(
      config.entrypoints.filter((entrypoint) =>
        isEntrypointForBrowser(entrypoint, browser.target),
      ),
    ),
    format: 'iife',
    bundle: true,
    splitting: false,
    treeShaking: config.mode === 'production',
    minify: config.minify,
    minifyHtml: config.minify,
    sourcemap: config.sourcemap,
    metafile: true,
    ...(Object.keys(browserApi.alias).length === 0
      ? {}
      : { alias: browserApi.alias }),
    ...(Object.keys(define).length === 0 ? {} : { define }),
    external: [...browserApi.external],
    ...(transforms === undefined ? {} : { transforms }),
  };
}

export function getOutputDirectory(
  outdir: string,
  browser: ResolvedBrowser,
  browsers: readonly ResolvedBrowser[] = [browser],
): string {
  const versions = new Set(
    browsers
      .filter((candidate) => candidate.target === browser.target)
      .map((candidate) => candidate.manifestVersion),
  );
  const directory =
    versions.size > 1
      ? `${browser.target}-mv${browser.manifestVersion}`
      : browser.target;

  return path.join(outdir, directory);
}

export function toBundlerEntrypoints(
  entrypoints: readonly ResolvedEntrypoint[],
): readonly BundlerEntrypoint[] {
  return entrypoints.map((entrypoint) => ({
    name: entrypoint.name,
    input: entrypoint.input,
    output: getEntrypointOutputName(entrypoint),
    kind: entrypoint.kind,
  }));
}

export function getEntrypointOutputName(entrypoint: ResolvedEntrypoint): string {
  if (entrypoint.kind !== 'html') {
    return entrypoint.name;
  }

  return entrypoint.name.endsWith('.html')
    ? entrypoint.name
    : `${entrypoint.name}.html`;
}

export interface PublicCopyResult {
  copied: readonly string[];
  warnings: readonly Diagnostic[];
}

export interface PublicCopyOptions {
  generatedPaths?: ReadonlySet<string>;
}

export function copyPublicDirectory(
  publicDir: string,
  outdir: string,
  options: PublicCopyOptions = {},
): PublicCopyResult {
  if (!existsSync(publicDir)) {
    return { copied: [], warnings: [] };
  }

  const copied: string[] = [];
  const warnings: Diagnostic[] = [];

  walk('');

  return { copied, warnings };

  function walk(relativeDirectory: string): void {
    const sourceDirectory = path.join(publicDir, relativeDirectory);
    const entries = readdirSync(sourceDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      const sourcePath = path.join(publicDir, relativePath);
      const targetPath = path.join(outdir, relativePath);
      const pathKey = relativePath.split(path.sep).join('/');

      if (entry.isSymbolicLink()) {
        warnings.push({
          code: 'ADDONOVA_PUBLIC_SYMLINK_SKIPPED',
          severity: 'warning',
          message: `Public symlink "${relativePath}" was not copied.`,
          location: { file: sourcePath },
          suggestion: 'Replace the symlink with a real file or directory.',
        });
        continue;
      }

      if (entry.isDirectory()) {
        mkdirSync(targetPath, { recursive: true });
        walk(relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const collides =
        options.generatedPaths === undefined
          ? existsSync(targetPath)
          : options.generatedPaths.has(pathKey);

      if (collides) {
        warnings.push({
          code: 'ADDONOVA_PUBLIC_SKIPPED',
          severity: 'warning',
          message: `Public asset "${relativePath}" was not copied because the build already produced that path.`,
          location: { file: targetPath },
          suggestion:
            'Rename the generated output or the public asset so the paths do not collide.',
        });
        continue;
      }

      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
      copied.push(pathKey);
    }
  }
}
