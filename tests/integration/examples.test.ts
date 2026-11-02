import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from '@guchho/test';

import { buildProject } from '../../src/core/build.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';

const exampleRoot = fileURLToPath(
  new URL('../../examples/basic', import.meta.url),
);
const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('basic example', () => {
  it('builds a loadable extension with HTML, background, content, and assets', async () => {
    const outdir = mkdtempSync(path.join(tmpdir(), 'addonova-example-'));
    tempDirs.push(outdir);

    const config = await resolveProjectConfig({
      cwd: exampleRoot,
      overrides: { outdir },
    });
    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one example build report.');
    }

    const outputs = report.result.outputs
      .map((output) =>
        path.relative(report.outdir, output.path).split(path.sep).join('/'),
      )
      .sort();

    expect(report.result.success).toBe(true);
    expect(report.result.errors).toEqual([]);
    expect(report.manifestDiagnostics).toEqual([]);
    expect(outputs).toContain('background.js');
    expect(outputs).toContain('content.js');
    expect(outputs).toContain('popup.html');
    expect(outputs.some((file) => /^assets\/.*\.js$/.test(file))).toBe(true);
    expect(outputs.some((file) => /^assets\/.*\.css$/.test(file))).toBe(true);
    expect(outputs.some((file) => /^assets\/.*\.svg$/.test(file))).toBe(true);
    expect(existsSync(path.join(report.outdir, 'icons/icon.svg'))).toBe(true);

    const manifest = JSON.parse(
      readFileSync(path.join(report.outdir, 'manifest.json'), 'utf8'),
    ) as Record<string, unknown>;
    const popup = readFileSync(
      path.join(report.outdir, 'popup.html'),
      'utf8',
    );

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: 'Addonova Basic Example',
      version: '1.0.0',
      background: { service_worker: 'background.js' },
      action: { default_popup: 'popup.html' },
    });
    expect(popup).toMatch(/assets\/[^"]+\.js/);
    expect(popup).toMatch(/assets\/[^"]+\.css/);
  }, 60_000);
});
