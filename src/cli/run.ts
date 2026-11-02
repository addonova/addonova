import { resolveProjectConfig } from '../core/config.js';
import type { ConfigOverrides, ResolvedConfig } from '../core/config.js';
import { toDiagnostic } from '../core/errors.js';
import { ADDONOVA_VERSION } from '../core/version.js';
import { parseArgs } from './args.js';
import type { CliOptions } from './args.js';
import type { CliIo } from './command.js';
import { commandHandlers } from './commands/index.js';
import { formatDiagnostic } from './format.js';
import { renderHelp } from './help.js';

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

    const resolveConfig = (): Promise<ResolvedConfig> =>
      resolveProjectConfig({
        cwd: io.cwd,
        overrides,
        defaultMode: options.command === 'dev' ? 'development' : 'production',
        ...(options.configPath === undefined
          ? {}
          : { explicitConfigPath: options.configPath }),
      });
    const config = await resolveConfig();
    const handler = commandHandlers[options.command];

    return await handler({
      cwd: io.cwd,
      options,
      config,
      io,
      reloadConfig: resolveConfig,
      ...(runOptions.signal === undefined ? {} : { signal: runOptions.signal }),
    });
  } catch (error) {
    printError(error, io, options.verbose);
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
    },
    stderr: {
      write(chunk: string) {
        return process.stderr.write(chunk);
      },
    },
  };
}

function printError(error: unknown, io: CliIo, verbose: boolean): void {
  io.stderr.write(`${formatDiagnostic(toDiagnostic(error))}\n`);

  if (verbose && error instanceof Error && error.stack !== undefined) {
    io.stderr.write(`${error.stack}\n`);
  }
}
