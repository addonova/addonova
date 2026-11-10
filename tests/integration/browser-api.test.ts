import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { buildProject } from '../../src/core/build.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';
import { AddonovaError } from '../../src/core/errors.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('browser API build integration', () => {
  it('aliases the runtime package to the selected target in bundle mode', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome', 'firefox'],
  browserApi: 'bundle',
  manifest: { name: 'Browser API Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': `import { target } from '@addonova/browser';
console.log(target, __ADDONOVA_BROWSER__);
`,
      ...stubPackage(),
    });
    const config = await resolveProjectConfig({ cwd: root });
    const reports = await buildProject(config);

    expect(reports.map((report) => report.result.success)).toEqual([
      true,
      true,
    ]);

    const chrome = readOutput(root, 'chrome');
    const firefox = readOutput(root, 'firefox');

    expect(chrome).toContain('chrome-adapter');
    expect(chrome).toContain('chrome');
    expect(chrome).not.toContain('firefox-adapter');
    expect(chrome).not.toContain('__ADDONOVA_BROWSER__');

    expect(firefox).toContain('firefox-adapter');
    expect(firefox).toContain('firefox');
    expect(firefox).not.toContain('chrome-adapter');
    expect(firefox).not.toContain('__ADDONOVA_BROWSER__');
  }, 60_000);

  it('rejects bundle mode when the package is not installed', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  browserApi: 'bundle',
  manifest: { name: 'Missing Package Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    try {
      await buildProject(config);
    } catch (error) {
      expect(error).toBeInstanceOf(AddonovaError);
      expect((error as AddonovaError).code).toBe(
        'ADDONOVA_BROWSER_API_NOT_FOUND',
      );
      return;
    }

    throw new Error('Expected a missing browser API package error.');
  }, 30_000);
});

function stubPackage(): Readonly<Record<string, string>> {
  return {
    'node_modules/@addonova/browser/package.json': JSON.stringify({
      name: '@addonova/browser',
      version: '0.1.0',
      type: 'module',
      main: './index.js',
      exports: {
        '.': './index.js',
        './chrome': './chrome.js',
        './chromium': './chromium.js',
        './edge': './edge.js',
        './firefox': './firefox.js',
      },
    }),
    'node_modules/@addonova/browser/index.js':
      'export const target = "runtime-root";\n',
    'node_modules/@addonova/browser/chrome.js':
      'export const target = "chrome-adapter";\n',
    'node_modules/@addonova/browser/chromium.js':
      'export const target = "chromium-adapter";\n',
    'node_modules/@addonova/browser/edge.js':
      'export const target = "edge-adapter";\n',
    'node_modules/@addonova/browser/firefox.js':
      'export const target = "firefox-adapter";\n',
  };
}

function readOutput(root: string, target: string): string {
  return readFileSync(
    path.join(root, 'dist', target, 'background.js'),
    'utf8',
  );
}

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-browser-api-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
