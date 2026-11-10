import type { Diagnostic } from '../core/errors.ts';
import type { CliStyle } from './style.ts';

export function formatDiagnostic(
  diagnostic: Diagnostic,
  style?: CliStyle,
): string {
  const severity =
    style === undefined
      ? diagnostic.severity
      : paintSeverity(style, diagnostic.severity);
  const code =
    style === undefined
      ? diagnostic.code
      : style.dim(diagnostic.code);
  const lines = [`${severity} [${code}]: ${diagnostic.message}`];
  const location = diagnostic.location;

  if (location !== undefined) {
    const position =
      location.line === undefined
        ? location.file
        : `${location.file}:${location.line}${
            location.column === undefined ? '' : `:${location.column}`
          }`;

    lines.push(`  at ${style === undefined ? position : style.dim(position)}`);
  }

  if (diagnostic.suggestion !== undefined) {
    const label = style === undefined ? 'suggestion:' : style.dim('suggestion:');

    lines.push(`  ${label} ${diagnostic.suggestion}`);
  }

  return lines.join('\n');
}

function paintSeverity(
  style: CliStyle,
  severity: Diagnostic['severity'],
): string {
  if (severity === 'error') {
    return style.red(severity);
  }

  if (severity === 'warning') {
    return style.yellow(severity);
  }

  return style.cyan(severity);
}
