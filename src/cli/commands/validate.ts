import { buildManifest } from '../../browser/manifest.js';
import type { CommandContext } from '../command.js';
import { formatDiagnostic } from '../format.js';

export function validateCommand(context: CommandContext): number {
  let failed = false;

  for (const browser of context.config.browsers) {
    const builtManifest = buildManifest(context.config.manifest, browser);
    const errors = builtManifest.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );

    for (const diagnostic of builtManifest.diagnostics) {
      context.io.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
    }

    if (errors.length > 0) {
      failed = true;
    } else {
      context.io.stdout.write(
        `Validated ${browser.target} MV${browser.manifestVersion}\n`,
      );
    }
  }

  if (!failed) {
    context.io.stdout.write('Configuration is valid.\n');
  }

  return failed ? 1 : 0;
}
