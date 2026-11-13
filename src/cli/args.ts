import { AddonovaError } from '../core/errors.ts';
import { PACKAGE_MANAGERS, isPackageManager } from '../core/init.ts';
import type { PackageManager } from '../core/init.ts';
import {
  BROWSER_API_MODES,
  BROWSER_TARGETS,
  isBrowserApiMode,
  isBrowserTarget,
  isBuildMode,
  isManifestVersion,
  isSourcemapOption,
} from '../core/types.ts';
import type {
  BrowserApiMode,
  BuildMode,
  BrowserTarget,
  ManifestVersion,
  SourcemapOption,
} from '../core/types.ts';

export const COMMANDS = [
  'init',
  'build',
  'dev',
  'clean',
  'info',
  'validate',
  'pack',
  'zip',
  'analyze',
] as const;

export type CommandName = (typeof COMMANDS)[number];

export interface CliOptions {
  command?: CommandName;
  browsers: BrowserTarget[];
  manifestVersion?: ManifestVersion;
  mode?: BuildMode;
  configPath?: string;
  outdir?: string;
  minify?: boolean;
  sourcemap?: SourcemapOption;
  browserApi?: BrowserApiMode;
  directory?: string;
  template?: string;
  packageManager?: PackageManager;
  git?: boolean;
  force?: boolean;
  offline?: boolean;
  include: string[];
  exclude: string[];
  sources?: boolean;
  json: boolean;
  verbose: boolean;
  debug: boolean;
  noColor: boolean;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    browsers: [],
    include: [],
    exclude: [],
    json: false,
    verbose: false,
    debug: false,
    noColor: false,
    help: false,
    version: false,
  };

  let index = 0;

  while (index < argv.length) {
    const argument = argv[index];

    if (argument === undefined) {
      index += 1;
      continue;
    }

    if (argument === '--') {
      index += 1;

      while (index < argv.length) {
        const value = argv[index];

        if (value === undefined) {
          break;
        }

        assignPositional(options, value);
        index += 1;
      }

      break;
    }

    if (argument === '-h') {
      options.help = true;
      index += 1;
      continue;
    }

    if (argument === '-V') {
      options.version = true;
      index += 1;
      continue;
    }

    if (argument === '-t') {
      const parsed = readValue('template', undefined, argv, index);
      options.template = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    if (argument.startsWith('--')) {
      index = parseLongOption(options, argv, index);
      continue;
    }

    if (argument.startsWith('-')) {
      throw cliError(
        'ADDONOVA_CLI_UNKNOWN_OPTION',
        `Unknown option "${argument}".`,
        'Run "addonova --help" to list supported options.',
      );
    }

    assignPositional(options, argument);
    index += 1;
  }

  return options;
}

export function isCommandName(value: string): value is CommandName {
  return (COMMANDS as readonly string[]).includes(value);
}

function parseLongOption(
  options: CliOptions,
  argv: readonly string[],
  index: number,
): number {
  const argument = argv[index];

  if (argument === undefined) {
    return index + 1;
  }

  const body = argument.slice(2);
  const equalsIndex = body.indexOf('=');
  const name = equalsIndex === -1 ? body : body.slice(0, equalsIndex);
  const inlineValue = equalsIndex === -1 ? undefined : body.slice(equalsIndex + 1);

  switch (name) {
    case 'help':
      rejectInlineValue(name, inlineValue);
      options.help = true;
      return index + 1;

    case 'version':
      rejectInlineValue(name, inlineValue);
      options.version = true;
      return index + 1;

    case 'verbose': {
      options.verbose = parseBooleanValue(name, inlineValue, true);
      return index + 1;
    }

    case 'debug': {
      options.debug = parseBooleanValue(name, inlineValue, true);
      return index + 1;
    }

    case 'no-color':
      rejectInlineValue(name, inlineValue);
      options.noColor = true;
      return index + 1;

    case 'browser': {
      const parsed = readValue(name, inlineValue, argv, index);

      if (!isBrowserTarget(parsed.value)) {
        throw cliError(
          'ADDONOVA_CLI_INVALID_VALUE',
          `Unknown browser target "${parsed.value}".`,
          `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
        );
      }

      if (!options.browsers.includes(parsed.value)) {
        options.browsers.push(parsed.value);
      }

      return parsed.nextIndex;
    }

    case 'manifest-version': {
      const parsed = readValue(name, inlineValue, argv, index);
      const version = Number(parsed.value);

      if (!isManifestVersion(version)) {
        throw cliError(
          'ADDONOVA_CLI_INVALID_VALUE',
          `Invalid manifest version "${parsed.value}".`,
          'Use --manifest-version 2 or --manifest-version 3.',
        );
      }

      options.manifestVersion = version;
      return parsed.nextIndex;
    }

    case 'mode': {
      const parsed = readValue(name, inlineValue, argv, index);

      if (!isBuildMode(parsed.value)) {
        throw cliError(
          'ADDONOVA_CLI_INVALID_VALUE',
          `Invalid build mode "${parsed.value}".`,
          'Use --mode development or --mode production.',
        );
      }

      options.mode = parsed.value;
      return parsed.nextIndex;
    }

    case 'config': {
      const parsed = readValue(name, inlineValue, argv, index);
      options.configPath = parsed.value;
      return parsed.nextIndex;
    }

    case 'outdir': {
      const parsed = readValue(name, inlineValue, argv, index);
      options.outdir = parsed.value;
      return parsed.nextIndex;
    }

    case 'minify': {
      options.minify = parseBooleanValue(name, inlineValue, true);
      return index + 1;
    }

    case 'no-minify':
      rejectInlineValue(name, inlineValue);
      options.minify = false;
      return index + 1;

    case 'sourcemap': {
      if (inlineValue === undefined) {
        options.sourcemap = true;
      } else if (isSourcemapOption(inlineValue)) {
        options.sourcemap = inlineValue;
      } else {
        throw cliError(
          'ADDONOVA_CLI_INVALID_VALUE',
          `Invalid source map mode "${inlineValue}".`,
          'Use --sourcemap, --no-sourcemap, or --sourcemap=inline|external|linked|both|none.',
        );
      }

      return index + 1;
    }

    case 'no-sourcemap':
      rejectInlineValue(name, inlineValue);
      options.sourcemap = false;
      return index + 1;

    case 'browser-api': {
      const parsed = readValue(name, inlineValue, argv, index);

      if (!isBrowserApiMode(parsed.value)) {
        throw cliError(
          'ADDONOVA_CLI_INVALID_VALUE',
          `Invalid browser API mode "${parsed.value}".`,
          `Use one of: ${BROWSER_API_MODES.join(', ')}.`,
        );
      }

      options.browserApi = parsed.value;
      return parsed.nextIndex;
    }

    case 'template': {
      const parsed = readValue(name, inlineValue, argv, index);
      options.template = parsed.value;
      return parsed.nextIndex;
    }

    case 'pm': {
      const parsed = readValue(name, inlineValue, argv, index);

      if (!isPackageManager(parsed.value)) {
        throw cliError(
          'ADDONOVA_CLI_INVALID_VALUE',
          `Invalid package manager "${parsed.value}".`,
          `Use one of: ${PACKAGE_MANAGERS.join(', ')}.`,
        );
      }

      options.packageManager = parsed.value;
      return parsed.nextIndex;
    }

    case 'git':
      options.git = parseBooleanValue(name, inlineValue, true);
      return index + 1;

    case 'no-git':
      rejectInlineValue(name, inlineValue);
      options.git = false;
      return index + 1;

    case 'force':
      options.force = parseBooleanValue(name, inlineValue, true);
      return index + 1;

    case 'offline':
      options.offline = parseBooleanValue(name, inlineValue, true);
      return index + 1;

    case 'include': {
      const parsed = readValue(name, inlineValue, argv, index);
      options.include.push(parsed.value);
      return parsed.nextIndex;
    }

    case 'exclude': {
      const parsed = readValue(name, inlineValue, argv, index);
      options.exclude.push(parsed.value);
      return parsed.nextIndex;
    }

    case 'sources':
      options.sources = parseBooleanValue(name, inlineValue, true);
      return index + 1;

    case 'json':
      options.json = parseBooleanValue(name, inlineValue, true);
      return index + 1;

    default:
      throw cliError(
        'ADDONOVA_CLI_UNKNOWN_OPTION',
        `Unknown option "--${name}".`,
        'Run "addonova --help" to list supported options.',
      );
  }
}

function readValue(
  flag: string,
  inlineValue: string | undefined,
  argv: readonly string[],
  index: number,
): { value: string; nextIndex: number } {
  if (inlineValue !== undefined) {
    if (inlineValue === '') {
      throw missingValue(flag);
    }

    return { value: inlineValue, nextIndex: index + 1 };
  }

  const next = argv[index + 1];

  if (next === undefined || next.startsWith('-')) {
    throw missingValue(flag);
  }

  return { value: next, nextIndex: index + 2 };
}

function parseBooleanValue(
  flag: string,
  inlineValue: string | undefined,
  fallback: boolean,
): boolean {
  if (inlineValue === undefined) {
    return fallback;
  }

  if (inlineValue === 'true') {
    return true;
  }

  if (inlineValue === 'false') {
    return false;
  }

  throw cliError(
    'ADDONOVA_CLI_INVALID_VALUE',
    `Option "--${flag}" expects true or false.`,
    `Use --${flag} or --${flag}=false.`,
  );
}

function rejectInlineValue(flag: string, inlineValue: string | undefined): void {
  if (inlineValue !== undefined) {
    throw cliError(
      'ADDONOVA_CLI_INVALID_VALUE',
      `Option "--${flag}" does not take a value.`,
      `Use --${flag} without a value.`,
    );
  }
}

function assignPositional(options: CliOptions, value: string): void {
  if (options.command === undefined) {
    if (!isCommandName(value)) {
      throw cliError(
        'ADDONOVA_CLI_UNKNOWN_COMMAND',
        `Unknown command "${value}".`,
        `Use one of: ${COMMANDS.join(', ')}.`,
      );
    }

    options.command = value;
    return;
  }

  if (options.command === 'init' && options.directory === undefined && !isCommandName(value)) {
    options.directory = value;
    return;
  }

  throw cliError(
    'ADDONOVA_CLI_UNEXPECTED_ARGUMENT',
    `Unexpected argument "${value}".`,
    options.command === 'init'
      ? 'Pass at most one directory after "init".'
      : 'Pass exactly one command.',
  );
}

function missingValue(flag: string): AddonovaError {
  return cliError(
    'ADDONOVA_CLI_MISSING_VALUE',
    `Option "--${flag}" requires a value.`,
    `Pass a value such as --${flag}=value.`,
  );
}

function cliError(code: string, message: string, suggestion: string): AddonovaError {
  return new AddonovaError({
    code,
    severity: 'error',
    message,
    suggestion,
  });
}
