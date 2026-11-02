import { packProject } from '../../core/pack.js';
import type { CommandContext } from '../command.js';
import { formatDiagnostic } from '../format.js';

export async function packCommand(context: CommandContext): Promise<number> {
  const results = await packProject(context.config);

  for (const result of results) {
    context.io.stdout.write(
      `Packed ${result.browser.target} MV${result.browser.manifestVersion} -> ${result.archivePath} (${result.size} bytes)\n`,
    );

    for (const warning of result.warnings) {
      context.io.stderr.write(
        `${formatDiagnostic({
          code: 'ADDONOVA_PACK_WARNING',
          severity: 'warning',
          message: warning,
          location: { file: result.outdir },
        })}\n`,
      );
    }
  }

  return 0;
}
