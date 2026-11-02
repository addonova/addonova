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

import { buildProject } from '../../src/core/build.ts';
import { cleanProject } from '../../src/core/clean.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('project clean', () => {
  it('removes generated output without deleting sources', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Clean Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'console.log("clean-me");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await buildProject(config);

    expect(existsSync(path.join(root, 'dist/chrome/manifest.json'))).toBe(true);

    const result = await cleanProject(config);

    expect(result.removed).toBe(true);
    expect(existsSync(path.join(root, 'dist'))).toBe(false);
    expect(existsSync(path.join(root, 'src/background.ts'))).toBe(true);
    expect(existsSync(path.join(root, 'addonova.config.ts'))).toBe(true);
  }, 30_000);

  it('reports when there is nothing to clean', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    const result = await cleanProject(config);

    expect(result.removed).toBe(false);
    expect(existsSync(path.join(root, 'src/background.ts'))).toBe(true);
  });

  it('refuses to clean a directory that contains the project root', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  outdir: '.',
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await expect(cleanProject(config)).rejects.toHaveProperty(
      'code',
      'ADDONOVA_CLEAN_UNSAFE_OUTDIR',
    );
    expect(existsSync(path.join(root, 'src/background.ts'))).toBe(true);
  });

  it('refuses to clean a directory that contains an entrypoint', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'build-src/background.ts' },
  outdir: 'build-src',
};
`,
      'build-src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await expect(cleanProject(config)).rejects.toHaveProperty(
      'code',
      'ADDONOVA_CLEAN_UNSAFE_OUTDIR',
    );
    expect(existsSync(path.join(root, 'build-src/background.ts'))).toBe(true);
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-clean-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
