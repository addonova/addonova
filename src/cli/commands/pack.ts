import { packProject } from '../../core/pack.ts';
import type { CommandContext } from '../command.ts';
import { formatDiagnostic } from '../format.ts';
import { formatBytes, getCliStyle, SYMBOLS } from '../style.ts';

export async function packCommand(context: CommandContext): Promise<number> {
  const style = getCliStyle(context.io);
  const results = await packProject(context.config);

  for (const result of results) {
    context.io.stdout.write(
      `${style.green(SYMBOLS.success)} Packed ${style.cyan(
        result.browser.target,
      )} MV${result.browser.manifestVersion} -> ${style.cyan(
        result.archivePath,
      )} (${style.dim(formatBytes(result.size))})\n`,
    );

    for (const warning of result.warnings) {
      context.io.stderr.write(
        `${formatDiagnostic(
          {
            code: 'ADDONOVA_PACK_WARNING',
            severity: 'warning',
            message: warning,
            location: { file: result.outdir },
          },
          style,
        )}\n`,
      );
    }
  }

  return 0;
}
