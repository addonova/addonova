import { buildManifest } from '../../browser/manifest.ts';
import type { CommandContext } from '../command.ts';
import { formatDiagnostic } from '../format.ts';
import { getCliStyle, SYMBOLS } from '../style.ts';

export function validateCommand(context: CommandContext): number {
  const style = getCliStyle(context.io);
  let failed = false;

  for (const browser of context.config.browsers) {
    const builtManifest = buildManifest(context.config.manifest, browser, {
      mode: context.config.mode,
      command: 'validate',
      defaults: context.config.manifestDefaults,
      entrypoints: context.config.entrypoints,
      convertManifest: context.config.convertManifest,
      iconDir: context.config.publicDir,
    });
    const errors = builtManifest.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );

    for (const diagnostic of builtManifest.diagnostics) {
      context.io.stderr.write(`${formatDiagnostic(diagnostic, style)}\n`);
    }

    if (errors.length > 0) {
      failed = true;
    } else {
      context.io.stdout.write(
        `${style.green(SYMBOLS.success)} Validated ${style.cyan(
          browser.target,
        )} MV${browser.manifestVersion}\n`,
      );
    }
  }

  if (!failed) {
    context.io.stdout.write(
      `${style.green(SYMBOLS.success)} Configuration is valid.\n`,
    );
  }

  return failed ? 1 : 0;
}
