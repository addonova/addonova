import {
  cpSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from '@guchho/test';

import { analyzeProject } from '../../src/core/analyze.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/analysis', import.meta.url),
);
const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('project analysis integration', () => {
  it('reports fixture inputs and outputs without writing a build', async () => {
    const root = createProjectFromFixture();
    const config = await resolveProjectConfig({ cwd: root });
    const analyses = await analyzeProject(config);

    expect(analyses).toHaveLength(1);

    const analysis = analyses[0];

    expect(analysis).toBeDefined();

    if (analysis === undefined) {
      throw new Error('Expected one analysis.');
    }

    expect(analysis.browser.target).toBe('chrome');
    expect(analysis.outputs.map((output) => output.path)).toContain(
      'background.js',
    );
    expect(analysis.inputs.map((input) => input.path)).toEqual(
      expect.arrayContaining(['src/background.ts', 'src/message.ts']),
    );
    expect(analysis.totalBytes).toBeGreaterThan(0);
    expect(
      existsSync(path.join(root, 'dist', 'chrome', 'background.js')),
    ).toBe(false);
  }, 60_000);
});

function createProjectFromFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-analysis-'));
  tempDirs.push(root);
  cpSync(fixtureRoot, root, { recursive: true });

  return root;
}
