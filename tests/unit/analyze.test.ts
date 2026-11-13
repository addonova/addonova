import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import type {
  BundlerAdapter,
  BundlerBuildInput,
  BundlerBuildResult,
} from '../../src/bundler/adapter.ts';
import { analyzeProject, extractDependencies } from '../../src/core/analyze.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('project analysis', () => {
  it('builds in memory and reports outputs, inputs, dependencies, and sizes', async () => {
    const root = createProject();
    const config = await resolveProjectConfig({ cwd: root });
    let captured: BundlerBuildInput | undefined;
    let disposed = false;
    const adapter: BundlerAdapter = {
      name: 'test',
      version: '1.0.0',
      async build(input) {
        captured = input;

        return {
          success: true,
          duration: 1,
          outputs: [
            { path: 'background.js', size: 120 },
            { path: 'manifest.json', size: 30 },
          ],
          inputs: [{ path: 'src/background.ts', bytes: 10 }],
          errors: [],
          warnings: [],
          metafile: {
            inputs: {},
            outputs: {
              'background.js': {
                bytes: 120,
                inputs: [{ path: 'src/background.ts', bytesInOutput: 10 }],
                imports: [
                  { path: 'lodash', kind: 'import-statement' },
                  { path: 'react', kind: 'import-statement' },
                ],
                exports: [],
              },
            },
          },
        } satisfies BundlerBuildResult;
      },
      async dispose() {
        disposed = true;
      },
    };

    const analyses = await analyzeProject(config, { adapter });

    expect(captured?.write).toBe(false);
    expect(disposed).toBe(true);
    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.totalBytes).toBe(150);
    expect(analyses[0]?.dependencies).toEqual(['lodash', 'react']);
    expect(analyses[0]?.outputs).toHaveLength(2);
    expect(analyses[0]?.inputs).toEqual([
      { path: 'src/background.ts', bytes: 10 },
    ]);
  });

  it('wraps build failures in analysis diagnostics', async () => {
    const root = createProject();
    const config = await resolveProjectConfig({ cwd: root });
    const adapter: BundlerAdapter = {
      name: 'test',
      version: '1.0.0',
      async build() {
        return {
          success: false,
          duration: 1,
          outputs: [],
          inputs: [],
          errors: [
            {
              code: 'ADDONOVA_BUNDLER_ERROR',
              severity: 'error',
              message: 'Broken source',
              location: { file: path.join(root, 'src/background.ts') },
            },
          ],
          warnings: [],
        };
      },
    };

    await expect(analyzeProject(config, { adapter })).rejects.toHaveProperty(
      'code',
      'ADDONOVA_ANALYZE_FAILED',
    );
  });

  it('extracts sorted dependencies from a metafile', () => {
    expect(
      extractDependencies({
        outputs: {
          'a.js': {
            imports: [
              { path: 'lodash', kind: 'import-statement' },
              { path: './b.js', kind: 'import-statement' },
            ],
          },
          'b.js': {
            imports: [
              { path: 'lodash', kind: 'import-statement' },
              { path: 'react', kind: 'import-statement' },
            ],
          },
        },
      }),
    ).toEqual(['./b.js', 'lodash', 'react']);
    expect(extractDependencies(undefined)).toEqual([]);
    expect(extractDependencies({ outputs: 'nope' })).toEqual([]);
    expect(extractDependencies({ outputs: { 'a.js': { imports: [{}] } } })).toEqual(
      [],
    );
  });
});

function createProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-analyze-'));
  tempDirs.push(root);

  const files: Readonly<Record<string, string>> = {
    'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Analyze Demo', version: '1.0.0' },
};
`,
    'src/background.ts': 'export {};\n',
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
