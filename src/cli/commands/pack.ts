import { packProject } from '../../core/pack.ts';
import type { PackTargetResult } from '../../core/pack.ts';
import type { CommandContext } from '../command.ts';
import { formatDiagnostic } from '../format.ts';
import { formatBytes, getCliStyle, SYMBOLS } from '../style.ts';
import type { CliStyle } from '../style.ts';

export async function packCommand(context: CommandContext): Promise<number> {
  const results = await packProject(context.config, {
    ...(context.options.include.length === 0
      ? {}
      : { include: context.options.include }),
    ...(context.options.exclude.length === 0
      ? {}
      : { exclude: context.options.exclude }),
    ...(context.options.sources === undefined
      ? {}
      : { sources: context.options.sources }),
  });

  writePackResults(context, results);
  return 0;
}

export function writePackResults(
  context: CommandContext,
  results: readonly PackTargetResult[],
): void {
  const style = getCliStyle(context.io);

  for (const result of results) {
    context.io.stdout.write(
      `${style.green(SYMBOLS.success)} Packed ${style.cyan(
        result.browser.target,
      )} MV${result.browser.manifestVersion} -> ${style.cyan(
        result.archivePath,
      )} (${style.dim(formatBytes(result.size))})\n`,
    );
    writeWarnings(context, style, result.warnings, result.outdir);

    if (result.sources !== undefined) {
      context.io.stdout.write(
        `${style.green(SYMBOLS.success)} Packed sources -> ${style.cyan(
          result.sources.archivePath,
        )} (${style.dim(formatBytes(result.sources.size))}, ${style.dim(
          `${result.sources.files} files`,
        )})\n`,
      );
      writeWarnings(
        context,
        style,
        result.sources.warnings,
        result.sources.root,
      );
    }
  }
}

function writeWarnings(
  context: CommandContext,
  style: CliStyle,
  warnings: readonly string[],
  file: string,
): void {
  for (const warning of warnings) {
    context.io.stderr.write(
      `${formatDiagnostic(
        {
          code: 'ADDONOVA_PACK_WARNING',
          severity: 'warning',
          message: warning,
          location: { file },
        },
        style,
      )}\n`,
    );
  }
}
