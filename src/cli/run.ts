import { resolveProjectConfig } from '../core/config.ts';
import type { ConfigOverrides, ResolvedConfig } from '../core/config.ts';
import { toDiagnostic } from '../core/errors.ts';
import { ADDONOVA_VERSION } from '../core/version.ts';
import { parseArgs } from './args.ts';
import type { CliOptions } from './args.ts';
import type { CliIo } from './command.ts';
import { commandHandlers, initCommand } from './commands/index.ts';
import { formatDiagnostic } from './format.ts';
import { renderHelp } from './help.ts';
import {
  createCliStyle,
  formatDuration,
  resolveColorEnabled,
  SYMBOLS,
} from './style.ts';
import type { CliStyle } from './style.ts';

export interface RunCliOptions {
  signal?: AbortSignal;
}

export async function runCli(
  argv: readonly string[],
  io: CliIo = createDefaultIo(),
  runOptions: RunCliOptions = {},
): Promise<number> {
  let options: CliOptions;

  try {
    options = parseArgs(argv);
  } catch (error) {
    printError(error, io, false);
    return 1;
  }

  if (options.version) {
    io.stdout.write(`${ADDONOVA_VERSION}\n`);
    return 0;
  }

  if (options.help || options.command === undefined) {
    io.stdout.write(renderHelp());
    return 0;
  }

  const style = createCliStyle(resolveColorEnabled(io, options.noColor));
  const commandIo: CliIo = {
    ...io,
    env: io.env ?? process.env,
    color: style.enabled,
  };
  const started = Date.now();

  io.stdout.write(
    `\n${style.gray('Addonova')} ${style.bold(style.gray(ADDONOVA_VERSION))}\n`,
  );

  try {
    const overrides: ConfigOverrides = {};

    if (options.browsers.length > 0) {
      overrides.browsers = options.browsers;
    }

    if (options.manifestVersion !== undefined) {
      overrides.manifestVersion = options.manifestVersion;
    }

    if (options.mode !== undefined) {
      overrides.mode = options.mode;
    }

    if (options.outdir !== undefined) {
      overrides.outdir = options.outdir;
    }

    if (options.minify !== undefined) {
      overrides.minify = options.minify;
    }

    if (options.sourcemap !== undefined) {
      overrides.sourcemap = options.sourcemap;
    }

    if (options.browserApi !== undefined) {
      overrides.browserApi = options.browserApi;
    }

    const resolveConfig = (): Promise<ResolvedConfig> =>
      resolveProjectConfig({
        cwd: io.cwd,
        overrides,
        defaultMode: options.command === 'dev' ? 'development' : 'production',
        ...(options.configPath === undefined
          ? {}
          : { explicitConfigPath: options.configPath }),
      });
    const command = options.command;
    const exitCode =
      command === 'init'
        ? await initCommand({ cwd: io.cwd, options, io: commandIo })
        : await commandHandlers[command]({
            cwd: io.cwd,
            options,
            config: await resolveConfig(),
            io: commandIo,
            reloadConfig: resolveConfig,
            ...(runOptions.signal === undefined
              ? {}
              : { signal: runOptions.signal }),
          });

    if (exitCode === 0) {
      if (options.command !== 'dev') {
        commandIo.stdout.write(
          `${style.green(SYMBOLS.success)} Finished in ${formatDuration(
            Date.now() - started,
          )}\n`,
        );
      }
    } else {
      commandIo.stderr.write(
        `${style.red(SYMBOLS.error)} Command failed after ${formatDuration(
          Date.now() - started,
        )}\n`,
      );
    }

    return exitCode;
  } catch (error) {
    commandIo.stderr.write(
      `${style.red(SYMBOLS.error)} Command failed after ${formatDuration(
        Date.now() - started,
      )}\n`,
    );
    printError(error, commandIo, options.verbose, style);
    return 1;
  }
}

export function createDefaultIo(): CliIo {
  return {
    cwd: process.cwd(),
    stdout: {
      write(chunk: string) {
        return process.stdout.write(chunk);
      },
      ...(process.stdout.isTTY === undefined
        ? {}
        : { isTTY: process.stdout.isTTY }),
    },
    stderr: {
      write(chunk: string) {
        return process.stderr.write(chunk);
      },
      ...(process.stderr.isTTY === undefined
        ? {}
        : { isTTY: process.stderr.isTTY }),
    },
  };
}

function printError(
  error: unknown,
  io: CliIo,
  verbose: boolean,
  style?: CliStyle,
): void {
  io.stderr.write(`${formatDiagnostic(toDiagnostic(error), style)}\n`);

  if (verbose && error instanceof Error && error.stack !== undefined) {
    io.stderr.write(`${error.stack}\n`);
  }
}
