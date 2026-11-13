import { mkdirSync, rmSync } from 'node:fs';

import type { Diagnostic } from '../core/errors.ts';
import type { BrowserTarget } from '../core/types.ts';
import { getBrowserAdapter } from './adapters/index.ts';
import type { LaunchBrowserOptions } from './adapters/index.ts';
import { findBrowserBinary } from './browser-paths.ts';
import { planBrowserProfile } from './profiles.ts';
import type { SpawnFunction } from './process.ts';
import type {
  BrowserLauncher,
  BrowserProfilePlan,
  ResolvedWebExtConfig,
  RunningBrowser,
} from './types.ts';

export interface CreateBrowserLauncherOptions {
  target: BrowserTarget;
  extensionDir: string;
  projectRoot: string;
  config: ResolvedWebExtConfig;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  spawn?: SpawnFunction;
  launchTimeoutMs?: number;
  protocolTimeoutMs?: number;
  onWarning?: (diagnostic: Diagnostic) => void;
}

export function createBrowserLauncher(
  options: CreateBrowserLauncherOptions,
): BrowserLauncher {
  let running: RunningBrowser | null = null;
  let profile: BrowserProfilePlan | null = null;
  let closed = false;

  const cleanupProfile = (): void => {
    if (profile !== null && !profile.persistent) {
      try {
        rmSync(profile.path, { recursive: true, force: true });
      } catch {
        // Cleanup is best-effort; the OS may still hold profile files briefly.
      }
    }

    profile = null;
  };

  const disposeRunning = async (): Promise<void> => {
    const current = running;
    running = null;

    if (current !== null) {
      await current.close();
    }

    cleanupProfile();
  };

  const launch = async (): Promise<void> => {
    if (closed || options.config.disabled) {
      return;
    }

    if (running !== null) {
      if (running.isRunning) {
        return;
      }

      await disposeRunning();
    }

    const binary = findBrowserBinary({
      target: options.target,
      binaries: options.config.binaries,
      root: options.projectRoot,
      ...(options.platform === undefined ? {} : { platform: options.platform }),
      ...(options.env === undefined ? {} : { env: options.env }),
    });
    const profilePlan = planBrowserProfile({
      target: options.target,
      config: options.config,
      root: options.projectRoot,
    });

    for (const warning of profilePlan.warnings) {
      options.onWarning?.(warning);
    }

    profile = profilePlan.profile;
    mkdirSync(profile.path, { recursive: true });

    const launchOptions: LaunchBrowserOptions = {
      target: options.target,
      binary,
      extensionDir: options.extensionDir,
      profile,
      config: options.config,
      projectRoot: options.projectRoot,
      env: options.env ?? process.env,
      ...(options.spawn === undefined ? {} : { spawn: options.spawn }),
      ...(options.launchTimeoutMs === undefined
        ? {}
        : { launchTimeoutMs: options.launchTimeoutMs }),
      ...(options.protocolTimeoutMs === undefined
        ? {}
        : { protocolTimeoutMs: options.protocolTimeoutMs }),
      ...(options.onWarning === undefined
        ? {}
        : { onWarning: options.onWarning }),
    };

    try {
      running = await getBrowserAdapter(options.target).launch(launchOptions);
    } catch (error) {
      cleanupProfile();
      throw error;
    }
  };

  const reload = async (): Promise<void> => {
    if (closed || options.config.disabled) {
      return;
    }

    if (running === null) {
      await launch();
      return;
    }

    await running.reload();
  };

  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }

    closed = true;

    try {
      await disposeRunning();
    } finally {
      cleanupProfile();
    }
  };

  return {
    target: options.target,
    get extensionId(): string {
      return running?.extensionId ?? '';
    },
    get isRunning(): boolean {
      return !closed && (running?.isRunning ?? false);
    },
    launch,
    reload,
    close,
  };
}

export async function launchBrowser(
  options: CreateBrowserLauncherOptions,
): Promise<RunningBrowser> {
  const launcher = createBrowserLauncher(options);

  await launcher.launch();

  return launcher;
}
