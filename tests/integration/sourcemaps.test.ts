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

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('development source maps', () => {
  it('emits source maps and preserves unminified sources in development', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Sourcemap Demo', version: '1.0.0' },
};
`,
      'src/background.ts': `/* development-comment */
const message = 'sourcemap-marker';
console.log(message);
`,
    });
    const config = await resolveProjectConfig({
      cwd: root,
      defaultMode: 'development',
    });
    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one development build report.');
    }

    const outputs = report.result.outputs.map((output) =>
      path.relative(report.outdir, output.path).split(path.sep).join('/'),
    );
    const background = readFileSync(
      path.join(report.outdir, 'background.js'),
      'utf8',
    );

    expect(report.result.success).toBe(true);
    expect(outputs.some((file) => file.endsWith('.map'))).toBe(true);
    expect(background).toContain('development-comment');
    expect(background).toContain('sourcemap-marker');
  }, 30_000);
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-sourcemap-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
