import { describe, expect, it } from '@guchho/test';

import {
  collectDoctorReport,
} from '../../src/core/doctor.ts';
import type { DoctorOptions } from '../../src/core/doctor.ts';
import type { ResolvedConfig } from '../../src/core/config.ts';

describe('doctor environment diagnostics', () => {
  it('reports a healthy environment', async () => {
    const report = await collectDoctorReport(
      createOptions({
        config: createConfig(),
      }),
    );

    expect(report.ok).toBe(true);
    expect(report.summary).toEqual({
      passed: 7,
      warnings: 0,
      failures: 0,
      skipped: 0,
    });
    expect(statusOf(report, 'node')).toBe('ok');
    expect(statusOf(report, 'guchho')).toBe('ok');
    expect(statusOf(report, 'browser:chrome')).toBe('ok');
    expect(statusOf(report, 'browser-api')).toBe('ok');
  });

  it('fails on unsupported Node.js and a missing bundled browser API', async () => {
    const report = await collectDoctorReport(
      createOptions({
        nodeVersion: '18.19.0',
        guchhoVersion: null,
        browserApiInstalled: false,
      }),
    );

    expect(report.ok).toBe(false);
    expect(report.summary.failures).toBe(3);
    expect(checkOf(report, 'node')).toMatchObject({
      status: 'fail',
      message: 'Node.js 18.19.0 does not satisfy >=20.',
    });
    expect(checkOf(report, 'guchho').status).toBe('fail');
    expect(checkOf(report, 'browser-api').status).toBe('fail');
  });

  it('warns about defaults, missing entrypoints, and missing browsers', async () => {
    const report = await collectDoctorReport(
      createOptions({
        config: createConfig({
          configPath: null,
          entrypoints: [],
          browsers: [
            { target: 'chrome', manifestVersion: 3, manifestOverrides: {} },
            { target: 'firefox', manifestVersion: 3, manifestOverrides: {} },
          ],
        }),
        findBrowser: (target) => (target === 'chrome' ? '/bin/chrome' : null),
      }),
    );

    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      warnings: 3,
      failures: 0,
    });
    expect(checkOf(report, 'config').status).toBe('warn');
    expect(checkOf(report, 'entrypoints').status).toBe('warn');
    expect(checkOf(report, 'browser:firefox')).toMatchObject({
      status: 'warn',
      suggestion:
        'Install firefox or set webExt.binaries.firefox in your configuration.',
    });
  });

  it('skips the browser API check in external mode', async () => {
    const report = await collectDoctorReport(
      createOptions({
        config: createConfig({
          browserApi: {
            mode: 'external',
            packageName: '@addonova/browser',
            define: true,
          },
        }),
      }),
    );

    expect(checkOf(report, 'browser-api')).toMatchObject({
      status: 'skip',
      message: '@addonova/browser is external.',
    });
    expect(report.summary.skipped).toBe(1);
  });
});

function createOptions(
  overrides: Partial<DoctorOptions> = {},
): DoctorOptions {
  return {
    config: createConfig(),
    nodeVersion: '22.11.0',
    nodeRange: '>=20',
    packageManager: 'npm',
    guchhoVersion: '1.0.9',
    findBrowser: () => '/usr/bin/chrome',
    browserApiInstalled: true,
    ...overrides,
  };
}

function createConfig(
  overrides: Partial<ResolvedConfig> = {},
): ResolvedConfig {
  return {
    root: '/project',
    configPath: '/project/addonova.config.ts',
    entrypoints: [
      {
        name: 'background',
        input: '/project/src/background.ts',
        kind: 'script',
      },
    ],
    browsers: [
      {
        target: 'chrome',
        manifestVersion: 3,
        manifestOverrides: {},
      },
    ],
    manifest: {},
    outdir: '/project/dist',
    publicDir: '/project/public',
    mode: 'production',
    minify: true,
    sourcemap: false,
    browserApi: {
      mode: 'bundle',
      packageName: '@addonova/browser',
      define: true,
    },
    webExt: {
      disabled: false,
      binaries: {},
      chromiumArgs: [],
      firefoxArgs: [],
      chromiumProfile: null,
      firefoxProfile: null,
      keepProfileChanges: false,
      startUrls: [],
    },
    plugins: [],
    pack: {
      outFile: null,
      format: 'zip',
      overwrite: false,
      deterministic: true,
      include: [],
      exclude: [],
      sources: null,
    },
    ...overrides,
  };
}

function checkOf(
  report: Awaited<ReturnType<typeof collectDoctorReport>>,
  id: string,
): (typeof report.checks)[number] {
  const check = report.checks.find((candidate) => candidate.id === id);

  if (check === undefined) {
    throw new Error(`Missing doctor check "${id}".`);
  }

  return check;
}

function statusOf(
  report: Awaited<ReturnType<typeof collectDoctorReport>>,
  id: string,
): string {
  return checkOf(report, id).status;
}
