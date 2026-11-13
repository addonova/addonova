import { describe, expect, it } from '@guchho/test';

import { parseArgs } from '../../src/cli/args.ts';
import { AddonovaError } from '../../src/core/errors.ts';

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
      debug: false,
      noColor: false,
      help: false,
      version: false,
    });
  });

  it('parses the no-color flag', () => {
    expect(parseArgs(['build', '--no-color']).noColor).toBe(true);
    expectCliError(['build', '--no-color=true'], 'ADDONOVA_CLI_INVALID_VALUE');
  });

  it('parses the debug flag', () => {
    expect(parseArgs(['dev', '--debug']).debug).toBe(true);
    expect(parseArgs(['dev', '--debug=false']).debug).toBe(false);
    expectCliError(['dev', '--debug=yes'], 'ADDONOVA_CLI_INVALID_VALUE');
  });

  it('parses the browser API mode', () => {
    expect(parseArgs(['build', '--browser-api', 'bundle']).browserApi).toBe(
      'bundle',
    );
    expect(parseArgs(['build', '--browser-api=external']).browserApi).toBe(
      'external',
    );
  });

  it('parses flags without values and the command separator', () => {
    const options = parseArgs(['--sourcemap', '--help', '--', 'info']);

    expect(options.command).toBe('info');
    expect(options.sourcemap).toBe(true);
    expect(options.help).toBe(true);
  });

  it('accepts all supported commands', () => {
    for (const command of [
      'init',
      'build',
      'dev',
      'clean',
      'info',
      'validate',
      'pack',
    ]) {
      expect(parseArgs([command]).command).toBe(command);
    }
  });

  it('parses init positionals and flags', () => {
    const options = parseArgs([
      'init',
      'demo-extension',
      '-t',
      'react',
      '--pm',
      'pnpm',
      '--no-git',
      '--force',
      '--offline',
    ]);

    expect(options).toEqual({
      command: 'init',
      directory: 'demo-extension',
      template: 'react',
      packageManager: 'pnpm',
      git: false,
      force: true,
      offline: true,
      browsers: [],
      verbose: false,
      debug: false,
      noColor: false,
      help: false,
      version: false,
    });
  });

  it('parses init defaults, template long form, and git flags', () => {
    const options = parseArgs(['init', '--template=vanilla']);

    expect(options.command).toBe('init');
    expect(options.directory).toBeUndefined();
    expect(options.template).toBe('vanilla');
    expect(parseArgs(['init', '--git']).git).toBe(true);
    expect(parseArgs(['init', '--no-git']).git).toBe(false);
  });

  it('rejects extra positionals and invalid init values', () => {
    expectCliError(['init', 'one', 'two'], 'ADDONOVA_CLI_UNEXPECTED_ARGUMENT');
    expectCliError(['build', 'output'], 'ADDONOVA_CLI_UNEXPECTED_ARGUMENT');
    expectCliError(
      ['init', '--pm', 'cargo'],
      'ADDONOVA_CLI_INVALID_VALUE',
      'npm, pnpm, yarn, bun',
    );
    expectCliError(['init', '--template'], 'ADDONOVA_CLI_MISSING_VALUE');
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
    expectCliError(
      ['build', '--browser-api', 'inline'],
      'ADDONOVA_CLI_INVALID_VALUE',
      'external, bundle',
    );
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
