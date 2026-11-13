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
  AddonovaSourcesPackConfig,
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
  ResolvedSourcesPackConfig,
} from './core/config.ts';
export {
  createDefaultWebExtConfig,
  mergeWebExtConfig,
  normalizeWebExtConfig,
} from './launcher/config.ts';
export {
  createBrowserLauncher,
  launchBrowser,
} from './launcher/launcher.ts';
export type {
  CreateBrowserLauncherOptions,
} from './launcher/launcher.ts';
export {
  findBrowserBinary,
  tryFindBrowserBinary,
} from './launcher/browser-paths.ts';
export type {
  FindBrowserBinaryOptions,
} from './launcher/browser-paths.ts';
export {
  getBrowserAdapter,
} from './launcher/adapters/index.ts';
export type {
  BrowserAdapter,
  LaunchBrowserOptions,
} from './launcher/adapters/index.ts';
export type {
  BrowserLauncher,
  BrowserProfilePlan,
  ResolvedWebExtConfig,
  RunningBrowser,
  WebExtConfig,
} from './launcher/types.ts';
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
  writeGeneratedAssets,
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
  getSourcesArchivePath,
  packProject,
} from './core/pack.ts';
export type {
  PackProjectOptions,
  PackRunner,
  PackSourcesResult,
  PackTargetResult,
} from './core/pack.ts';
export { analyzeProject, extractDependencies } from './core/analyze.ts';
export type {
  AnalyzeProjectOptions,
  ProjectAnalysis,
} from './core/analyze.ts';
export {
  DOCTOR_STATUSES,
  collectDoctorReport,
} from './core/doctor.ts';
export type {
  DoctorCheck,
  DoctorOptions,
  DoctorReport,
  DoctorStatus,
  DoctorSummary,
} from './core/doctor.ts';
export {
  expandBraces,
  filterPaths,
  matchesAny,
  matchesDirectory,
  matchesGlob,
} from './core/glob.ts';
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
export {
  HOOK_NAMES,
} from './hooks/types.ts';
export type {
  AddonovaHookMap,
  AddonovaHookName,
  AddonovaHooks,
  BuildDoneHookPayload,
  ConfigResolvedHookPayload,
  DevReloadHookPayload,
  EntrypointsHookPayload,
  GeneratedAsset,
  HookEntrypointOptions,
  HookPayload,
  HookRegistration,
  ManifestGeneratedHookPayload,
  PublicAssetsHookPayload,
} from './hooks/types.ts';
export {
  HookManager,
  createHookManager,
  hookError,
  toHookRegistrations,
  validateHooks,
} from './hooks/manager.ts';
export {
  defineAddonovaModule,
} from './modules/types.ts';
export type {
  AddonovaModule,
  AddonovaModuleContext,
  AddonovaModuleHooks,
  AddonovaModuleInput,
  ModuleEntrypointOptions,
  ModuleResolution,
} from './modules/types.ts';
export { resolveModules } from './modules/loader.ts';
export type { ResolveModulesOptions } from './modules/loader.ts';

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
  BrowserLauncherFactory,
  ChangeKind,
  DevSessionOptions,
  DevWatcher,
  DevWatcherFactory,
  DevWatcherOptions,
} from './dev/watcher.ts';
