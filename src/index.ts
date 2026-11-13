export {
  AddonovaError,
  createDiagnostic,
  isAddonovaError,
  toDiagnostic,
} from './core/errors.ts';
export type {
  Diagnostic,
  DiagnosticLocation,
  DiagnosticSeverity,
} from './core/errors.ts';
export {
  ARCHIVE_FORMATS,
  BROWSER_API_MODES,
  BROWSER_TARGETS,
  DEFAULT_BROWSER,
  DEFAULT_MANIFEST_VERSION,
} from './core/types.ts';
export type {
  ArchiveFormat,
  BrowserApiMode,
  BuildMode,
  BrowserTarget,
  EntrypointKind,
  ManifestVersion,
  SourcemapOption,
} from './core/types.ts';
export { defineConfig } from './core/config.ts';
export type {
  AddonovaBrowserApiConfig,
  AddonovaPackConfig,
  AddonovaUserConfig,
  BrowserOverridesInput,
  ConfigOverrides,
  EntrypointConfigInput,
  EntrypointsInput,
  ManifestContext,
  ManifestInput,
  ResolvedBrowser,
  ResolvedBrowserApiConfig,
  ResolvedConfig,
  ResolvedEntrypoint,
  ResolvedPackConfig,
} from './core/config.ts';
export {
  ENTRYPOINT_TYPES,
  detectEntrypointKind,
  discoverEntrypoints,
  inferEntrypointType,
  isEntrypointForBrowser,
  isEntrypointType,
} from './core/entrypoints.ts';
export type {
  DiscoverEntrypointsOptions,
  DiscoveredEntrypoint,
  EntrypointManifestOptions,
  EntrypointSelection,
  EntrypointType,
} from './core/entrypoints.ts';
export type {
  BackgroundDefinition,
  ContentScriptContext,
  ContentScriptDefinition,
  ContentScriptWorld,
  CssInjectionMode,
  PageDefinition,
  RunAt,
  UnlistedScriptDefinition,
} from './core/defines.ts';
export type { ManifestDefaults, PackageInfo } from './core/package.ts';
export {
  buildProject,
  copyPublicDirectory,
  getEntrypointOutputName,
  getOutputDirectory,
  toBundlerEntrypoints,
} from './core/build.ts';
export type {
  BuildProjectOptions,
  ProjectBuildResult,
  PublicCopyResult,
} from './core/build.ts';
export {
  assertSafeOutputDirectory,
  cleanProject,
} from './core/clean.ts';
export type {
  CleanProjectOptions,
  CleanProjectResult,
} from './core/clean.ts';
export {
  BUILTIN_TEMPLATES,
  DEFAULT_TEMPLATE,
  PACKAGE_MANAGERS,
  TEMPLATE_LABELS,
  detectPackageManager,
  initProject,
  isBuiltinTemplate,
  isPackageManager,
  resolveBuiltinTemplate,
} from './core/init.ts';
export type {
  BuiltinTemplate,
  InitProjectOptions,
  InitProjectResult,
  PackageManager,
  TemplateDownloader,
} from './core/init.ts';
export {
  getArchivePath,
  packProject,
} from './core/pack.ts';
export type {
  PackProjectOptions,
  PackRunner,
  PackTargetResult,
} from './core/pack.ts';
export {
  buildManifest,
  resolveManifestObject,
  writeManifest,
} from './browser/manifest.ts';
export type {
  BuildManifestOptions,
  BuiltManifest,
} from './browser/manifest.ts';
export { loadBuildEnv, toImportMetaEnvDefines } from './core/env.ts';
export type { BuildEnv, LoadBuildEnvOptions } from './core/env.ts';
export {
  BROWSER_TARGET_INFO,
  getBrowserTargetInfo,
  supportsManifestVersion,
} from './browser/targets.ts';
export type { BrowserTargetInfo } from './browser/targets.ts';
export {
  BROWSER_API_SUBPATHS,
  assertBrowserApiInstalled,
  getBrowserApiBundlerSettings,
} from './browser/api-integration.ts';
export type { BrowserApiBundlerSettings } from './browser/api-integration.ts';

export {
  createPluginManager,
  mergePluginDiagnostics,
  validatePlugins,
} from './plugins/manager.ts';
export type { PluginManager } from './plugins/manager.ts';
export type { AddonovaPlugin } from './plugins/types.ts';

export { guchhoAdapter } from './bundler/guchho.ts';
export type {
  BundlerAdapter,
  BundlerBuildInput,
  BundlerBuildResult,
  BundlerContext,
  BundlerEntrypoint,
  BundlerFormat,
  BundlerInput,
  BundlerOutput,
  BundlerTransform,
} from './bundler/adapter.ts';
export {
  DevSession,
  classifyChange,
  createDevSession,
} from './dev/watcher.ts';
export type {
  ChangeKind,
  DevSessionOptions,
  DevWatcher,
  DevWatcherFactory,
  DevWatcherOptions,
} from './dev/watcher.ts';
