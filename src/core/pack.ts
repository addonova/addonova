import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { pack as guchhoPack } from 'guchho';
import type { PackOptions, PackResult as GuchhoPackResult } from 'guchho';

import { resolveManifestObject } from '../browser/manifest.ts';
import type { ResolvedBrowser, ResolvedConfig } from './config.ts';
import { getOutputDirectory } from './build.ts';
import { AddonovaError } from './errors.ts';
import {
  filterPaths,
  matchesDirectory,
} from './glob.ts';
import type { ArchiveFormat } from './types.ts';

const DETERMINISTIC_DATE = new Date('1980-01-01T00:00:00.000Z');

const DEFAULT_SOURCE_EXCLUDES = [
  'node_modules/**',
  '**/node_modules/**',
  '.git/**',
  '**/.git/**',
  '.hg/**',
  '**/.hg/**',
  '.svn/**',
  '**/.svn/**',
  '.addonova/**',
  '**/.addonova/**',
  'coverage/**',
  '**/coverage/**',
  '.*',
  '**/.*',
  '**/*.test.*',
  '**/*.spec.*',
  '**/*.zip',
  '**/*.tar',
  '**/*.tar.gz',
  '**/*.crx',
  '**/*.xpi',
] as const;

export type PackRunner = (options: PackOptions) => Promise<GuchhoPackResult>;

export interface PackProjectOptions {
  pack?: PackRunner;
  format?: ArchiveFormat;
  include?: readonly string[];
  exclude?: readonly string[];
  sources?: boolean;
}

export interface PackSourcesResult {
  root: string;
  archivePath: string;
  size: number;
  files: number;
  warnings: readonly string[];
}

export interface PackTargetResult {
  browser: ResolvedBrowser;
  outdir: string;
  archivePath: string;
  size: number;
  warnings: readonly string[];
  sources?: PackSourcesResult;
}

interface PackTarget {
  browser: ResolvedBrowser;
  outdir: string;
  archivePath: string;
  inputs: readonly string[];
  warnings: readonly string[];
  stagingDir: string | null;
}

interface WalkResult {
  files: readonly string[];
  warnings: readonly string[];
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

  const format = options.format ?? config.pack.format;
  const include = resolvePackPatterns(
    options.include ?? config.pack.include,
  );
  const exclude = [
    ...config.pack.exclude,
    ...(options.exclude ?? []),
  ];
  const pack = options.pack ?? guchhoPack;
  const results: PackTargetResult[] = [];
  const packSourcesEnabled = shouldPackSources(config, options.sources);

  if (
    packSourcesEnabled &&
    !config.browsers.some((browser) => browser.target === 'firefox')
  ) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_SOURCES_UNSUPPORTED',
      severity: 'error',
      message:
        'Source archives are only supported for Firefox targets, but no Firefox target is configured.',
      suggestion:
        'Add a Firefox target or disable pack.sources / remove --sources.',
      ...(config.configPath === null
        ? {}
        : { location: { file: config.configPath } }),
    });
  }

  for (const browser of config.browsers) {
    const target = createPackTarget(
      config,
      browser,
      format,
      include,
      exclude,
    );

    try {
      const result = await runPack(pack, config, {
        outFile: target.archivePath,
        inputs: target.inputs,
        format,
        code: 'ADDONOVA_PACK_FAILED',
        message: `Failed to pack ${target.browser.target} MV${target.browser.manifestVersion}`,
        suggestion:
          'Run a production build first and check the pack configuration.',
      });
      const packed: PackTargetResult = {
        browser: target.browser,
        outdir: target.outdir,
        archivePath: result.path,
        size: result.size,
        warnings: [...target.warnings, ...result.warnings],
      };

      if (packSourcesEnabled && browser.target === 'firefox') {
        packed.sources = await packSources(
          config,
          browser,
          pack,
          target.outdir,
        );
      }

      results.push(packed);
    } finally {
      removeStaging(target.stagingDir);
    }
  }

  return results;
}

export function getArchivePath(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
  format: ArchiveFormat = config.pack.format,
): string {
  if (config.pack.outFile !== null) {
    return config.pack.outFile;
  }

  const version = getManifestVersion(config, browser);
  const name = sanitizeArchiveName(
    `addonova-${browser.target}-mv${browser.manifestVersion}-${version}`,
  );

  return path.join(config.outdir, `${name}.${archiveExtension(format)}`);
}

export function getSourcesArchivePath(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
): string {
  const archivePath = getArchivePath(config, browser, 'zip');
  const parsed = path.parse(archivePath);

  return path.join(parsed.dir, `${parsed.name}-sources.zip`);
}

function createPackTarget(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
  format: ArchiveFormat,
  include: readonly string[],
  exclude: readonly string[],
): PackTarget {
  const outdir = getOutputDirectory(config.outdir, browser, config.browsers);
  const archivePath = getArchivePath(config, browser, format);
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

  if (isDefaultFilter(include, exclude)) {
    const inputs = readdirSync(outdir).map((entry) => path.join(outdir, entry));

    if (inputs.length === 0) {
      throw emptyArchiveError(outdir);
    }

    return {
      browser,
      outdir,
      archivePath,
      inputs,
      warnings: [],
      stagingDir: null,
    };
  }

  const walked = walkFiles(outdir);
  const files = filterPaths(walked.files, include, exclude);

  if (!files.includes('manifest.json')) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_MANIFEST_EXCLUDED',
      severity: 'error',
      message: `Cannot pack ${browser.target} MV${browser.manifestVersion} because the include and exclude rules remove manifest.json.`,
      location: { file: manifestPath },
      suggestion:
        'Keep manifest.json in the archive by adjusting pack.include or pack.exclude.',
    });
  }

  if (files.length === 0) {
    throw emptyArchiveError(outdir);
  }

  const stagingDir = stageFiles(outdir, files, 'addonova-pack-');
  const inputs = readdirSync(stagingDir).map((entry) =>
    path.join(stagingDir, entry),
  );

  return {
    browser,
    outdir,
    archivePath,
    inputs,
    warnings: walked.warnings,
    stagingDir,
  };
}

async function packSources(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
  pack: PackRunner,
  outdir: string,
): Promise<PackSourcesResult> {
  const sources = config.pack.sources ?? {
    include: ['**/*'],
    exclude: [],
    root: config.root,
  };
  const root = sources.root;

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_SOURCES_MISSING',
      severity: 'error',
      message: `Cannot pack sources because the source root is missing: ${root}`,
      location: { file: root },
      suggestion:
        'Set pack.sources.root to an existing project directory, or disable pack.sources.',
    });
  }

  const archivePath = getSourcesArchivePath(config, browser);

  if (!config.pack.overwrite && existsSync(archivePath)) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_OUTPUT_EXISTS',
      severity: 'error',
      message: `Source archive already exists: ${archivePath}`,
      location: { file: archivePath },
      suggestion:
        'Remove the existing archive, or set pack.overwrite to true in the configuration.',
    });
  }

  const outdirRelative = toRelativePosix(root, outdir);
  const excludes = [
    ...DEFAULT_SOURCE_EXCLUDES,
    ...(outdirRelative === null ? [] : [`${outdirRelative}/**`]),
    ...sources.exclude,
  ];
  const walked = walkFiles(root, (relativeDirectory) => {
    if (
      outdirRelative !== null &&
      (relativeDirectory === outdirRelative ||
        relativeDirectory.startsWith(`${outdirRelative}/`))
    ) {
      return true;
    }

    return matchesDirectory(relativeDirectory, excludes);
  });
  const files = filterPaths(walked.files, sources.include, excludes);

  if (files.length === 0) {
    throw new AddonovaError({
      code: 'ADDONOVA_PACK_SOURCES_EMPTY',
      severity: 'error',
      message: `Cannot pack sources for ${browser.target} MV${browser.manifestVersion} because no source files match the configured rules.`,
      location: { file: root },
      suggestion:
        'Adjust pack.sources.include and pack.sources.exclude, or disable pack.sources.',
    });
  }

  const stagingDir = stageFiles(root, files, 'addonova-sources-');

  try {
    const result = await runPack(pack, config, {
      outFile: archivePath,
      inputs: [...readdirSync(stagingDir).map((entry) =>
        path.join(stagingDir, entry),
      )],
      format: 'zip',
      code: 'ADDONOVA_PACK_SOURCES_FAILED',
      message: `Failed to pack sources for ${browser.target} MV${browser.manifestVersion}`,
      suggestion:
        'Check the source include and exclude rules, then try packing again.',
    });

    return {
      root,
      archivePath: result.path,
      size: result.size,
      files: files.length,
      warnings: [...walked.warnings, ...result.warnings],
    };
  } finally {
    removeStaging(stagingDir);
  }
}

async function runPack(
  pack: PackRunner,
  config: ResolvedConfig,
  target: {
    outFile: string;
    inputs: readonly string[];
    format: ArchiveFormat;
    code: string;
    message: string;
    suggestion: string;
  },
): Promise<GuchhoPackResult> {
  try {
    return await pack({
      outFile: target.outFile,
      inputs: [...target.inputs],
      format: target.format,
      overwrite: config.pack.overwrite,
      ...(target.format !== 'tar' && config.pack.level !== undefined
        ? { level: config.pack.level }
        : {}),
      ...(config.pack.deterministic ? { date: DETERMINISTIC_DATE } : {}),
    });
  } catch (error) {
    throw new AddonovaError({
      code: target.code,
      severity: 'error',
      message: `${target.message}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      location: { file: target.outFile },
      suggestion: target.suggestion,
      cause: error,
    });
  }
}

function walkFiles(
  root: string,
  shouldSkipDirectory: (relativePath: string) => boolean = () => false,
): WalkResult {
  const files: string[] = [];
  const warnings: string[] = [];

  walk('');

  files.sort();

  return { files, warnings };

  function walk(relativeDirectory: string): void {
    const directory = path.join(root, relativeDirectory);
    let entries;

    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      warnings.push(
        `Skipped unreadable directory "${relativeDirectory}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    for (const entry of entries) {
      const relativePath =
        relativeDirectory === ''
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;

      if (entry.isSymbolicLink()) {
        warnings.push(`Skipped symlink "${relativePath}".`);
        continue;
      }

      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(relativePath)) {
          walk(relativePath);
        }

        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
}

function stageFiles(
  root: string,
  files: readonly string[],
  prefix: string,
): string {
  const stagingDir = mkdtempSync(path.join(tmpdir(), prefix));

  for (const relativePath of files) {
    const target = path.join(stagingDir, relativePath);

    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(root, relativePath), target);
  }

  return stagingDir;
}

function removeStaging(stagingDir: string | null): void {
  if (stagingDir !== null) {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

function isDefaultFilter(
  include: readonly string[],
  exclude: readonly string[],
): boolean {
  return include.length === 1 && include[0] === '**/*' && exclude.length === 0;
}

function resolvePackPatterns(
  patterns: readonly string[],
): readonly string[] {
  return patterns.length === 0 ? ['**/*'] : patterns;
}

function shouldPackSources(
  config: ResolvedConfig,
  override: boolean | undefined,
): boolean {
  if (override !== undefined) {
    return override;
  }

  return config.pack.sources !== null;
}

function emptyArchiveError(outdir: string): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_PACK_EMPTY',
    severity: 'error',
    message: `Cannot pack because the build output is empty: ${outdir}`,
    location: { file: outdir },
    suggestion:
      'Run a production build first and check the include and exclude rules.',
  });
}

function toRelativePosix(root: string, target: string): string | null {
  const relative = path.relative(root, target);

  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }

  return relative.split(path.sep).join('/');
}

function getManifestVersion(
  config: ResolvedConfig,
  browser: ResolvedBrowser,
): string {
  const manifest = resolveManifestObject(config.manifest, browser, {
    mode: config.mode,
    command: 'pack',
    defaults: config.manifestDefaults,
  });
  const version = manifest.version;

  return typeof version === 'string' && version.trim() !== ''
    ? version
    : '0.0.0';
}

function sanitizeArchiveName(value: string): string {
  const sanitized = value.replaceAll(/[^A-Za-z0-9._-]+/g, '-');

  return sanitized.replaceAll(/^[.-]+|[.-]+$/g, '') || 'addonova-extension';
}

function archiveExtension(format: ArchiveFormat): string {
  return format === 'zip' ? 'zip' : format === 'tar' ? 'tar' : 'tar.gz';
}
