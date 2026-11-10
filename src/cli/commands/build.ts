import { buildProject } from '../../core/build.ts';
import type { ProjectBuildResult } from '../../core/build.ts';
import { AddonovaError } from '../../core/errors.ts';
import type { CommandContext } from '../command.ts';
import { formatDiagnostic } from '../format.ts';
import { createSpinner } from '../spinner.ts';
import { getCliStyle, isInteractive, SYMBOLS } from '../style.ts';
import { writeBuildSummary } from '../summary.ts';

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

  const style = getCliStyle(context.io);
  const targets = context.config.browsers
    .map((browser) => `${browser.target}-mv${browser.manifestVersion}`)
    .join(', ');
  const spinner = createSpinner(
    context.io.stdout,
    style,
    isInteractive(context.io),
    `Building ${targets} for ${context.config.mode}...`,
  );
  let reports: readonly ProjectBuildResult[] = [];

  spinner.start();

  try {
    reports = await buildProject(context.config);
  } finally {
    spinner.clear();
  }

  let failed = false;

  for (const report of reports) {
    const { result } = report;
    const manifestErrors = report.manifestDiagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    const success = result.success && manifestErrors.length === 0;
    const target = `${report.browser.target} MV${report.browser.manifestVersion}`;

    if (success) {
      writeBuildSummary(context.io, style, {
        label: `Built ${target}`,
        duration: result.duration,
        outdir: report.outdir,
        cwd: context.io.cwd,
      });
    } else {
      failed = true;
      context.io.stdout.write(
        `${style.red(SYMBOLS.error)} Build failed ${target} -> ${style.dim(
          report.outdir,
        )}\n`,
      );
    }

    for (const warning of [
      ...result.warnings,
      ...report.publicWarnings,
      ...report.manifestDiagnostics.filter(
        (diagnostic) => diagnostic.severity !== 'error',
      ),
    ]) {
      context.io.stderr.write(`${formatDiagnostic(warning, style)}\n`);
    }

    for (const error of [...result.errors, ...manifestErrors]) {
      failed = true;
      context.io.stderr.write(`${formatDiagnostic(error, style)}\n`);
    }
  }

  return failed ? 1 : 0;
}
