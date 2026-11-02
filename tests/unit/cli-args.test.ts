import { describe, expect, it } from '@guchho/test';

import { parseArgs } from '../../src/cli/args.js';
import { AddonovaError } from '../../src/core/errors.js';

describe('CLI argument parsing', () => {
  it('parses commands, targets, and build options', () => {
    const options = parseArgs([
      'build',
      '--browser',
      'chrome',
      '--browser=firefox',
      '--manifest-version',
      '2',
      '--mode',
      'development',
      '--config',
      'config/custom.ts',
      '--outdir',
      'output',
      '--no-minify',
      '--sourcemap=inline',
      '--verbose',
    ]);

    expect(options).toEqual({
      command: 'build',
      browsers: ['chrome', 'firefox'],
      manifestVersion: 2,
      mode: 'development',
      configPath: 'config/custom.ts',
      outdir: 'output',
      minify: false,
      sourcemap: 'inline',
      verbose: true,
      help: false,
      version: false,
    });
  });

  it('parses flags without values and the command separator', () => {
    const options = parseArgs(['--sourcemap', '--help', '--', 'info']);

    expect(options.command).toBe('info');
    expect(options.sourcemap).toBe(true);
    expect(options.help).toBe(true);
  });

  it('accepts all supported commands', () => {
    for (const command of ['build', 'dev', 'clean', 'info', 'validate', 'pack']) {
      expect(parseArgs([command]).command).toBe(command);
    }
  });

  it('rejects unknown commands and options', () => {
    expectCliError(['serve'], 'ADDONOVA_CLI_UNKNOWN_COMMAND');
    expectCliError(['build', '--wat'], 'ADDONOVA_CLI_UNKNOWN_OPTION');
  });

  it('rejects missing and invalid option values', () => {
    expectCliError(['build', '--browser'], 'ADDONOVA_CLI_MISSING_VALUE');
    expectCliError(
      ['build', '--browser', 'safari'],
      'ADDONOVA_CLI_INVALID_VALUE',
      'chrome, chromium, edge, firefox',
    );
    expectCliError(
      ['build', '--manifest-version', '4'],
      'ADDONOVA_CLI_INVALID_VALUE',
      '--manifest-version 2',
    );
    expectCliError(['build', '--mode', 'test'], 'ADDONOVA_CLI_INVALID_VALUE');
    expectCliError(['build', '--sourcemap=wat'], 'ADDONOVA_CLI_INVALID_VALUE');
    expectCliError(['build', '--verbose=yes'], 'ADDONOVA_CLI_INVALID_VALUE');
  });

  it('rejects multiple commands', () => {
    expectCliError(['build', 'info'], 'ADDONOVA_CLI_UNEXPECTED_ARGUMENT');
  });
});

function expectCliError(
  argv: readonly string[],
  code: string,
  suggestionPart?: string,
): void {
  try {
    parseArgs(argv);
  } catch (error) {
    expect(error).toBeInstanceOf(AddonovaError);
    const diagnostic = (error as AddonovaError).diagnostic;

    expect(diagnostic.code).toBe(code);

    if (suggestionPart !== undefined) {
      expect(diagnostic.suggestion).toContain(suggestionPart);
    }

    return;
  }

  throw new Error(`Expected parseArgs(${JSON.stringify(argv)}) to throw.`);
}
