import { collectDoctorReport } from '../../core/doctor.ts';
import type { DoctorStatus } from '../../core/doctor.ts';
import type { CommandContext } from '../command.ts';
import { getCliStyle, SYMBOLS } from '../style.ts';
import type { CliStyle } from '../style.ts';

export async function doctorCommand(context: CommandContext): Promise<number> {
  const report = await collectDoctorReport({
    config: context.config,
    ...(context.io.env === undefined ? {} : { env: context.io.env }),
  });

  if (context.options.json) {
    context.io.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }

  const style = getCliStyle(context.io);

  for (const check of report.checks) {
    context.io.stdout.write(
      `${statusSymbol(style, check.status)} ${style.bold(
        check.label,
      )}: ${check.message}\n`,
    );

    if (check.suggestion !== undefined) {
      context.io.stdout.write(
        `  ${style.dim('suggestion:')} ${check.suggestion}\n`,
      );
    }
  }

  const { passed, warnings, failures, skipped } = report.summary;
  const parts = [`${passed} passed`];

  if (warnings > 0) {
    parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  }

  if (failures > 0) {
    parts.push(`${failures} failure${failures === 1 ? '' : 's'}`);
  }

  if (skipped > 0) {
    parts.push(`${skipped} skipped`);
  }

  const summary = parts.join(', ');

  if (!report.ok) {
    context.io.stdout.write(
      `${style.red(SYMBOLS.error)} Doctor found problems: ${summary}.\n`,
    );

    return 1;
  }

  context.io.stdout.write(
    `${
      warnings > 0
        ? style.yellow(SYMBOLS.warning)
        : style.green(SYMBOLS.success)
    } ${warnings > 0 ? 'Environment needs attention' : 'Environment looks healthy'}: ${summary}.\n`,
  );

  return 0;
}

function statusSymbol(style: CliStyle, status: DoctorStatus): string {
  if (status === 'ok') {
    return style.green(SYMBOLS.success);
  }

  if (status === 'warn') {
    return style.yellow(SYMBOLS.warning);
  }

  if (status === 'fail') {
    return style.red(SYMBOLS.error);
  }

  return style.gray(SYMBOLS.info);
}
