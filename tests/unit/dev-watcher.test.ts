import path from 'node:path';

import { describe, expect, it } from '@guchho/test';

import { classifyChange } from '../../src/dev/watcher.ts';
import type { ResolvedConfig } from '../../src/core/config.ts';

const root = path.resolve('C:\\project');

const config: ResolvedConfig = {
  root,
  configPath: path.join(root, 'addonova.config.ts'),
  entrypoints: [
    {
      name: 'background',
      input: path.join(root, 'src/background.ts'),
      kind: 'script',
    },
    {
      name: 'popup',
      input: path.join(root, 'src/popup/index.html'),
      kind: 'html',
    },
  ],
  browsers: [{ target: 'chrome', manifestVersion: 3, manifestOverrides: {} }],
  manifest: { name: 'Dev Demo', version: '1.0.0' },
  outdir: path.join(root, 'dist'),
  publicDir: path.join(root, 'public'),
  mode: 'development',
  minify: false,
  sourcemap: true,
  pack: {
    outFile: null,
    format: 'zip',
    overwrite: false,
    deterministic: false,
  },
};

describe('dev change classification', () => {
  it('classifies config and manifest changes', () => {
    expect(classifyChange(config.configPath as string, config)).toBe('config');
    expect(classifyChange(path.join(root, 'addonova.config.js'), config)).toBe(
      'config',
    );
    expect(classifyChange(path.join(root, 'manifest.json'), config)).toBe(
      'manifest',
    );
  });

  it('classifies entrypoints, sources, assets, and unknown files', () => {
    expect(
      classifyChange(path.join(root, 'src/background.ts'), config),
    ).toBe('entrypoint');
    expect(classifyChange(path.join(root, 'src/other.ts'), config)).toBe(
      'source',
    );
    expect(classifyChange(path.join(root, 'src/popup/style.css'), config)).toBe(
      'source',
    );
    expect(classifyChange(path.join(root, 'public/icon.svg'), config)).toBe(
      'asset',
    );
    expect(classifyChange(path.join(root, 'src/logo.png'), config)).toBe(
      'asset',
    );
    expect(classifyChange(path.join(root, 'README.md'), config)).toBe(
      'unknown',
    );
  });

  it('compares paths case-insensitively on Windows', () => {
    if (process.platform !== 'win32') {
      return;
    }

    expect(
      classifyChange(path.join(root, 'SRC/BACKGROUND.TS'), config),
    ).toBe('entrypoint');
  });
});
