export {
  AddonovaError,
  createDiagnostic,
  isAddonovaError,
  toDiagnostic,
} from './core/errors.js';
export type {
  Diagnostic,
  DiagnosticLocation,
  DiagnosticSeverity,
} from './core/errors.js';
export {
  ARCHIVE_FORMATS,
  BROWSER_TARGETS,
  DEFAULT_BROWSER,
  DEFAULT_MANIFEST_VERSION,
} from './core/types.js';
export type {
  ArchiveFormat,
  BuildMode,
  BrowserTarget,
  EntrypointKind,
  ManifestVersion,
  SourcemapOption,
} from './core/types.js';
export { defineConfig } from './core/config.js';
export type {
  AddonovaPackConfig,
  AddonovaUserConfig,
  ResolvedBrowser,
  ResolvedConfig,
  ResolvedEntrypoint,
  ResolvedPackConfig,
} from './core/config.js';
export {
  buildProject,
  copyPublicDirectory,
  getEntrypointOutputName,
  getOutputDirectory,
  toBundlerEntrypoints,
} from './core/build.js';
export type {
  BuildProjectOptions,
  ProjectBuildResult,
  PublicCopyResult,
} from './core/build.js';
export {
  assertSafeOutputDirectory,
  cleanProject,
} from './core/clean.js';
export type {
  CleanProjectOptions,
  CleanProjectResult,
} from './core/clean.js';
export {
  getArchivePath,
  packProject,
} from './core/pack.js';
export type {
  PackProjectOptions,
  PackRunner,
  PackTargetResult,
} from './core/pack.js';
export {
  buildManifest,
  writeManifest,
} from './browser/manifest.js';
export type {
  BuildManifestOptions,
  BuiltManifest,
} from './browser/manifest.js';
export {
  BROWSER_TARGET_INFO,
  getBrowserTargetInfo,
  supportsManifestVersion,
} from './browser/targets.js';
export type { BrowserTargetInfo } from './browser/targets.js';

export { guchhoAdapter } from './bundler/guchho.js';
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
} from './bundler/adapter.js';
export {
  DevSession,
  classifyChange,
  createDevSession,
} from './dev/watcher.js';
export type {
  ChangeKind,
  DevSessionOptions,
  DevWatcher,
  DevWatcherFactory,
  DevWatcherOptions,
} from './dev/watcher.js';
