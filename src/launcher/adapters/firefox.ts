import { AddonovaError } from '../../core/errors.ts';
import type { Diagnostic } from '../../core/errors.ts';
import type { BidiClient } from '../bidi.ts';
import { connectBidi } from '../bidi.ts';
import {
  ManagedProcess,
} from '../process.ts';
import { stripProfileArgs } from '../profiles.ts';
import type { RunningBrowser } from '../types.ts';
import type {
  BrowserAdapter,
  LaunchBrowserOptions,
} from './types.ts';

const FIREFOX_PROTECTED_FLAGS = new Set([
  '--new-instance',
  '--no-remote',
  '--profile',
  '--remote-debugging-port',
  '--remote-debugging-address',
  '-new-instance',
  '-no-remote',
]);

interface StartedFirefox {
  process: ManagedProcess;
  bidi: BidiClient;
  extensionId: string;
}

export const firefoxAdapter: BrowserAdapter = {
  family: 'firefox',
  async launch(options: LaunchBrowserOptions): Promise<RunningBrowser> {
    const launchTimeoutMs = options.launchTimeoutMs ?? 20_000;
    const protocolTimeoutMs = options.protocolTimeoutMs ?? 10_000;
    let current: StartedFirefox;
    let closed = false;

    const start = async (): Promise<StartedFirefox> => {
      const browserProcess = startFirefoxProcess(options);
      let bidi: BidiClient | null = null;
      let extensionLoading = false;

      try {
        const bidiUrl = await waitForBidiUrl(
          browserProcess,
          launchTimeoutMs,
        );
        bidi = await connectBidi(bidiUrl, {
          timeoutMs: protocolTimeoutMs,
        });
        await bidi.newSession();
        extensionLoading = true;
        const extensionId = await bidi.installWebExtension(
          options.extensionDir,
        );

        return {
          process: browserProcess,
          bidi,
          extensionId,
        };
      } catch (error) {
        bidi?.dispose();
        await browserProcess.terminate(1_000);

        if (browserProcess.spawnError !== null) {
          throw launchError(options, browserProcess.spawnError);
        }

        throw extensionLoading
          ? extensionLoadError(options, error)
          : launchError(options, error);
      }
    };

    const restart = async (): Promise<void> => {
      current.bidi.dispose();
      await current.process.terminate(1_000);
      current = await start();
    };

    current = await start();

    const reload = async (): Promise<void> => {
      if (closed) {
        throw new Error('The browser launcher is closed.');
      }

      if (!current.process.isRunning) {
        await restart();
        return;
      }

      try {
        try {
          await current.bidi.uninstallWebExtension(current.extensionId);
        } catch {
          // Reload can still succeed if uninstall reports a missing extension.
        }

        if (!current.process.isRunning) {
          await restart();
          return;
        }

        current.extensionId = await current.bidi.installWebExtension(
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
      await current.bidi.closeBrowser();
      current.bidi.dispose();
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

function startFirefoxProcess(
  options: LaunchBrowserOptions,
): ManagedProcess {
  const args = buildFirefoxArgs(options);

  return new ManagedProcess({
    command: options.binary,
    args,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: options.env,
    ...(options.spawn === undefined ? {} : { spawn: options.spawn }),
  });
}

export function buildFirefoxArgs(options: LaunchBrowserOptions): string[] {
  const args = [
    '--new-instance',
    '--no-remote',
    '--profile',
    options.profile.path,
    '--remote-debugging-port=0',
  ];

  const customArgs = stripProfileArgs(options.config.firefoxArgs, 'firefox');

  for (const argument of customArgs) {
    if (isProtectedFirefoxArgument(argument)) {
      warn(
        options,
        `Ignoring custom Firefox argument "${argument}" because Addonova controls this flag.`,
      );
      continue;
    }

    args.push(argument);
  }

  args.push(...options.config.startUrls);

  return args;
}

function isProtectedFirefoxArgument(argument: string): boolean {
  const flag = argument.split('=', 1)[0] ?? argument;
  return FIREFOX_PROTECTED_FLAGS.has(flag);
}

function waitForBidiUrl(
  browserProcess: ManagedProcess,
  timeoutMs: number,
): Promise<string> {
  const readers = [browserProcess.stdout, browserProcess.stderr].filter(
    (reader): reader is NonNullable<typeof reader> => reader !== null,
  );

  return new Promise<string>((resolve, reject) => {
    const removers: Array<() => void> = [];

    const cleanup = (): void => {
      clearTimeout(timer);

      for (const remove of removers) {
        remove();
      }
    };

    const fail = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const timer = setTimeout(() => {
      fail(
        new Error(
          `Timed out waiting for Firefox WebDriver BiDi output after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    removers.push(
      browserProcess.onExit(() => {
        fail(
          browserProcess.spawnError ??
            new Error('The Firefox process exited before WebDriver BiDi was ready.'),
        );
      }),
    );

    for (const reader of readers) {
      removers.push(
        reader.onLine((line) => {
          const match = /(?:^|\s)(ws:\/\/[^\s]+)/.exec(line);

          if (match?.[1] !== undefined) {
            cleanup();
            resolve(match[1]);
          }
        }),
      );
    }
  });
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
      'Use a Firefox version with WebDriver BiDi extension installation support.',
    cause,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
