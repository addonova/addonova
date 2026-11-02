import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { PackOptions } from 'guchho';
import { afterEach, describe, expect, it } from '@guchho/test';

import { resolveProjectConfig } from '../../src/core/config.js';
import { packProject } from '../../src/core/pack.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('pack options', () => {
  it('passes deterministic archive settings to the packer', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Pack Options', version: '1.0.0' },
  pack: {
    format: 'tar.gz',
    level: 9,
    overwrite: true,
    deterministic: true,
  },
};
`,
      'src/background.ts': 'export {};\n',
      'dist/chrome/manifest.json': '{}\n',
      'dist/chrome/background.js': 'console.log("built");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    let captured: PackOptions | undefined;

    const results = await packProject(config, {
      pack: async (options) => {
        captured = options;

        return {
          path: options.outFile,
          size: 42,
          warnings: ['skipped a symlink'],
        };
      },
    });

    expect(captured).toBeDefined();
    expect(captured).toMatchObject({
      outFile: path.join(root, 'dist', 'addonova-chrome-mv3-1.0.0.tar.gz'),
      format: 'tar.gz',
      level: 9,
      overwrite: true,
    });
    expect(captured?.date?.toISOString()).toBe('1980-01-01T00:00:00.000Z');
    expect(captured?.inputs).toEqual(
      expect.arrayContaining([
        path.join(root, 'dist/chrome/manifest.json'),
        path.join(root, 'dist/chrome/background.js'),
      ]),
    );
    expect(results[0]).toMatchObject({
      archivePath: path.join(root, 'dist', 'addonova-chrome-mv3-1.0.0.tar.gz'),
      size: 42,
      warnings: ['skipped a symlink'],
    });
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-pack-options-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
