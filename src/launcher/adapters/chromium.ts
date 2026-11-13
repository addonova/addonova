import { AddonovaError } from '../../core/errors.ts';
import type { Diagnostic } from '../../core/errors.ts';
import type { CdpClient } from '../cdp.ts';
import {
  connectCdpPipe,
  isMethodNotFoundError,
} from '../cdp.ts';
import {
  ManagedProcess,
} from '../process.ts';
import type { SpawnFunction } from '../process.ts';
import { stripProfileArgs } from '../profiles.ts';
import type { RunningBrowser } from '../types.ts';
import type {
  BrowserAdapter,
  LaunchBrowserOptions,
} from './types.ts';

const CHROMIUM_PROTECTED_FLAGS = new Set([
  '--remote-debugging-pipe',
  '--remote-debugging-port',
  '--remote-debugging-address',
  '--load-extension',
  '--disable-extensions',
]);

interface StartedChromium {
  process: ManagedProcess;
  cdp: CdpClient | null;
  extensionId: string;
  mode: 'cdp' | 'load-extension';
}

export const chromiumAdapter: BrowserAdapter = {
  family: 'chromium',
  async launch(options: LaunchBrowserOptions): Promise<RunningBrowser> {
    const launchTimeoutMs = options.launchTimeoutMs ?? 15_000;
    const protocolTimeoutMs = options.protocolTimeoutMs ?? 10_000;
    let current: StartedChromium;
    let closed = false;

    const startWithCdp = async (): Promise<StartedChromium | null> => {
      const browserProcess = startChromiumProcess(options);
      let cdp: CdpClient | null = null;

      try {
        cdp = connectCdpPipe(browserProcess.child, protocolTimeoutMs);
        const extensionId = await cdp.loadUnpacked(options.extensionDir);

        return {
          process: browserProcess,
          cdp,
          extensionId,
          mode: 'cdp',
        };
      } catch (error) {
        cdp?.dispose();
        await browserProcess.terminate(1_000);

        if (isMethodNotFoundError(error)) {
          return null;
        }

        if (browserProcess.spawnError !== null) {
          throw launchError(options, browserProcess.spawnError);
        }

        throw extensionLoadError(options, error);
      }
    };

    const startWithLoadExtension = async (): Promise<StartedChromium> => {
      const browserProcess = startChromiumProcess(
        options,
        options.extensionDir,
      );

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      if (browserProcess.spawnError !== null) {
        throw launchError(options, browserProcess.spawnError);
      }

      return {
        process: browserProcess,
        cdp: null,
        extensionId: '',
        mode: 'load-extension',
      };
    };

    const start = async (): Promise<StartedChromium> => {
      const withCdp = await startWithCdp();

      if (withCdp !== null) {
        return withCdp;
      }

      warn(
        options,
        `The installed ${options.target} browser does not support CDP extension loading. Falling back to --load-extension.`,
      );

      return startWithLoadExtension();
    };

    const restart = async (): Promise<void> => {
      const previousMode = current.mode;
      current.cdp?.dispose();
      await current.process.terminate(1_000);
      current = previousMode === 'load-extension'
        ? await startWithLoadExtension()
        : await start();
    };

    current = await start();

    const reload = async (): Promise<void> => {
      if (closed) {
        throw new Error('The browser launcher is closed.');
      }

      if (current.mode === 'load-extension') {
        await restart();
        return;
      }

      if (!current.process.isRunning || current.cdp === null) {
        await restart();
        return;
      }

      try {
        try {
          await current.cdp.uninstall(current.extensionId);
        } catch {
          // Reload can still succeed if uninstall reports a missing extension.
        }

        if (!current.process.isRunning) {
          await restart();
          return;
        }

        current.extensionId = await current.cdp.loadUnpacked(
          options.extensionDir,
        );
      } catch (error) {
        if (!current.process.isRunning) {
          await restart();
          return;
        }

        throw extensionLoadError(options, error);
      }
    };

    const close = async (): Promise<void> => {
      if (closed) {
        return;
      }

      closed = true;

      if (current.cdp !== null) {
        await current.cdp.closeBrowser();
        current.cdp.dispose();
      }

      await current.process.terminate(launchTimeoutMs);
    };

    return {
      get extensionId(): string {
        return current.extensionId;
      },
      get isRunning(): boolean {
        return !closed && current.process.isRunning;
      },
      reload,
      close,
    };
  },
};

function startChromiumProcess(
  options: LaunchBrowserOptions,
  loadExtensionDir?: string,
): ManagedProcess {
  const args = buildChromiumArgs(options, loadExtensionDir);

  return new ManagedProcess({
    command: options.binary,
    args,
    stdio: loadExtensionDir === undefined
      ? ['ignore', 'pipe', 'pipe', 'pipe', 'pipe']
      : ['ignore', 'pipe', 'pipe'],
    env: options.env,
    ...(options.spawn === undefined ? {} : { spawn: options.spawn }),
  });
}

export function buildChromiumArgs(
  options: LaunchBrowserOptions,
  loadExtensionDir?: string,
): string[] {
  const args = [
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--metrics-recording-only',
    `--user-data-dir=${options.profile.path}`,
  ];

  if (loadExtensionDir !== undefined) {
    args.push(`--load-extension=${loadExtensionDir}`);
  }

  const customArgs = stripProfileArgs(
    options.config.chromiumArgs,
    'chromium',
  );

  for (const argument of customArgs) {
    if (isProtectedChromiumArgument(argument)) {
      warn(
        options,
        `Ignoring custom Chromium argument "${argument}" because Addonova controls this flag.`,
      );
      continue;
    }

    args.push(argument);
  }

  args.push(...options.config.startUrls);

  return args;
}

function isProtectedChromiumArgument(argument: string): boolean {
  const flag = argument.split('=', 1)[0] ?? argument;
  return CHROMIUM_PROTECTED_FLAGS.has(flag);
}

function warn(options: LaunchBrowserOptions, message: string): void {
  const diagnostic: Diagnostic = {
    code: 'ADDONOVA_BROWSER_ARG_IGNORED',
    severity: 'warning',
    message,
  };

  options.onWarning?.(diagnostic);
}

function launchError(
  options: LaunchBrowserOptions,
  cause: unknown,
): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_BROWSER_LAUNCH_FAILED',
    severity: 'error',
    message: `Failed to launch ${options.target}: ${getErrorMessage(cause)}`,
    suggestion: 'Check the browser binary path and browser arguments.',
    cause,
  });
}

function extensionLoadError(
  options: LaunchBrowserOptions,
  cause: unknown,
): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_BROWSER_EXTENSION_LOAD_FAILED',
    severity: 'error',
    message: `Failed to load the extension in ${options.target}: ${getErrorMessage(cause)}`,
    suggestion:
      'Check the extension output and ensure the installed browser supports loading unpacked extensions.',
    cause,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { SpawnFunction };
