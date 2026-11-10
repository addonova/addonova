import { describe, expect, it } from '@guchho/test';

import {
  createCliStyle,
  formatBytes,
  formatDuration,
  isInteractive,
  resolveColorEnabled,
} from '../../src/cli/style.ts';

describe('cli style', () => {
  it('paints only when color is enabled', () => {
    const plain = createCliStyle(false);
    const colored = createCliStyle(true);

    expect(plain.green('ok')).toBe('ok');
    expect(plain.dim('path')).toBe('path');
    expect(colored.green('ok')).toContain('ok');
    expect(colored.green('ok')).toContain('\u001B[');
    expect(colored.paint('both', '\u001B[1m', '\u001B[90m')).toContain(
      '\u001B[1m\u001B[90mboth',
    );
  });

  it('detects color from explicit options, environment, and TTY', () => {
    const output = { write: () => true };

    expect(resolveColorEnabled({ stdout: { ...output, isTTY: true } })).toBe(
      true,
    );
    expect(resolveColorEnabled({ stdout: output })).toBe(false);
    expect(
      resolveColorEnabled({ stdout: output, env: { FORCE_COLOR: '1' } }),
    ).toBe(true);
    expect(
      resolveColorEnabled({ stdout: output, env: { FORCE_COLOR: '0' } }),
    ).toBe(false);
    expect(
      resolveColorEnabled({
        stdout: { ...output, isTTY: true },
        env: { NO_COLOR: '' },
      }),
    ).toBe(false);
    expect(
      resolveColorEnabled({
        stdout: { ...output, isTTY: true },
        env: { TERM: 'dumb' },
      }),
    ).toBe(false);
    expect(
      resolveColorEnabled({
        stdout: { ...output, isTTY: true },
        color: false,
      }),
    ).toBe(false);
    expect(
      resolveColorEnabled({ stdout: { ...output, isTTY: true } }, true),
    ).toBe(false);
  });

  it('reports interactivity from the writer', () => {
    expect(isInteractive({ stdout: { write: () => true, isTTY: true } })).toBe(
      true,
    );
    expect(isInteractive({ stdout: { write: () => true } })).toBe(false);
  });

  it('formats durations', () => {
    expect(formatDuration(12)).toBe('12 ms');
    expect(formatDuration(1_500)).toBe('1.500 s');
    expect(formatDuration(12_300)).toBe('12.3 s');
    expect(formatDuration(72_000)).toBe('72 s');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1_024)).toBe('1.0 KB');
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
    expect(formatBytes(1_610_612_736)).toBe('1.5 GB');
  });
});
