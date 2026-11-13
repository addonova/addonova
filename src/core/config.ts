import { statSync } from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';

import {
  getBrowserTargetInfo,
  supportsManifestVersion,
} from '../browser/targets.ts';
import { validatePlugins } from '../plugins/manager.ts';
import type { AddonovaPlugin } from '../plugins/types.ts';
import { AddonovaError } from './errors.ts';
import {
  deriveEntrypointName,
  describeEntrypoint,
  detectEntrypointKind,
  discoverEntrypoints,
  isEntrypointType,
} from './entrypoints.ts';
import type {
  EntrypointManifestOptions,
  EntrypointType,
} from './entrypoints.ts';
import { readPackageInfo, toManifestDefaults } from './package.ts';
import type { ManifestDefaults } from './package.ts';
import {
  BROWSER_TARGETS,
  DEFAULT_BROWSER,
  DEFAULT_MANIFEST_VERSION,
  isArchiveFormat,
  isBrowserApiMode,
  isBrowserTarget,
  isBuildMode,
  isManifestVersion,
  isSourcemapOption,
} from './types.ts';
import type {
  ArchiveFormat,
  BrowserApiMode,
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

export interface EntrypointConfigInput {
  input: string;
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  type?: EntrypointType;
}

export type EntrypointsInput =
  | string
  | readonly string[]
  | Readonly<Record<string, string | EntrypointConfigInput>>;

export type BrowserOverridesInput = Partial<
  Record<BrowserTarget, Readonly<Record<string, unknown>>>
>;

export interface ManifestContext {
  browser: BrowserTarget;
  manifestVersion: ManifestVersion;
  mode: BuildMode;
  command: string;
}

export type ManifestInput =
  | Readonly<Record<string, unknown>>
  | ((
      context: ManifestContext,
    ) => Readonly<Record<string, unknown>>);

export interface AddonovaPackConfig {
  outFile?: string;
  format?: ArchiveFormat;
  level?: number;
  overwrite?: boolean;
  deterministic?: boolean;
}

export interface AddonovaBrowserApiConfig {
  mode?: BrowserApiMode;
  package?: string;
  define?: boolean;
}

export interface ResolvedBrowserApiConfig {
  mode: BrowserApiMode;
  packageName: string;
  define: boolean;
}

export interface AddonovaUserConfig {
  entrypoints?: EntrypointsInput;
  browsers?: readonly BrowserTarget[] | BrowserOverridesInput;
  manifest?: ManifestInput;
  srcDir?: string;
  entrypointsDir?: string;
  convertManifest?: boolean;
  outdir?: string;
  publicDir?: string;
  minify?: boolean;
  sourcemap?: SourcemapOption;
  mode?: BuildMode;
  browserApi?: BrowserApiMode | AddonovaBrowserApiConfig;
  plugins?: readonly AddonovaPlugin[];
  pack?: AddonovaPackConfig;
}

export interface ResolvedEntrypoint {
  name: string;
  input: string;
  kind: EntrypointKind;
  type?: EntrypointType;
  manifestOptions?: EntrypointManifestOptions;
  discovered?: true;
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
  manifest: ManifestInput;
  manifestDefaults?: ManifestDefaults;
  srcDir?: string;
  entrypointsDir?: string;
  convertManifest?: boolean;
  outdir: string;
  publicDir: string;
  mode: BuildMode;
  minify: boolean;
  sourcemap: SourcemapOption;
  browserApi: ResolvedBrowserApiConfig;
  plugins: readonly AddonovaPlugin[];
  pack: ResolvedPackConfig;
}

export interface ConfigOverrides {
  browsers?: readonly BrowserTarget[];
  manifestVersion?: ManifestVersion;
  mode?: BuildMode;
  outdir?: string;
  minify?: boolean;
  sourcemap?: SourcemapOption;
  browserApi?: BrowserApiMode;
  convertManifest?: boolean;
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
  const srcDir = userConfig.srcDir ?? 'src';
  const entrypointsDir = userConfig.entrypointsDir ?? 'entrypoints';
  const manifestVersionHint = readManifestVersionHint(manifest, mode);
  const packageInfo = readPackageInfo(root);

  validateConfigValues(userConfig, configPath);

  return {
    root,
    configPath,
    entrypoints: normalizeEntrypoints(
      userConfig.entrypoints,
      root,
      srcDir,
      entrypointsDir,
      configPath,
    ),
    browsers: normalizeBrowsers(
      userConfig.browsers,
      manifestVersionHint,
      overrides,
      configPath,
    ),
    manifest,
    ...(packageInfo.name === undefined && packageInfo.version === undefined
      ? {}
      : { manifestDefaults: toManifestDefaults(packageInfo) }),
    srcDir,
    entrypointsDir,
    convertManifest:
      overrides.convertManifest ?? userConfig.convertManifest ?? true,
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
    browserApi: normalizeBrowserApi(
      userConfig.browserApi,
      overrides.browserApi,
      configPath,
    ),
    plugins: validatePlugins(
      userConfig.plugins,
      configPath === null ? undefined : { file: configPath },
    ),
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

  if (config.srcDir !== undefined && !isNonEmptyString(config.srcDir)) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "srcDir" must be a non-empty string.',
      'Use a directory path such as "src".',
      configPath,
    );
  }

  if (
    config.entrypointsDir !== undefined &&
    !isNonEmptyString(config.entrypointsDir)
  ) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "entrypointsDir" must be a non-empty string.',
      'Use a directory path such as "entrypoints".',
      configPath,
    );
  }

  if (
    config.convertManifest !== undefined &&
    typeof config.convertManifest !== 'boolean'
  ) {
    throw configError(
      'ADDONOVA_CONFIG_INVALID',
      'Config "convertManifest" must be true or false.',
      'Use a boolean value.',
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

  if (config.pack !== undefined && !isPlainObject(config.pack)) {
    throw configError(
      'ADDONOVA_CONFIG_PACK',
      'Config "pack" must be an object.',
      'Use { format: "zip", overwrite: false }.',
      configPath,
    );
  }
}

function normalizeBrowserApi(
  rawConfig: AddonovaUserConfig['browserApi'],
  modeOverride: BrowserApiMode | undefined,
  configPath: string | null,
): ResolvedBrowserApiConfig {
  let mode: BrowserApiMode = modeOverride ?? 'external';
  let packageName = '@addonova/browser';
  let define = true;

  if (typeof rawConfig === 'string') {
    if (!isBrowserApiMode(rawConfig)) {
      throw configError(
        'ADDONOVA_CONFIG_BROWSER_API',
        `Config "browserApi" must be "external" or "bundle".`,
        'Use browserApi: "external" or browserApi: "bundle".',
        configPath,
      );
    }

    if (modeOverride === undefined) {
      mode = rawConfig;
    }
  } else if (rawConfig !== undefined) {
    if (!isPlainObject(rawConfig)) {
      throw configError(
        'ADDONOVA_CONFIG_BROWSER_API',
        'Config "browserApi" must be a mode string or an object.',
        'Use "external", "bundle", or { mode, package, define }.',
        configPath,
      );
    }

    if (rawConfig.mode !== undefined) {
      if (!isBrowserApiMode(rawConfig.mode)) {
        throw configError(
          'ADDONOVA_CONFIG_BROWSER_API',
          'Config "browserApi.mode" must be "external" or "bundle".',
          'Use "external" or "bundle".',
          configPath,
        );
      }

      if (modeOverride === undefined) {
        mode = rawConfig.mode;
      }
    }

    if (rawConfig.package !== undefined) {
      if (!isNonEmptyString(rawConfig.package)) {
        throw configError(
          'ADDONOVA_CONFIG_BROWSER_API',
          'Config "browserApi.package" must be a non-empty string.',
          'Use the package name "@addonova/browser".',
          configPath,
        );
      }

      packageName = rawConfig.package;
    }

    if (rawConfig.define !== undefined) {
      if (typeof rawConfig.define !== 'boolean') {
        throw configError(
          'ADDONOVA_CONFIG_BROWSER_API',
          'Config "browserApi.define" must be true or false.',
          'Use a boolean value.',
          configPath,
        );
      }

      define = rawConfig.define;
    }
  }

  return { mode, packageName, define };
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
  rawManifest: ManifestInput | undefined,
  configPath: string | null,
): ManifestInput {
  if (rawManifest === undefined) {
    return {};
  }

  if (typeof rawManifest === 'function') {
    return rawManifest;
  }

  if (!isPlainObject(rawManifest)) {
    throw configError(
      'ADDONOVA_CONFIG_MANIFEST',
      'Config "manifest" must be an object or a function.',
      'Provide a manifest object or a function that receives the build context.',
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
  manifestVersionHint: ManifestVersion | undefined,
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

  const defaultManifestVersion = manifestVersionHint;

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
  srcDir: string,
  entrypointsDir: string,
  configPath: string | null,
): readonly ResolvedEntrypoint[] {
  const entrypoints: ResolvedEntrypoint[] = [];

  const addEntrypoint = (
    name: string,
    input: string,
    selection: {
      include?: readonly BrowserTarget[];
      exclude?: readonly BrowserTarget[];
      type?: EntrypointType;
    } = {},
  ): void => {
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

    assertBrowserSelection(selection.include, `${name}.include`, configPath);
    assertBrowserSelection(selection.exclude, `${name}.exclude`, configPath);

    if (selection.type !== undefined && !isEntrypointType(selection.type)) {
      throw configError(
        'ADDONOVA_CONFIG_ENTRYPOINTS',
        `Entrypoint "${name}" has an unknown type "${String(selection.type)}".`,
        'Use a supported entrypoint type such as background, content-script, or popup.',
        configPath,
      );
    }

    const absoluteInput = path.resolve(root, input);
    const kind = detectEntrypointKind(input);

    if (!isFile(absoluteInput)) {
      throw configError(
        'ADDONOVA_CONFIG_ENTRYPOINT_MISSING',
        `Entrypoint "${name}" was not found: ${absoluteInput}`,
        'Check the path and ensure the file exists.',
        configPath,
      );
    }

    const descriptor = describeEntrypoint(
      name,
      absoluteInput,
      kind,
      selection,
    );

    entrypoints.push(
      toResolvedEntrypoint(
        descriptor,
        selection.type !== undefined ||
          Object.keys(descriptor.manifestOptions).length > 0,
      ),
    );
  };

  if (rawEntrypoints === undefined) {
    for (const entrypoint of discoverEntrypoints({
      root,
      srcDir,
      entrypointsDir,
    })) {
      if (entrypoints.some((existing) => existing.name === entrypoint.name)) {
        throw configError(
          'ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT',
          `Duplicate entrypoint name "${entrypoint.name}".`,
          'Give every entrypoint a unique name.',
          configPath,
        );
      }

      entrypoints.push(toResolvedEntrypoint(entrypoint, true));
    }

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
    for (const [name, value] of Object.entries(rawEntrypoints)) {
      if (typeof value === 'string') {
        addEntrypoint(name, value);
        continue;
      }

      if (!isPlainObject(value)) {
        throw configError(
          'ADDONOVA_CONFIG_ENTRYPOINTS',
          `Entrypoint "${name}" must be a string path or an object.`,
          'Use an object with an "input" field and optional include, exclude, or type.',
          configPath,
        );
      }

      const input = value.input;

      if (typeof input !== 'string') {
        throw configError(
          'ADDONOVA_CONFIG_ENTRYPOINTS',
          `Entrypoint "${name}" must include a string "input" path.`,
          'Use { input: "src/popup.html", type: "popup" }.',
          configPath,
        );
      }

      addEntrypoint(name, input, {
        ...(value.include === undefined
          ? {}
          : { include: value.include as readonly BrowserTarget[] }),
        ...(value.exclude === undefined
          ? {}
          : { exclude: value.exclude as readonly BrowserTarget[] }),
        ...(value.type === undefined
          ? {}
          : { type: value.type as EntrypointType }),
      });
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

function toResolvedEntrypoint(
  entrypoint: {
    name: string;
    input: string;
    kind: EntrypointKind;
    type: EntrypointType;
    manifestOptions: EntrypointManifestOptions;
    discovered?: true;
  },
  includeMetadata: boolean,
): ResolvedEntrypoint {
  const resolved: ResolvedEntrypoint = {
    name: entrypoint.name,
    input: entrypoint.input,
    kind: entrypoint.kind,
  };

  if (includeMetadata) {
    resolved.type = entrypoint.type;
    resolved.manifestOptions = entrypoint.manifestOptions;
  }

  if (entrypoint.discovered === true) {
    resolved.discovered = true;
  }

  return resolved;
}

function assertBrowserSelection(
  selection: readonly BrowserTarget[] | undefined,
  field: string,
  configPath: string | null,
): void {
  if (selection === undefined) {
    return;
  }

  if (!Array.isArray(selection)) {
    throw configError(
      'ADDONOVA_CONFIG_ENTRYPOINTS',
      `Entrypoint "${field}" must be an array of browser targets.`,
      `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
      configPath,
    );
  }

  for (const target of selection) {
    if (!isBrowserTarget(target)) {
      throw configError(
        'ADDONOVA_CONFIG_ENTRYPOINTS',
        `Entrypoint "${field}" contains an unknown browser target "${String(target)}".`,
        `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
        configPath,
      );
    }
  }
}

function readManifestVersionHint(
  manifest: ManifestInput,
  _mode: BuildMode,
): ManifestVersion | undefined {
  if (typeof manifest === 'function') {
    return undefined;
  }

  return isManifestVersion(manifest.manifest_version)
    ? manifest.manifest_version
    : undefined;
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
