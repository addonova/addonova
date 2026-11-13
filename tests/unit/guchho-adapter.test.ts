import { describe, expect, it } from '@guchho/test';

import {
  guchhoAdapter,
  toGuchhoOptions,
} from '../../src/bundler/guchho.ts';
import { AddonovaError } from '../../src/core/errors.ts';

const baseInput = {
  root: 'C:\\project',
  outdir: 'C:\\project\\dist\\chrome',
  mode: 'production' as const,
  entrypoints: [
    {
      name: 'background',
      input: 'C:\\project\\src\\background.ts',
      output: 'background',
      kind: 'script' as const,
    },
  ],
};

describe('guchho adapter', () => {
  it('reports the installed Guchho version', () => {
    expect(guchhoAdapter.name).toBe('guchho');
    expect(guchhoAdapter.version).toBe('1.0.9');
  });

  it('maps Addonova build options to Guchho defaults', () => {
    const options = toGuchhoOptions(baseInput);

    expect(options).toMatchObject({
      absWorkingDir: baseInput.root,
      outdir: baseInput.outdir,
      entrypoints: [
        {
          in: 'C:\\project\\src\\background.ts',
          out: 'background',
        },
      ],
      format: 'iife',
      platform: 'browser',
      bundle: true,
      splitting: false,
      treeShaking: true,
      minify: true,
      minifyHtml: true,
      metafile: true,
      allowOverwrite: true,
      external: [],
    });
  });

  it('preserves explicit build settings and adds externals', () => {
    const options = toGuchhoOptions({
      ...baseInput,
      mode: 'development',
      format: 'esm',
      bundle: false,
      splitting: true,
      treeShaking: false,
      minify: false,
      minifyHtml: false,
      metafile: false,
      sourcemap: 'inline',
      target: ['chrome120', 'firefox120'],
      define: { DEBUG: 'true' },
      alias: { '@': 'C:\\project\\src' },
      external: ['lodash'],
      loader: { '.txt': 'text' },
    });

    expect(options).toMatchObject({
      format: 'esm',
      bundle: false,
      splitting: true,
      treeShaking: false,
      minify: false,
      minifyHtml: false,
      metafile: false,
      sourcemap: 'inline',
      target: ['chrome120', 'firefox120'],
      define: { DEBUG: 'true' },
      alias: { '@': 'C:\\project\\src' },
      external: ['lodash'],
      loader: { '.txt': 'text' },
    });
  });

  it('forwards the in-memory write flag', () => {
    expect(toGuchhoOptions({ ...baseInput, write: false }).write).toBe(false);
    expect(toGuchhoOptions(baseInput).write).toBeUndefined();
  });

  it('rejects builds without entrypoints', async () => {
    await expect(
      guchhoAdapter.build({
        ...baseInput,
        entrypoints: [],
      }),
    ).rejects.toMatchObject({
      code: 'ADDONOVA_BUNDLER_NO_ENTRYPOINTS',
    });
  });

  it('rejects duplicate output names', async () => {
    await expect(
      guchhoAdapter.build({
        ...baseInput,
        entrypoints: [
          ...baseInput.entrypoints,
          {
            name: 'background-two',
            input: 'C:\\project\\src\\background-two.ts',
            output: 'Background',
            kind: 'script',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AddonovaError);
  });
});
