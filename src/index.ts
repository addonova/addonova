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
  BROWSER_TARGETS,
  DEFAULT_BROWSER,
  DEFAULT_MANIFEST_VERSION,
} from './core/types.ts';
export type {
  ArchiveFormat,
  BuildMode,
  BrowserTarget,
  EntrypointKind,
  ManifestVersion,
  SourcemapOption,
} from './core/types.ts';
export { defineConfig } from './core/config.ts';
export type {
  AddonovaPackConfig,
  AddonovaUserConfig,
  ResolvedBrowser,
  ResolvedConfig,
  ResolvedEntrypoint,
  ResolvedPackConfig,
} from './core/config.ts';
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
  writeManifest,
} from './browser/manifest.ts';
export type {
  BuildManifestOptions,
  BuiltManifest,
} from './browser/manifest.ts';
export {
  BROWSER_TARGET_INFO,
  getBrowserTargetInfo,
  supportsManifestVersion,
} from './browser/targets.ts';
export type { BrowserTargetInfo } from './browser/targets.ts';

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
