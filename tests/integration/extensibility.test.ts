import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from '@guchho/test';

import { buildProject } from '../../src/core/build.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/extensibility', import.meta.url),
);
const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('hooks and modules', () => {
  it('runs config hooks and local modules through a real build', async () => {
    const outdir = mkdtempSync(path.join(tmpdir(), 'addonova-extensibility-'));
    tempDirs.push(outdir);
    const config = await resolveProjectConfig({
      cwd: fixtureRoot,
      overrides: { outdir },
    });
    const events = readEvents();

    expect(config.modules?.map((module) => module.name)).toEqual([
      'fixture-module',
    ]);
    expect(config.moduleFiles).toEqual([
      path.join(fixtureRoot, 'modules/00-fixture.ts'),
    ]);
    expect(config.entrypoints.map((entrypoint) => entrypoint.name)).toEqual([
      'background',
      'module-script',
      'hooked',
    ]);
    expect(config.alias).toEqual({
      '@fixture': path.join(fixtureRoot, 'src/shared.ts'),
    });
    expect(events).toEqual([
      'module:setup',
      'config:resolved',
      'entrypoints:found:2',
      'entrypoints:resolved',
    ]);

    const [report] = await buildProject(config);

    expect(report).toBeDefined();

    if (report === undefined) {
      return;
    }

    const targetOutdir = path.join(outdir, 'chrome');
    const background = readFileSync(
      path.join(targetOutdir, 'background.js'),
      'utf8',
    );

    expect(report.result.success).toBe(true);
    expect(report.manifest).toMatchObject({
      manifest_version: 3,
      description: 'from-config-hook',
      author: 'fixture-module',
      background: { service_worker: 'background.js' },
    });
    expect(background).toContain('shared-alias-marker');
    expect(
      readFileSync(path.join(targetOutdir, 'module-script.js'), 'utf8'),
    ).toContain('shared-alias-marker');
    expect(existsSync(path.join(targetOutdir, 'hooked.js'))).toBe(true);
    expect(
      readFileSync(path.join(targetOutdir, 'generated/module.txt'), 'utf8'),
    ).toBe('from-module');
    expect(
      readFileSync(path.join(targetOutdir, 'generated/config.txt'), 'utf8'),
    ).toBe('from-config');
    expect(events).toEqual([
      'module:setup',
      'config:resolved',
      'entrypoints:found:2',
      'entrypoints:resolved',
      'build:publicAssets',
      'module:manifestGenerated',
      'build:manifestGenerated',
      'module:build:done',
      'build:done',
    ]);
  }, 30_000);

  it('rejects duplicate entrypoints added by hooks', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  hooks: {
    'entrypoints:resolved': ({ addEntrypoint }) => {
      addEntrypoint('background', 'src/background.ts');
    },
  },
};
`,
      'src/background.ts': 'export {};\n',
    });

    await expect(resolveProjectConfig({ cwd: root })).rejects.toHaveProperty(
      'code',
      'ADDONOVA_HOOK_FAILED',
    );
    await expect(resolveProjectConfig({ cwd: root })).rejects.toThrow(
      'Duplicate entrypoint name "background"',
    );
  });
});

function readEvents(): string[] {
  return (
    globalThis as { __addonovaExtensibilityEvents?: string[] }
  ).__addonovaExtensibilityEvents ?? [];
}

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-extensibility-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
