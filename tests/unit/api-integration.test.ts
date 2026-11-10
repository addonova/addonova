import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import {
  BROWSER_API_SUBPATHS,
  assertBrowserApiInstalled,
  getBrowserApiBundlerSettings,
} from '../../src/browser/api-integration.ts';
import type { ResolvedBrowserApiConfig } from '../../src/core/config.ts';
import { AddonovaError } from '../../src/core/errors.ts';

const tempDirs: string[] = [];

const externalConfig: ResolvedBrowserApiConfig = {
  mode: 'external',
  packageName: '@addonova/browser',
  define: true,
};

const bundleConfig: ResolvedBrowserApiConfig = {
  mode: 'bundle',
  packageName: '@addonova/browser',
  define: true,
};

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('browser API integration', () => {
  it('externalizes the root and every known subpath in external mode', () => {
    const settings = getBrowserApiBundlerSettings('chrome', externalConfig);

    expect(settings.alias).toEqual({});
    expect(settings.define).toEqual({});
    expect(settings.external).toEqual([
      '@addonova/browser',
      ...BROWSER_API_SUBPATHS.map(
        (subpath) => `@addonova/browser/${subpath}`,
      ),
    ]);
  });

  it('aliases the root to the target subpath in bundle mode', () => {
    const settings = getBrowserApiBundlerSettings('firefox', bundleConfig);

    expect(settings.alias).toEqual({
      '@addonova/browser': '@addonova/browser/firefox',
    });
    expect(settings.define).toEqual({
      __ADDONOVA_BROWSER__: '"firefox"',
    });
    expect(settings.external).toEqual([]);
  });

  it('omits the compile-time definition when disabled', () => {
    const settings = getBrowserApiBundlerSettings('edge', {
      ...bundleConfig,
      define: false,
    });

    expect(settings.alias).toEqual({
      '@addonova/browser': '@addonova/browser/edge',
    });
    expect(settings.define).toEqual({});
  });

  it('honors a custom package name', () => {
    const config: ResolvedBrowserApiConfig = {
      mode: 'bundle',
      packageName: '@example/browser-api',
      define: true,
    };
    const settings = getBrowserApiBundlerSettings('chromium', config);

    expect(settings.alias).toEqual({
      '@example/browser-api': '@example/browser-api/chromium',
    });
    expect(settings.define).toEqual({
      __ADDONOVA_BROWSER__: '"chromium"',
    });
  });

  it('does not require the package in external mode', () => {
    const root = createProject({});

    expect(() => assertBrowserApiInstalled(root, externalConfig)).not.toThrow();
  });

  it('reports a missing package in bundle mode', () => {
    const root = createProject({});

    try {
      assertBrowserApiInstalled(root, bundleConfig);
    } catch (error) {
      expect(error).toBeInstanceOf(AddonovaError);
      expect((error as AddonovaError).code).toBe(
        'ADDONOVA_BROWSER_API_NOT_FOUND',
      );
      return;
    }

    throw new Error('Expected a missing browser API package error.');
  });

  it('accepts a resolvable package in bundle mode', () => {
    const root = createProject({
      'node_modules/@addonova/browser/package.json': JSON.stringify({
        name: '@addonova/browser',
        version: '0.1.0',
        main: 'index.js',
      }),
      'node_modules/@addonova/browser/index.js': 'export const target = "root";\n',
    });

    expect(() => assertBrowserApiInstalled(root, bundleConfig)).not.toThrow();
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-api-unit-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
