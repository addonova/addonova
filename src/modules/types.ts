import type { AddonovaUserConfig, ResolvedEntrypoint } from '../core/config.ts';
import type { EntrypointType } from '../core/entrypoints.ts';
import type { BrowserTarget, BuildMode } from '../core/types.ts';
import type {
  AddonovaHookMap,
  AddonovaHookName,
} from '../hooks/types.ts';

export interface ModuleEntrypointOptions {
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  type?: EntrypointType;
}

export interface AddonovaModuleHooks {
  on<K extends AddonovaHookName>(
    event: K,
    handler: AddonovaHookMap[K],
  ): void;
}

export interface AddonovaModuleContext {
  root: string;
  configPath: string | null;
  mode: BuildMode;
  options: unknown;
  config: Readonly<AddonovaUserConfig>;
  hooks: AddonovaModuleHooks;
  addEntrypoint(
    name: string,
    input: string,
    options?: ModuleEntrypointOptions,
  ): void;
  addAlias(name: string, target: string): void;
  addFile(relativePath: string, contents: string | Uint8Array): void;
}

export interface AddonovaModule {
  name: string;
  configKey?: string;
  setup(context: AddonovaModuleContext): void | Promise<void>;
}

export type AddonovaModuleInput =
  | AddonovaModule
  | string
  | readonly [string, unknown];

export interface ModuleResolution {
  modules: readonly AddonovaModule[];
  files: readonly string[];
  entrypoints: readonly ResolvedEntrypoint[];
  alias: Readonly<Record<string, string>>;
}

export function defineAddonovaModule<T extends AddonovaModule>(module: T): T {
  return module;
}
