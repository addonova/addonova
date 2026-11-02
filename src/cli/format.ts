import type { Diagnostic } from '../core/errors.ts';

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const lines = [
    `${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}`,
  ];
  const location = diagnostic.location;

  if (location !== undefined) {
    const position =
      location.line === undefined
        ? location.file
        : `${location.file}:${location.line}${
            location.column === undefined ? '' : `:${location.column}`
          }`;
    lines.push(`  at ${position}`);
  }

  if (diagnostic.suggestion !== undefined) {
    lines.push(`  suggestion: ${diagnostic.suggestion}`);
  }

  return lines.join('\n');
}
