import type { ProjectBuildResult } from '../core/build.ts';
import type {
  ResolvedBrowser,
  ResolvedConfig,
  ResolvedEntrypoint,
} from '../core/config.ts';
import type { Diagnostic } from '../core/errors.ts';
import type { EntrypointType } from '../core/entrypoints.ts';
import type { BrowserTarget, ManifestVersion } from '../core/types.ts';

export const HOOK_NAMES = [
  'config:resolved',
  'entrypoints:found',
  'entrypoints:resolved',
  'build:manifestGenerated',
  'build:publicAssets',
  'build:done',
  'dev:reload',
] as const;

export type AddonovaHookName = (typeof HOOK_NAMES)[number];

export interface HookEntrypointOptions {
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  type?: EntrypointType;
}

export interface ConfigResolvedHookPayload {
  config: ResolvedConfig;
}

export interface EntrypointsHookPayload {
  config: ResolvedConfig;
  entrypoints: ResolvedEntrypoint[];
  addEntrypoint(
    name: string,
    input: string,
    options?: HookEntrypointOptions,
  ): ResolvedEntrypoint;
  removeEntrypoint(name: string): boolean;
}

export interface GeneratedAsset {
  path: string;
  contents: string | Uint8Array;
}

export interface ManifestGeneratedHookPayload {
  config: ResolvedConfig;
  browser: ResolvedBrowser;
  manifest: Record<string, unknown>;
  diagnostics: Diagnostic[];
}

export interface PublicAssetsHookPayload {
  config: ResolvedConfig;
  browser: ResolvedBrowser;
  outdir: string;
  assets: GeneratedAsset[];
}

export interface BuildDoneHookPayload {
  config: ResolvedConfig;
  reports: readonly ProjectBuildResult[];
}

export interface DevReloadHookPayload {
  config: ResolvedConfig;
  target: BrowserTarget;
  manifestVersion: ManifestVersion;
  reason: 'initial' | 'change';
}

export interface AddonovaHookMap {
  'config:resolved': (payload: ConfigResolvedHookPayload) => void | Promise<void>;
  'entrypoints:found': (
    payload: EntrypointsHookPayload,
  ) => void | Promise<void>;
  'entrypoints:resolved': (
    payload: EntrypointsHookPayload,
  ) => void | Promise<void>;
  'build:manifestGenerated': (
    payload: ManifestGeneratedHookPayload,
  ) => void | Promise<void>;
  'build:publicAssets': (
    payload: PublicAssetsHookPayload,
  ) => void | Promise<void>;
  'build:done': (payload: BuildDoneHookPayload) => void | Promise<void>;
  'dev:reload': (payload: DevReloadHookPayload) => void | Promise<void>;
}

export type AddonovaHooks = {
  [K in AddonovaHookName]?: AddonovaHookMap[K];
};

export type HookPayload<K extends AddonovaHookName> =
  AddonovaHookMap[K] extends (payload: infer Payload) => unknown
    ? Payload
    : never;

export interface HookRegistration {
  event: AddonovaHookName;
  owner: string;
  handler: (payload: never) => void | Promise<void>;
}
