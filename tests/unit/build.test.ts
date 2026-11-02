import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import {
  copyPublicDirectory,
  getEntrypointOutputName,
  getOutputDirectory,
  toBundlerEntrypoints,
} from '../../src/core/build.ts';
import type {
  ResolvedBrowser,
  ResolvedEntrypoint,
} from '../../src/core/config.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('build mapping', () => {
  it('maps entrypoints to explicit bundler output names', () => {
    const entrypoints: readonly ResolvedEntrypoint[] = [
      {
        name: 'background',
        input: path.resolve('src/background.ts'),
        kind: 'script',
      },
      {
        name: 'popup',
        input: path.resolve('src/popup/index.html'),
        kind: 'html',
      },
      {
        name: 'popup.html',
        input: path.resolve('src/other/index.html'),
        kind: 'html',
      },
      {
        name: 'theme',
        input: path.resolve('src/theme.css'),
        kind: 'style',
      },
    ];

    expect(getEntrypointOutputName(entrypoints[0] as ResolvedEntrypoint)).toBe(
      'background',
    );
    expect(getEntrypointOutputName(entrypoints[1] as ResolvedEntrypoint)).toBe(
      'popup.html',
    );
    expect(getEntrypointOutputName(entrypoints[2] as ResolvedEntrypoint)).toBe(
      'popup.html',
    );
    expect(toBundlerEntrypoints(entrypoints)).toEqual([
      {
        name: 'background',
        input: path.resolve('src/background.ts'),
        output: 'background',
        kind: 'script',
      },
      {
        name: 'popup',
        input: path.resolve('src/popup/index.html'),
        output: 'popup.html',
        kind: 'html',
      },
      {
        name: 'popup.html',
        input: path.resolve('src/other/index.html'),
        output: 'popup.html',
        kind: 'html',
      },
      {
        name: 'theme',
        input: path.resolve('src/theme.css'),
        output: 'theme',
        kind: 'style',
      },
    ]);
  });

  it('disambiguates output directories when multiple manifest versions exist', () => {
    const browsers: readonly ResolvedBrowser[] = [
      { target: 'chrome', manifestVersion: 2, manifestOverrides: {} },
      { target: 'chrome', manifestVersion: 3, manifestOverrides: {} },
      { target: 'firefox', manifestVersion: 3, manifestOverrides: {} },
    ];

    expect(getOutputDirectory('dist', browsers[0] as ResolvedBrowser, browsers)).toBe(
      path.join('dist', 'chrome-mv2'),
    );
    expect(getOutputDirectory('dist', browsers[1] as ResolvedBrowser, browsers)).toBe(
      path.join('dist', 'chrome-mv3'),
    );
    expect(getOutputDirectory('dist', browsers[2] as ResolvedBrowser, browsers)).toBe(
      path.join('dist', 'firefox'),
    );
  });

  it('copies public files without overwriting generated outputs', () => {
    const root = createProject({
      'public/icon.svg': '<svg></svg>\n',
      'public/nested/data.txt': 'public\n',
      'out/nested/data.txt': 'generated\n',
    });
    const publicDir = path.join(root, 'public');
    const outdir = path.join(root, 'out');

    const result = copyPublicDirectory(publicDir, outdir);

    expect(result.copied).toEqual(['icon.svg']);
    expect(existsSync(path.join(outdir, 'icon.svg'))).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      code: 'ADDONOVA_PUBLIC_SKIPPED',
      severity: 'warning',
    });
  });

  it('does nothing when the public directory is absent', () => {
    const root = createProject({});

    expect(copyPublicDirectory(path.join(root, 'public'), path.join(root, 'out')))
      .toEqual({
        copied: [],
        warnings: [],
      });
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-build-unit-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
