import type { CliIo } from './command.ts';

export interface CliStyle {
  readonly enabled: boolean;
  paint(text: string, ...codes: string[]): string;
  bold(text: string): string;
  dim(text: string): string;
  gray(text: string): string;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  blue(text: string): string;
  magenta(text: string): string;
  cyan(text: string): string;
}

export const SYMBOLS = {
  info: 'ℹ',
  success: '✔',
  error: '✖',
  warning: '⚠',
  branch: '├─',
  lastBranch: '└─',
  total: 'Σ',
} as const;

const ANSI = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  red: '\u001B[31m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  blue: '\u001B[34m',
  magenta: '\u001B[35m',
  cyan: '\u001B[36m',
  gray: '\u001B[90m',
} as const;

export function createCliStyle(enabled: boolean): CliStyle {
  const paint = (text: string, ...codes: string[]): string =>
    enabled && codes.length > 0
      ? `${codes.join('')}${text}${ANSI.reset}`
      : text;
  const role = (code: string) => (text: string) => paint(text, code);

  return {
    enabled,
    paint,
    bold: role(ANSI.bold),
    dim: role(ANSI.dim),
    gray: role(ANSI.gray),
    red: role(ANSI.red),
    green: role(ANSI.green),
    yellow: role(ANSI.yellow),
    blue: role(ANSI.blue),
    magenta: role(ANSI.magenta),
    cyan: role(ANSI.cyan),
  };
}

export function getCliStyle(io: Pick<CliIo, 'color'>): CliStyle {
  return createCliStyle(io.color === true);
}

export function resolveColorEnabled(
  io: Pick<CliIo, 'stdout' | 'color' | 'env'>,
  disabled = false,
): boolean {
  if (disabled) {
    return false;
  }

  if (io.color !== undefined) {
    return io.color;
  }

  const env = io.env ?? process.env;

  if (env.NO_COLOR !== undefined) {
    return false;
  }

  if (env.FORCE_COLOR !== undefined) {
    return (
      env.FORCE_COLOR === '' ||
      env.FORCE_COLOR === '1' ||
      env.FORCE_COLOR === 'true' ||
      env.FORCE_COLOR === '2' ||
      env.FORCE_COLOR === '3'
    );
  }

  if (env.TERM === 'dumb') {
    return false;
  }

  return io.stdout.isTTY === true;
}

export function isInteractive(io: Pick<CliIo, 'stdout'>): boolean {
  return io.stdout.isTTY === true;
}

export function formatDuration(duration: number): string {
  if (duration < 1_000) {
    return `${Math.round(duration)} ms`;
  }

  if (duration < 10_000) {
    return `${(duration / 1_000).toFixed(3)} s`;
  }

  if (duration < 60_000) {
    return `${(duration / 1_000).toFixed(1)} s`;
  }

  return `${Math.round(duration / 1_000)} s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }

  if (bytes < 1_048_576) {
    return `${(bytes / 1_024).toFixed(1)} KB`;
  }

  if (bytes < 1_073_741_824) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }

  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}
