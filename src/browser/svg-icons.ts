import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Diagnostic } from '../core/errors.ts';
import { encodePng } from './svg/png.ts';
import { downsample, renderScene } from './svg/rasterize.ts';
import { parseSvg } from './svg/scene.ts';

export const DEFAULT_ICON_SIZES: readonly number[] = [32, 48, 64, 128];

const SUPERSAMPLE = 4;

export interface SvgIconConversionOptions {
  sizes: readonly number[];
  outdir: string;
}

export interface SvgIconConversionResult {
  manifest: Record<string, unknown>;
  generated: readonly string[];
  diagnostics: readonly Diagnostic[];
}

interface IconReference {
  field: string;
  path: string;
  size: number | null;
}

export function convertSvgIcons(
  manifest: Record<string, unknown>,
  options: SvgIconConversionOptions,
): SvgIconConversionResult {
  const diagnostics: Diagnostic[] = [];
  const references = collectReferences(manifest);

  if (references.length === 0) {
    return { manifest, generated: [], diagnostics };
  }

  const requests = new Map<string, Set<number>>();

  for (const reference of references) {
    const sizes = requests.get(reference.path) ?? new Set<number>();

    if (reference.size === null) {
      for (const size of options.sizes) {
        sizes.add(size);
      }
    } else {
      sizes.add(reference.size);
    }

    requests.set(reference.path, sizes);
  }

  const generated = new Map<string, Map<number, string>>();
  const files: string[] = [];
  const validSizes = options.sizes.filter((size) => Number.isInteger(size) && size > 0);
  const fallbackSizes = validSizes.length > 0 ? validSizes : DEFAULT_ICON_SIZES;

  for (const [sourcePath, sizes] of requests) {
    const ordered = [...sizes]
      .filter((size) => Number.isInteger(size) && size > 0)
      .sort((left, right) => left - right);

    if (ordered.length === 0) {
      continue;
    }

    const result = renderIcon(sourcePath, ordered, options, diagnostics);

    if (result === null) {
      continue;
    }

    generated.set(sourcePath, result);
    files.push(...result.values());
  }

  rewriteReferences(manifest, generated, fallbackSizes);

  return { manifest, generated: files, diagnostics };
}

function renderIcon(
  sourcePath: string,
  sizes: readonly number[],
  options: SvgIconConversionOptions,
  diagnostics: Diagnostic[],
): Map<number, string> | null {
  const absoluteSource = path.join(options.outdir, sourcePath.replaceAll('/', path.sep));

  if (!existsSync(absoluteSource)) {
    diagnostics.push({
      code: 'ADDONOVA_ICON_SVG_MISSING',
      severity: 'error',
      message: `SVG icon "${sourcePath}" could not be found in the build output.`,
      location: { file: absoluteSource },
      suggestion: 'Add the SVG to the public directory or fix the manifest path.',
    });

    return null;
  }

  let scene;

  try {
    scene = parseSvg(readFileSync(absoluteSource, 'utf8'));
  } catch (error) {
    diagnostics.push({
      code: 'ADDONOVA_ICON_SVG_INVALID',
      severity: 'error',
      message: `Failed to parse SVG icon "${sourcePath}": ${error instanceof Error ? error.message : String(error)}`,
      location: { file: absoluteSource },
      suggestion: 'Simplify the SVG or provide a PNG icon instead.',
      cause: error,
    });

    return null;
  }

  for (const warning of scene.warnings) {
    diagnostics.push({
      code: 'ADDONOVA_ICON_SVG_UNSUPPORTED',
      severity: 'warning',
      message: `${sourcePath}: ${warning}`,
      location: { file: absoluteSource },
      suggestion: 'Simplify the SVG or provide a pre-rendered PNG icon.',
    });
  }

  const maxSize = Math.max(...sizes);
  let highResolution;

  try {
    highResolution = renderScene(scene, maxSize * SUPERSAMPLE, maxSize * SUPERSAMPLE);
  } catch (error) {
    diagnostics.push({
      code: 'ADDONOVA_ICON_SVG_INVALID',
      severity: 'error',
      message: `Failed to render SVG icon "${sourcePath}": ${error instanceof Error ? error.message : String(error)}`,
      location: { file: absoluteSource },
      suggestion: 'Simplify the SVG or provide a PNG icon instead.',
      cause: error,
    });

    return null;
  }

  const outputs = new Map<number, string>();
  const parsed = path.posix.parse(sourcePath.replaceAll('\\', '/'));
  const base = parsed.name.replace(/-\d+$/, '');
  const directory = parsed.dir === '' ? '' : `${parsed.dir}/`;

  for (const size of sizes) {
    const image = downsample(highResolution, size, size);
    const relativePath = `${directory}${base}-${size}.png`;
    const absoluteTarget = path.join(options.outdir, relativePath.replaceAll('/', path.sep));

    mkdirSync(path.dirname(absoluteTarget), { recursive: true });
    writeFileSync(absoluteTarget, encodePng(image));

    outputs.set(size, relativePath);
    diagnostics.push({
      code: 'ADDONOVA_ICON_SVG_CONVERTED',
      severity: 'info',
      message: `Converted "${sourcePath}" to "${relativePath}" (${size}px).`,
      location: { file: absoluteTarget },
    });
  }

  return outputs;
}

function collectReferences(manifest: Record<string, unknown>): IconReference[] {
  const references: IconReference[] = [];

  collectIconField(references, 'icons', manifest.icons);
  const action = asRecord(manifest.action);
  const browserAction = asRecord(manifest.browser_action);
  const pageAction = asRecord(manifest.page_action);

  collectIconField(references, 'action.default_icon', action?.default_icon);
  collectIconField(
    references,
    'browser_action.default_icon',
    browserAction?.default_icon,
  );
  collectIconField(
    references,
    'page_action.default_icon',
    pageAction?.default_icon,
  );
  collectThemeIcons(references, manifest.theme_icons);

  return references;
}

function collectIconField(
  references: IconReference[],
  field: string,
  value: unknown,
): void {
  if (typeof value === 'string') {
    if (isSvgPath(value)) {
      references.push({ field, path: normalize(value), size: null });
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && isSvgPath(entry)) {
      const size = Number.parseInt(key, 10);

      references.push({
        field,
        path: normalize(entry),
        size: Number.isInteger(size) && size > 0 ? size : null,
      });
    }
  }
}

function collectThemeIcons(
  references: IconReference[],
  value: unknown,
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const size = typeof entry.size === 'number' ? entry.size : null;

    if (typeof entry.light === 'string' && isSvgPath(entry.light)) {
      references.push({ field: 'theme_icons.light', path: normalize(entry.light), size });
    }

    if (typeof entry.dark === 'string' && isSvgPath(entry.dark)) {
      references.push({ field: 'theme_icons.dark', path: normalize(entry.dark), size });
    }
  }
}

function rewriteReferences(
  manifest: Record<string, unknown>,
  generated: Map<string, Map<number, string>>,
  fallbackSizes: readonly number[],
): void {
  rewriteIconField(manifest, 'icons', generated, fallbackSizes);
  rewriteIconField(asRecord(manifest.action), 'default_icon', generated, fallbackSizes);
  rewriteIconField(
    asRecord(manifest.browser_action),
    'default_icon',
    generated,
    fallbackSizes,
  );
  rewriteIconField(
    asRecord(manifest.page_action),
    'default_icon',
    generated,
    fallbackSizes,
  );
  rewriteThemeIcons(manifest, generated, fallbackSizes);
}

function rewriteIconField(
  owner: Record<string, unknown> | null | undefined,
  key: string,
  generated: Map<string, Map<number, string>>,
  fallbackSizes: readonly number[],
): void {
  if (owner === null || owner === undefined) {
    return;
  }

  const value = owner[key];

  if (typeof value === 'string' && isSvgPath(value)) {
    const outputs = generated.get(normalize(value));

    if (outputs !== undefined) {
      owner[key] = toIconMap(outputs, fallbackSizes);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [sizeKey, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' || !isSvgPath(entry)) {
      continue;
    }

    const outputs = generated.get(normalize(entry));
    const size = Number.parseInt(sizeKey, 10);
    const replacement =
      outputs?.get(Number.isInteger(size) && size > 0 ? size : (fallbackSizes[0] ?? 0)) ??
      outputs?.values().next().value;

    if (typeof replacement === 'string') {
      value[sizeKey] = replacement;
    }
  }
}

function rewriteThemeIcons(
  manifest: Record<string, unknown>,
  generated: Map<string, Map<number, string>>,
  fallbackSizes: readonly number[],
): void {
  const value = manifest.theme_icons;

  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const size = typeof entry.size === 'number' ? entry.size : (fallbackSizes[0] ?? 0);

    if (typeof entry.light === 'string' && isSvgPath(entry.light)) {
      const replacement = generated.get(normalize(entry.light))?.get(size);

      if (replacement !== undefined) {
        entry.light = replacement;
      }
    }

    if (typeof entry.dark === 'string' && isSvgPath(entry.dark)) {
      const replacement = generated.get(normalize(entry.dark))?.get(size);

      if (replacement !== undefined) {
        entry.dark = replacement;
      }
    }
  }
}

function toIconMap(
  outputs: Map<number, string>,
  fallbackSizes: readonly number[],
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const size of fallbackSizes) {
    const value = outputs.get(size);

    if (value !== undefined) {
      result[String(size)] = value;
    }
  }

  if (Object.keys(result).length === 0) {
    for (const [size, value] of outputs) {
      result[String(size)] = value;
    }
  }

  return result;
}

function isSvgPath(value: string): boolean {
  return /\.svg$/i.test(value.trim());
}

function normalize(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/^\.?\//, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
