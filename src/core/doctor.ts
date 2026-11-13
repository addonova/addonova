import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { isBrowserApiInstalled } from '../browser/api-integration.ts';
import { tryFindBrowserBinary } from '../launcher/browser-paths.ts';
import type { ResolvedConfig } from './config.ts';
import { detectPackageManager } from './init.ts';
import type { PackageManager } from './init.ts';
import type { BrowserTarget } from './types.ts';
import { ADDONOVA_NODE_RANGE, ADDONOVA_VERSION } from './version.ts';

export const DOCTOR_STATUSES = ['ok', 'warn', 'fail', 'skip'] as const;

export type DoctorStatus = (typeof DOCTOR_STATUSES)[number];

export interface DoctorCheck {
  readonly id: string;
  readonly label: string;
  readonly status: DoctorStatus;
  readonly message: string;
  readonly suggestion?: string;
}

export interface DoctorSummary {
  readonly passed: number;
  readonly warnings: number;
  readonly failures: number;
  readonly skipped: number;
}

export interface DoctorReport {
  readonly ok: boolean;
  readonly checks: readonly DoctorCheck[];
  readonly summary: DoctorSummary;
}

export interface DoctorOptions {
  readonly config: ResolvedConfig;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
  readonly nodeVersion?: string;
  readonly nodeRange?: string;
  readonly addonovaVersion?: string;
  readonly packageManager?: PackageManager;
  readonly guchhoVersion?: string | null;
  readonly findBrowser?: (target: BrowserTarget) => string | null;
  readonly browserApiInstalled?: boolean;
}

export async function collectDoctorReport(
  options: DoctorOptions,
): Promise<DoctorReport> {
  const { config } = options;
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const nodeRange = options.nodeRange ?? ADDONOVA_NODE_RANGE;
  const packageManager =
    options.packageManager ??
    (await detectPackageManager({
      cwd: config.root,
      ...(options.env === undefined ? {} : { env: options.env }),
    }));
  const guchhoVersion =
    options.guchhoVersion === undefined
      ? readPackageVersion(config.root, 'guchho')
      : options.guchhoVersion;
  const findBrowser =
    options.findBrowser ??
    ((target: BrowserTarget): string | null =>
      tryFindBrowserBinary({
        target,
        binaries: config.webExt.binaries,
        root: config.root,
        platform,
        ...(options.env === undefined ? {} : { env: options.env }),
      }));
  const browserApiInstalled =
    options.browserApiInstalled ??
    isBrowserApiInstalled(config.root, config.browserApi);

  const checks: DoctorCheck[] = [
    createNodeCheck(nodeVersion, nodeRange),
    {
      id: 'runtime',
      label: 'Runtime',
      status: 'ok',
      message: `${platform} ${arch}, Addonova ${
        options.addonovaVersion ?? ADDONOVA_VERSION
      }, ${packageManager}`,
    },
    createGuchhoCheck(guchhoVersion),
    createConfigCheck(config),
    createEntrypointsCheck(config),
    ...config.browsers.map(
      (browser): DoctorCheck =>
        createBrowserCheck(browser.target, findBrowser(browser.target)),
    ),
    createBrowserApiCheck(config, browserApiInstalled),
  ];

  return createReport(checks);
}

function createNodeCheck(nodeVersion: string, range: string): DoctorCheck {
  const current = parseVersion(nodeVersion);
  const minimum = parseMinimumVersion(range);

  if (current === null) {
    return {
      id: 'node',
      label: 'Node.js',
      status: 'warn',
      message: `Could not parse the Node.js version "${nodeVersion}".`,
      suggestion: `Use Node.js ${range} and re-run addonova doctor.`,
    };
  }

  if (minimum === null) {
    return {
      id: 'node',
      label: 'Node.js',
      status: 'skip',
      message: `Could not interpret the required Node.js range "${range}".`,
    };
  }

  if (compareVersions(current, minimum) < 0) {
    return {
      id: 'node',
      label: 'Node.js',
      status: 'fail',
      message: `Node.js ${nodeVersion} does not satisfy ${range}.`,
      suggestion: `Upgrade Node.js to ${range} or newer.`,
    };
  }

  return {
    id: 'node',
    label: 'Node.js',
    status: 'ok',
    message: `v${nodeVersion} satisfies ${range}`,
  };
}

function createGuchhoCheck(version: string | null): DoctorCheck {
  if (version === null) {
    return {
      id: 'guchho',
      label: 'Guchho',
      status: 'fail',
      message: 'The Guchho bundler could not be resolved from the project.',
      suggestion:
        'Install dependencies with your package manager so "guchho" is available.',
    };
  }

  return {
    id: 'guchho',
    label: 'Guchho',
    status: 'ok',
    message: `v${version}`,
  };
}

function createConfigCheck(config: ResolvedConfig): DoctorCheck {
  if (config.configPath === null) {
    return {
      id: 'config',
      label: 'Config',
      status: 'warn',
      message: `No configuration file found; using defaults from ${config.root}.`,
      suggestion:
        'Create addonova.config.ts or pass --config to use an explicit configuration.',
    };
  }

  return {
    id: 'config',
    label: 'Config',
    status: 'ok',
    message: config.configPath,
  };
}

function createEntrypointsCheck(config: ResolvedConfig): DoctorCheck {
  if (config.entrypoints.length === 0) {
    return {
      id: 'entrypoints',
      label: 'Entrypoints',
      status: 'warn',
      message: 'No entrypoints were discovered or configured.',
      suggestion:
        'Add files under src/entrypoints/ or configure entrypoints in addonova.config.ts.',
    };
  }

  return {
    id: 'entrypoints',
    label: 'Entrypoints',
    status: 'ok',
    message: `${config.entrypoints.length} configured`,
  };
}

function createBrowserCheck(
  target: BrowserTarget,
  binary: string | null,
): DoctorCheck {
  if (binary === null) {
    return {
      id: `browser:${target}`,
      label: `Browser ${target}`,
      status: 'warn',
      message: 'No browser binary was found.',
      suggestion: `Install ${target} or set webExt.binaries.${target} in your configuration.`,
    };
  }

  return {
    id: `browser:${target}`,
    label: `Browser ${target}`,
    status: 'ok',
    message: binary,
  };
}

function createBrowserApiCheck(
  config: ResolvedConfig,
  installed: boolean,
): DoctorCheck {
  const packageName = config.browserApi.packageName;

  if (config.browserApi.mode === 'external') {
    return {
      id: 'browser-api',
      label: 'Browser API',
      status: 'skip',
      message: `${packageName} is external.`,
    };
  }

  if (!installed) {
    return {
      id: 'browser-api',
      label: 'Browser API',
      status: 'fail',
      message: `${packageName} could not be resolved from ${config.root}.`,
      suggestion: `Install ${packageName} or set browserApi to "external".`,
    };
  }

  return {
    id: 'browser-api',
    label: 'Browser API',
    status: 'ok',
    message: `${packageName} is installed for bundle mode.`,
  };
}

function createReport(checks: readonly DoctorCheck[]): DoctorReport {
  let passed = 0;
  let warnings = 0;
  let failures = 0;
  let skipped = 0;

  for (const check of checks) {
    if (check.status === 'ok') {
      passed += 1;
    } else if (check.status === 'warn') {
      warnings += 1;
    } else if (check.status === 'fail') {
      failures += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    ok: failures === 0,
    checks,
    summary: { passed, warnings, failures, skipped },
  };
}

function readPackageVersion(root: string, packageName: string): string | null {
  try {
    const requireFromProject = createRequire(path.join(root, 'package.json'));
    const packagePath = requireFromProject.resolve(`${packageName}/package.json`);
    const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      version?: unknown;
    };

    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

function parseVersion(value: string): readonly [number, number, number] | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value.trim());

  if (match === null) {
    return null;
  }

  return [
    Number(match[1]),
    Number(match[2] ?? '0'),
    Number(match[3] ?? '0'),
  ];
}

function parseMinimumVersion(
  range: string,
): readonly [number, number, number] | null {
  const match = />=\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range);

  if (match === null) {
    return null;
  }

  return [
    Number(match[1]),
    Number(match[2] ?? '0'),
    Number(match[3] ?? '0'),
  ];
}

function compareVersions(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}
