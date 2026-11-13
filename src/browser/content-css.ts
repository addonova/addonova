import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ResolvedConfig, ResolvedEntrypoint } from '../core/config.ts';
import { isEntrypointForBrowser } from '../core/entrypoints.ts';
import type { BrowserTarget } from '../core/types.ts';

export interface CollectContentScriptCssOptions {
  config: ResolvedConfig;
  browser: BrowserTarget;
  outdir: string;
  metafile: unknown;
}

interface MetafileOutput {
  inputs?: unknown;
}

export function collectContentScriptCss(
  options: CollectContentScriptCssOptions,
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, string[]>();
  const outputs = getMetafileOutputs(options.metafile);
  const root = options.config.root;

  if (outputs === undefined) {
    return result;
  }

  const contentScripts = options.config.entrypoints.filter(
    (entrypoint) =>
      entrypoint.type === 'content-script' &&
      isEntrypointForBrowser(entrypoint, options.browser),
  );

  for (const entrypoint of contentScripts) {
    const importedStyles = findImportedStyles(entrypoint.input);
    const css: string[] = [];

    for (const [outputPath, output] of Object.entries(outputs)) {
      if (!outputPath.toLowerCase().endsWith('.css')) {
        continue;
      }

      const inputs = getInputPaths(output, root);

      if (
        inputs.has(path.resolve(entrypoint.input)) ||
        importedStyles.some((style) => inputs.has(style))
      ) {
        css.push(toManifestPath(options.outdir, outputPath, root));
      }
    }

    if (css.length > 0) {
      result.set(entrypoint.name, unique(css));
    }
  }

  return result;
}

export function findImportedStyles(input: string): readonly string[] {
  let source: string;

  try {
    source = readFileSync(input, 'utf8');
  } catch {
    return [];
  }

  const directory = path.dirname(input);
  const styles = new Set<string>();
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+\.css)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+\.css)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source)) !== null) {
      const specifier = match[1];

      if (specifier === undefined || !specifier.startsWith('.')) {
        continue;
      }

      styles.add(path.resolve(directory, specifier));
    }
  }

  return [...styles];
}

function getMetafileOutputs(
  metafile: unknown,
): Record<string, MetafileOutput> | undefined {
  if (!isRecord(metafile)) {
    return undefined;
  }

  const outputs = metafile.outputs;

  return isRecord(outputs) ? (outputs as Record<string, MetafileOutput>) : undefined;
}

function getInputPaths(
  output: MetafileOutput,
  root: string,
): ReadonlySet<string> {
  const inputs = output.inputs;

  if (Array.isArray(inputs)) {
    const paths = new Set<string>();

    for (const entry of inputs) {
      if (typeof entry === 'string') {
        paths.add(path.resolve(root, entry));
      } else if (isRecord(entry) && typeof entry.path === 'string') {
        paths.add(path.resolve(root, entry.path));
      }
    }

    return paths;
  }

  if (isRecord(inputs)) {
    return new Set(
      Object.keys(inputs).map((input) => path.resolve(root, input)),
    );
  }

  return new Set();
}

function toManifestPath(
  outdir: string,
  outputPath: string,
  root: string,
): string {
  const absolute = path.resolve(root, outputPath);
  const relative = path.relative(outdir, absolute);

  if (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }

  return outputPath
    .replaceAll('\\', '/')
    .replace(/^\.?\//, '');
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function collectEntrypointIds(
  entrypoints: readonly ResolvedEntrypoint[],
): ReadonlySet<string> {
  return new Set(entrypoints.map((entrypoint) => entrypoint.name));
}
