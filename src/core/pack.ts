import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { pack as guchhoPack } from 'guchho';
import type { PackOptions, PackResult as GuchhoPackResult } from 'guchho';

import type { ResolvedBrowser, ResolvedConfig } from './config.js';
import { getOutputDirectory } from './build.js';
import { AddonovaError } from './errors.js';
import type { ArchiveFormat } from './types.js';

const DETERMINISTIC_DATE = new Date('1980-01-01T00:00:00.000Z');

export type PackRunner = (options: PackOptions) => Promise<GuchhoPackResult>;

export interface PackProjectOptions {
  pack?: PackRunner;
}

export interface PackTargetResult {
  browser: ResolvedBrowser;
  outdir: string;
  archivePath: string;
  size: number;
  warnings: readonly string[];
}

interface PackTarget {
  browser: ResolvedBrowser;
  outdir: string;
  archivePath: string;
  inputs: readonly string[];
}

export async function packProject(
  config: ResolvedConfig,
  options: PackProjectOptions = {},
): Promise<readonly PackTargetResult[]> {
  if (config.pack.outFile !== null && config.browsers.length > 1) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_OUTFILE_AMBIGUOUS',
      severity: 'error',
      message:
        'Config "pack.outFile" cannot be used when more than one browser target is configured.',
      suggestion:
        'Remove pack.outFile so Addonova derives one archive name per target.',
      ...(config.configPath === null
        ? {}
        : { location: { file: config.configPath } }),
    });
  }

  const targets = config.browsers.map((browser) =>
    createPackTarget(config, browser),
  );
  const pack = options.pack ?? guchhoPack;
  const results: PackTargetResult[] = [];

  for (const target of targets) {
    let result: GuchhoPackResult;

    try {
      result = await pack({
        outFile: target.archivePath,
        inputs: [...target.inputs],
        format: config.pack.format,
        overwrite: config.pack.overwrite,
        ...(config.pack.level === undefined
          ? {}
          : { level: config.pack.level }),
        ...(config.pack.deterministic ? { date: DETERMINISTIC_DATE } : {}),
      });
    } catch (error) {
      throw new AddonovaError({
        code: 'ADDONOVA_PACK_FAILED',
        severity: 'error',
        message: `Failed to pack ${target.browser.target} MV${target.browser.manifestVersion}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        location: { file: target.outdir },
        suggestion:
          'Run a production build first and check the pack configuration.',
        cause: error,
      });
    }

    results.push({
      browser: target.browser,
      outdir: target.outdir,
      archivePath: result.path,
      size: result.size,
      warnings: result.warnings,
    });
  }

  return results;
}

export function getArchivePath(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
): string {
  if (config.pack.outFile !== null) {
    return config.pack.outFile;
  }

  const version = getManifestVersion(config, browser);
  const name = sanitizeArchiveName(
    `addonova-${browser.target}-mv${browser.manifestVersion}-${version}`,
  );

  return path.join(config.outdir, `${name}.${archiveExtension(config.pack.format)}`);
}

function createPackTarget(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
): PackTarget {
  const outdir = getOutputDirectory(config.outdir, browser, config.browsers);
  const archivePath = getArchivePath(config, browser);
  const manifestPath = path.join(outdir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_OUTPUT_MISSING',
      severity: 'error',
      message: `Cannot pack ${browser.target} MV${browser.manifestVersion} because its build output is missing.`,
      location: { file: manifestPath },
      suggestion: `Run "addonova build --browser ${browser.target}" before packing.`,
    });
  }

  if (!config.pack.overwrite && existsSync(archivePath)) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_OUTPUT_EXISTS',
      severity: 'error',
      message: `Archive already exists: ${archivePath}`,
      location: { file: archivePath },
      suggestion:
        'Remove the existing archive, or set pack.overwrite to true in the configuration.',
    });
  }

  const inputs = readdirSync(outdir).map((entry) => path.join(outdir, entry));

  return { browser, outdir, archivePath, inputs };
}

function getManifestVersion(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
): string {
  const browserVersion = browser.manifestOverrides.version;
  const baseVersion = config.manifest.version;

  if (typeof browserVersion === 'string' && browserVersion.trim() !== '') {
    return browserVersion;
  }

  if (typeof baseVersion === 'string' && baseVersion.trim() !== '') {
    return baseVersion;
  }

  return '0.0.0';
}

function sanitizeArchiveName(value: string): string {
  const sanitized = value.replaceAll(/[^A-Za-z0-9._-]+/g, '-');

  return sanitized.replaceAll(/^[.-]+|[.-]+$/g, '') || 'addonova-extension';
}

function archiveExtension(format: ArchiveFormat): string {
  return format === 'zip' ? 'zip' : format === 'tar' ? 'tar' : 'tar.gz';
}
