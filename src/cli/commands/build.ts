import { buildProject } from '../../core/build.ts';
import { AddonovaError } from '../../core/errors.ts';
import type { CommandContext } from '../command.ts';
import { formatDiagnostic } from '../format.ts';

export async function buildCommand(context: CommandContext): Promise<number> {
  if (context.config.entrypoints.length === 0) {
    throw new AddonovaError({
      code: 'ADDONOVA_BUILD_NO_ENTRYPOINTS',
      severity: 'error',
      message: 'No entrypoints are configured.',
      suggestion: 'Add an entrypoints object to addonova.config.ts.',
      ...(context.config.configPath === null
        ? {}
        : { location: { file: context.config.configPath } }),
    });
  }

  const reports = await buildProject(context.config);
  let failed = false;

  for (const report of reports) {
    const { result } = report;
    const manifestErrors = report.manifestDiagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    const success = result.success && manifestErrors.length === 0;
    const status = success ? 'Built' : 'Build failed';

    context.io.stdout.write(
      `${status} ${report.browser.target} MV${report.browser.manifestVersion} -> ${
        report.outdir
      } (${result.duration}ms, ${result.outputs.length} outputs)\n`,
    );

    for (const warning of [
      ...result.warnings,
      ...report.publicWarnings,
      ...report.manifestDiagnostics.filter(
        (diagnostic) => diagnostic.severity !== 'error',
      ),
    ]) {
      context.io.stderr.write(`${formatDiagnostic(warning)}\n`);
    }

    for (const error of [...result.errors, ...manifestErrors]) {
      failed = true;
      context.io.stderr.write(`${formatDiagnostic(error)}\n`);
    }
  }

  return failed ? 1 : 0;
}
