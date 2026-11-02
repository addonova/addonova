import { statSync } from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';

import {
  getBrowserTargetInfo,
  supportsManifestVersion,
} from '../browser/targets.ts';
import { AddonovaError } from './errors.ts';
import {
  BROWSER_TARGETS,
  DEFAULT_BROWSER,
  DEFAULT_MANIFEST_VERSION,
  isArchiveFormat,
  isBrowserTarget,
  isBuildMode,
  isManifestVersion,
  isSourcemapOption,
} from './types.ts';
import type {
  ArchiveFormat,
  BuildMode,
  BrowserTarget,
  EntrypointKind,
  ManifestVersion,
  SourcemapOption,
} from './types.ts';

export const CONFIG_FILENAMES = [
  'addonova.config.ts',
  'addonova.config.js',
  'addonova.config.mjs',
  'addonova.config.json',
] as const;

export type EntrypointsInput =
  | string
  | readonly string[]
  | Readonly<Record<string, string>>;

export type BrowserOverridesInput = Partial<
  Record<BrowserTarget, Readonly<Record<string, unknown>>>
>;

export interface AddonovaPackConfig {
  outFile?: string;
  format?: ArchiveFormat;
  level?: number;
  overwrite?: boolean;
  deterministic?: boolean;
}

export interface AddonovaUserConfig {
  entrypoints?: EntrypointsInput;
  browsers?: readonly BrowserTarget[] | BrowserOverridesInput;
  manifest?: Readonly<Record<string, unknown>>;
  outdir?: string;
  publicDir?: string;
  minify?: boolean;
  sourcemap?: SourcemapOption;
  mode?: BuildMode;
  plugins?: readonly unknown[];
  pack?: AddonovaPackConfig;
}

export interface ResolvedEntrypoint {
  name: string;
  input: string;
  kind: EntrypointKind;
}

export interface ResolvedBrowser {
  target: BrowserTarget;
  manifestVersion: ManifestVersion;
  manifestOverrides: Readonly<Record<string, unknown>>;
}

export interface ResolvedPackConfig {
  outFile: string | null;
  format: ArchiveFormat;
  level?: number;
  overwrite: boolean;
  deterministic: boolean;
}

export interface ResolvedConfig {
  root: string;
  configPath: string | null;
  entrypoints: readonly ResolvedEntrypoint[];
  browsers: readonly ResolvedBrowser[];
  manifest: Readonly<Record<string, unknown>>;
  outdir: string;
  publicDir: string;
  mode: BuildMode;
  minify: boolean;
  sourcemap: SourcemapOption;
  pack: ResolvedPackConfig;
}

export interface ConfigOverrides {
  browsers?: readonly BrowserTarget[];
  manifestVersion?: ManifestVersion;
  mode?: BuildMode;
  outdir?: string;
  minify?: boolean;
  sourcemap?: SourcemapOption;
}

export interface NormalizeConfigOptions {
  cwd: string;
  configPath?: string | null;
  overrides?: ConfigOverrides;
  defaultMode?: BuildMode;
}

export interface ResolveProjectConfigOptions {
  cwd: string;
  explicitConfigPath?: string;
  overrides?: ConfigOverrides;
  defaultMode?: BuildMode;
}

const SCRIPT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

export function defineConfig<T extends AddonovaUserConfig>(config: T): T {
  return config;
}

export function findConfigFile(startDir: string, explicitPath?: string): string | null {
  const cwd = path.resolve(startDir);

  if (explicitPath !== undefined) {
    const resolved = path.resolve(cwd, explicitPath);

    if (!isFile(resolved)) {
      throw configError(
        'ADDONOVA_CONFIG_NOT_FOUND',
        `Configuration file not found: ${resolved}`,
        'Pass an existing addonova.config.ts, .js, .mjs, or .json file.',
        resolved,
      );
    }

    return resolved;
  }

  let directory = cwd;

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = path.join(directory, filename);

      if (isFile(candidate)) {
        return candidate;
      }
    }

    const parent = path.dirname(directory);

    if (parent === directory) {
      return null;
    }

    directory = parent;
  }
}

export async function loadConfig(configPath: string): Promise<AddonovaUserConfig> {
  const jiti = createJiti(import.meta.url, {
    fsCache: false,
    moduleCache: false,
    interopDefault: true,
  });

  let loaded: unknown;

  try {
    loaded = await jiti.import<unknown>(configPath, { default: true });
  } catch (error) {
    throw new AddonovaError({
      code: 'ADDONOVA_CONFIG_LOAD_FAILED',
      severity: 'error',
      message: `Failed to load configuration: ${configPath}`,
      location: { file: configPath },
      suggestion: 'Check the configuration file for syntax or runtime errors.',
      cause: error,
    });
  }

  if (!isPlainObject(loaded)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'The configuration file must export an object.',
      'Export a default object or use defineConfig({ ... }).',
      configPath,
    );
  }

  return loaded as AddonovaUserConfig;
}

export async function resolveProjectConfig(
  options: ResolveProjectConfigOptions,
): Promise<ResolvedConfig> {
  const configPath = findConfigFile(options.cwd, options.explicitConfigPath);
  const userConfig = configPath === null ? {} : await loadConfig(configPath);

  return normalizeConfig(userConfig, {
    cwd: options.cwd,
    configPath,
    ...(options.overrides === undefined ? {} : { overrides: options.overrides }),
    ...(options.defaultMode === undefined ? {} : { defaultMode: options.defaultMode }),
  });
}

export function normalizeConfig(
  userConfig: AddonovaUserConfig,
  options: NormalizeConfigOptions,
): ResolvedConfig {
  if (!isPlainObject(userConfig as unknown)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'The configuration value must be an object.',
      'Export a default object or use defineConfig({ ... }).',
      options.configPath ?? null,
    );
  }

  const configPath = options.configPath ?? null;
  const root = configPath === null ? path.resolve(options.cwd) : path.dirname(configPath);
  const overrides = options.overrides ?? {};
  const manifest = normalizeManifest(userConfig.manifest, configPath);
  const mode = overrides.mode ?? userConfig.mode ?? options.defaultMode ?? 'production';

  validateConfigValues(userConfig, configPath);

  return {
    root,
    configPath,
    entrypoints: normalizeEntrypoints(userConfig.entrypoints, root, configPath),
    browsers: normalizeBrowsers(userConfig.browsers, manifest, overrides, configPath),
    manifest,
    outdir:
      overrides.outdir === undefined
        ? path.resolve(root, userConfig.outdir ?? 'dist')
        : path.resolve(options.cwd, overrides.outdir),
    publicDir: path.resolve(root, userConfig.publicDir ?? 'public'),
    mode,
    minify: overrides.minify ?? userConfig.minify ?? mode === 'production',
    sourcemap:
      overrides.sourcemap ??
      userConfig.sourcemap ??
      (mode === 'development' ? true : false),
    pack: normalizePack(userConfig.pack, root, configPath),
  };
}

function validateConfigValues(config: AddonovaUserConfig, configPath: string | null): void {
  if (config.outdir !== undefined && !isNonEmptyString(config.outdir)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "outdir" must be a non-empty string.',
      'Use a directory path such as "dist".',
      configPath,
    );
  }

  if (config.publicDir !== undefined && !isNonEmptyString(config.publicDir)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "publicDir" must be a non-empty string.',
      'Use a directory path such as "public".',
      configPath,
    );
  }

  if (config.minify !== undefined && typeof config.minify !== 'boolean') {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "minify" must be true or false.',
      'Use a boolean value.',
      configPath,
    );
  }

  if (config.sourcemap !== undefined && !isSourcemapOption(config.sourcemap)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "sourcemap" must be a boolean or a supported source map mode.',
      'Use true, false, "inline", "external", "linked", "both", or "none".',
      configPath,
    );
  }

  if (config.mode !== undefined && !isBuildMode(config.mode)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "mode" must be "development" or "production".',
      'Use one of the supported build modes.',
      configPath,
    );
  }

  if (config.plugins !== undefined && !Array.isArray(config.plugins)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "plugins" must be an array.',
      'Pass an array of plugin objects.',
      configPath,
    );
  }

  if (config.pack !== undefined && !isPlainObject(config.pack)) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack" must be an object.',
      'Use { format: "zip", overwrite: false }.',
      configPath,
    );
  }
}

function normalizePack(
  rawPack: AddonovaPackConfig | undefined,
  root: string,
  configPath: string | null,
): ResolvedPackConfig {
  const pack = rawPack ?? {};

  if (pack.outFile !== undefined && !isNonEmptyString(pack.outFile)) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack.outFile" must be a non-empty string.',
      'Use an archive path such as "dist/extension.zip".',
      configPath,
    );
  }

  if (pack.format !== undefined && !isArchiveFormat(pack.format)) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack.format" must be "zip", "tar", or "tar.gz".',
      'Use one of the supported archive formats.',
      configPath,
    );
  }

  if (
    pack.level !== undefined &&
    (!Number.isInteger(pack.level) || pack.level < 0 || pack.level > 9)
  ) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack.level" must be an integer from 0 to 9.',
      'Use 0 for no compression or 9 for maximum compression.',
      configPath,
    );
  }

  if (pack.format === 'tar' && pack.level !== undefined) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack.level" cannot be used with the "tar" format.',
      'Remove pack.level or use "zip" or "tar.gz".',
      configPath,
    );
  }

  if (pack.overwrite !== undefined && typeof pack.overwrite !== 'boolean') {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack.overwrite" must be true or false.',
      'Use a boolean value.',
      configPath,
    );
  }

  if (
    pack.deterministic !== undefined &&
    typeof pack.deterministic !== 'boolean'
  ) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack.deterministic" must be true or false.',
      'Use a boolean value.',
      configPath,
    );
  }

  return {
    outFile:
      pack.outFile === undefined ? null : path.resolve(root, pack.outFile),
    format: pack.format ?? 'zip',
    ...(pack.level === undefined ? {} : { level: pack.level }),
    overwrite: pack.overwrite ?? false,
    deterministic: pack.deterministic ?? false,
  };
}

function normalizeManifest(
  rawManifest: Readonly<Record<string, unknown>> | undefined,
  configPath: string | null,
): Readonly<Record<string, unknown>> {
  if (rawManifest === undefined) {
    return {};
  }

  if (!isPlainObject(rawManifest)) {
    throw configError(
      'ADDONOVA_CONFIG_MANIFEST',
      'Config "manifest" must be an object.',
      'Provide a manifest object with fields such as name and version.',
      configPath,
    );
  }

  if (
    rawManifest.manifest_version !== undefined &&
    !isManifestVersion(rawManifest.manifest_version)
  ) {
    throw configError(
      'ADDONOVA_CONFIG_MANIFEST',
      'Manifest "manifest_version" must be 2 or 3.',
      'Use a manifest version supported by the browser target.',
      configPath,
    );
  }

  for (const field of ['name', 'version', 'description'] as const) {
    const value = rawManifest[field];

    if (value !== undefined && !isNonEmptyString(value)) {
      throw configError(
        'ADDONOVA_CONFIG_MANIFEST',
        `Manifest "${field}" must be a non-empty string.`,
        `Provide a valid ${field} value.`,
        configPath,
      );
    }
  }

  return rawManifest;
}

function normalizeBrowsers(
  rawBrowsers: AddonovaUserConfig['browsers'],
  manifest: Readonly<Record<string, unknown>>,
  overrides: ConfigOverrides,
  configPath: string | null,
): readonly ResolvedBrowser[] {
  const overrideMap: Partial<Record<BrowserTarget, Readonly<Record<string, unknown>>>> = {};
  let targetNames: BrowserTarget[] = [];

  if (rawBrowsers === undefined) {
    targetNames = [DEFAULT_BROWSER];
  } else if (Array.isArray(rawBrowsers)) {
    targetNames = normalizeBrowserList(rawBrowsers, configPath);
  } else if (isPlainObject(rawBrowsers)) {
    for (const [target, value] of Object.entries(rawBrowsers)) {
      if (!isBrowserTarget(target)) {
        throw configError(
          'ADDONOVA_CONFIG_BROWSER',
          `Unknown browser target "${target}".`,
          `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
          configPath,
        );
      }

      if (!isPlainObject(value)) {
        throw configError(
          'ADDONOVA_CONFIG_BROWSER',
          `Browser override "${target}" must be an object.`,
          'Use manifest fields such as { manifest_version: 3 }.',
          configPath,
        );
      }

      overrideMap[target] = value;
      targetNames.push(target);
    }

    if (targetNames.length === 0) {
      targetNames = [DEFAULT_BROWSER];
    }
  } else {
    throw configError(
      'ADDONOVA_CONFIG_BROWSER',
      'Config "browsers" must be an array of targets or an object of browser overrides.',
      'Use ["chrome", "firefox"] or { chrome: { manifest_version: 3 } }.',
      configPath,
    );
  }

  if (overrides.browsers !== undefined && overrides.browsers.length > 0) {
    targetNames = normalizeBrowserList(overrides.browsers, null);
  }

  const baseManifestVersion = manifest.manifest_version;
  const defaultManifestVersion = isManifestVersion(baseManifestVersion)
    ? baseManifestVersion
    : undefined;

  return targetNames.map((target) => {
    const rawOverride = overrideMap[target] ?? {};
    const {
      manifest_version: rawManifestVersion,
      manifest: nestedManifestValue,
      ...directOverrides
    } = rawOverride;

    if (rawManifestVersion !== undefined && !isManifestVersion(rawManifestVersion)) {
      throw configError(
        'ADDONOVA_CONFIG_MANIFEST',
        `Browser "${target}" manifest_version must be 2 or 3.`,
        'Use a manifest version supported by the browser target.',
        configPath,
      );
    }

    if (nestedManifestValue !== undefined && !isPlainObject(nestedManifestValue)) {
      throw configError(
        'ADDONOVA_CONFIG_MANIFEST',
        `Browser "${target}" manifest override must be an object.`,
        'Use manifest fields nested under "manifest".',
        configPath,
      );
    }

    const nestedManifest = isPlainObject(nestedManifestValue) ? nestedManifestValue : {};
    const nestedManifestVersion = nestedManifest.manifest_version;

    if (
      nestedManifestVersion !== undefined &&
      !isManifestVersion(nestedManifestVersion)
    ) {
      throw configError(
        'ADDONOVA_CONFIG_MANIFEST',
        `Browser "${target}" nested manifest_version must be 2 or 3.`,
        'Use a manifest version supported by the browser target.',
        configPath,
      );
    }

    const declaredManifestVersion = rawManifestVersion ?? nestedManifestVersion;
    const manifestVersion =
      overrides.manifestVersion ??
      (isManifestVersion(declaredManifestVersion)
        ? declaredManifestVersion
        : defaultManifestVersion ?? DEFAULT_MANIFEST_VERSION[target]);

    if (!supportsManifestVersion(target, manifestVersion)) {
      const targetInfo = getBrowserTargetInfo(target);

      throw configError(
        'ADDONOVA_CONFIG_MANIFEST',
        `Manifest V${manifestVersion} is not supported for ${targetInfo.displayName}.`,
        `Use one of: ${targetInfo.supportedManifestVersions
          .map((version) => `V${version}`)
          .join(', ')}.`,
        configPath,
      );
    }

    return {
      target,
      manifestVersion,
      manifestOverrides: {
        ...directOverrides,
        ...nestedManifest,
      },
    };
  });
}

function normalizeBrowserList(
  browsers: readonly unknown[],
  configPath: string | null,
): BrowserTarget[] {
  if (browsers.length === 0) {
    throw configError(
      'ADDONOVA_CONFIG_BROWSER',
      'At least one browser target is required.',
      `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
      configPath,
    );
  }

  const targets: BrowserTarget[] = [];

  for (const browser of browsers) {
    if (!isBrowserTarget(browser)) {
      throw configError(
        'ADDONOVA_CONFIG_BROWSER',
        `Unknown browser target "${String(browser)}".`,
        `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
        configPath,
      );
    }

    if (!targets.includes(browser)) {
      targets.push(browser);
    }
  }

  return targets;
}

function normalizeEntrypoints(
  rawEntrypoints: EntrypointsInput | undefined,
  root: string,
  configPath: string | null,
): readonly ResolvedEntrypoint[] {
  const entrypoints: ResolvedEntrypoint[] = [];

  const addEntrypoint = (name: string, input: string): void => {
    if (!isNonEmptyString(name) || name.includes('/') || name.includes('\\')) {
      throw configError(
        'ADDONOVA_CONFIG_ENTRYPOINTS',
        `Invalid entrypoint name "${name}".`,
        'Use a simple name without path separators.',
        configPath,
      );
    }

    if (!isNonEmptyString(input)) {
      throw configError(
        'ADDONOVA_CONFIG_ENTRYPOINTS',
        `Entrypoint "${name}" must point to a non-empty file path.`,
        'Provide a path to a script, HTML file, stylesheet, or asset.',
        configPath,
      );
    }

    if (entrypoints.some((entrypoint) => entrypoint.name === name)) {
      throw configError(
        'ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT',
        `Duplicate entrypoint name "${name}".`,
        'Give every entrypoint a unique name.',
        configPath,
      );
    }

    const absoluteInput = path.resolve(root, input);

    if (!isFile(absoluteInput)) {
      throw configError(
        'ADDONOVA_CONFIG_ENTRYPOINT_MISSING',
        `Entrypoint "${name}" was not found: ${absoluteInput}`,
        'Check the path and ensure the file exists.',
        configPath,
      );
    }

    entrypoints.push({
      name,
      input: absoluteInput,
      kind: detectEntrypointKind(input),
    });
  };

  if (rawEntrypoints === undefined) {
    return entrypoints;
  }

  if (typeof rawEntrypoints === 'string') {
    addEntrypoint(deriveEntrypointName(rawEntrypoints), rawEntrypoints);
    return entrypoints;
  }

  if (Array.isArray(rawEntrypoints)) {
    for (const input of rawEntrypoints) {
      if (typeof input !== 'string') {
        throw configError(
          'ADDONOVA_CONFIG_ENTRYPOINTS',
          'Every entrypoint in an array must be a string.',
          'Use file paths or an object of name-to-path values.',
          configPath,
        );
      }

      addEntrypoint(deriveEntrypointName(input), input);
    }

    return entrypoints;
  }

  if (isPlainObject(rawEntrypoints)) {
    for (const [name, input] of Object.entries(rawEntrypoints)) {
      if (typeof input !== 'string') {
        throw configError(
          'ADDONOVA_CONFIG_ENTRYPOINTS',
          `Entrypoint "${name}" must be a string path.`,
          'Use an object of name-to-path values.',
          configPath,
        );
      }

      addEntrypoint(name, input);
    }

    return entrypoints;
  }

  throw configError(
    'ADDONOVA_CONFIG_ENTRYPOINTS',
    'Config "entrypoints" must be a string, an array, or an object.',
    'Use { background: "src/background.ts" } or ["src/background.ts"].',
    configPath,
  );
}

function deriveEntrypointName(input: string): string {
  const normalized = input.replaceAll('\\', '/');
  const parsed = path.posix.parse(normalized);

  if (parsed.name === 'index' && parsed.dir !== '') {
    return path.posix.basename(parsed.dir);
  }

  return parsed.name;
}

function detectEntrypointKind(input: string): EntrypointKind {
  const extension = path.extname(input).toLowerCase();

  if (extension === '.html' || extension === '.htm') {
    return 'html';
  }

  if (extension === '.css') {
    return 'style';
  }

  if (SCRIPT_EXTENSIONS.has(extension)) {
    return 'script';
  }

  return 'asset';
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function configError(
  code: string,
  message: string,
  suggestion: string,
  configPath: string | null,
): AddonovaError {
  return new AddonovaError({
    code,
    severity: 'error',
    message,
    suggestion,
    ...(configPath === null ? {} : { location: { file: configPath } }),
  });
}
