import assert from 'node:assert/strict';
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, pack, stop, unpack, version } from 'guchho';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'smoke');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'addonova-phase0-'));
const outDir = path.join(tempRoot, 'out');
const archiveDir = path.join(tempRoot, 'archive');
const marker = 'ADDONOVA_TRANSFORM_BRIDGE';

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, relative)));
    } else {
      files.push(relative);
    }
  }

  return files.sort();
}

const transformBridge = {
  name: 'addonova-phase0-transform-bridge',
  async load(id) {
    if (!id.replaceAll('\\', '/').endsWith('/src/background.ts')) {
      return null;
    }

    const code = await readFile(id, 'utf8');

    return {
      code: `${code}\nconsole.log(${JSON.stringify(marker)});\n`,
      loader: 'ts',
    };
  },
};

let cleaned = false;

try {
  console.log(`Guchho version: ${version}`);
  assert.equal(version, '1.0.9');

  const result = await build({
    absWorkingDir: fixtureDir,
    entrypoints: [
      { in: 'src/background.ts', out: 'background' },
      { in: 'src/popup/index.html', out: 'popup.html' },
    ],
    outdir: outDir,
    bundle: true,
    splitting: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    treeShaking: true,
    metafile: true,
    logLevel: 'silent',
    loader: { '.svg': 'file' },
    plugins: [transformBridge],
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.outputs.length >= 3, 'expected at least three outputs');
  assert.ok(result.inputs?.some((input) => input.path.includes('shared.ts')));
  assert.ok(result.metafile, 'expected a metafile');

  const files = await listFiles(outDir);
  console.log(`Output files: ${files.join(', ')}`);

  assert.ok(files.includes('background.js'), 'background.js was not emitted');
  assert.ok(files.includes('popup.html'), 'popup.html was not emitted');
  assert.ok(files.some((file) => file.endsWith('.js') && file !== 'background.js'));
  assert.ok(files.some((file) => file.endsWith('.css')));
  assert.ok(files.some((file) => file.endsWith('.svg')));

  const background = await readFile(path.join(outDir, 'background.js'), 'utf8');
  assert.ok(background.includes('shared-module-inlined'));
  assert.ok(background.includes(marker), 'load-hook transform did not reach output');

  const popupHtml = await readFile(path.join(outDir, 'popup.html'), 'utf8');
  assert.ok(!popupHtml.includes('popup.ts'), 'HTML still references TypeScript source');
  assert.match(popupHtml, /src="[^"]+\.js"/);
  assert.match(popupHtml, /href="[^"]+\.css"/);

  await mkdir(path.join(outDir, 'icons'), { recursive: true });
  await copyFile(
    path.join(fixtureDir, 'public', 'icons', 'icon.svg'),
    path.join(outDir, 'icons', 'icon.svg'),
  );
  await writeFile(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(
      {
        manifest_version: 3,
        name: 'Addonova Smoke',
        version: '0.0.1',
        background: { service_worker: 'background.js' },
        action: { default_popup: 'popup.html' },
        icons: { 32: 'icons/icon.svg' },
      },
      null,
      2,
    )}\n`,
  );

  await mkdir(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, 'smoke.zip');
  const topLevel = (await readdir(outDir)).sort();
  const packResult = await pack({
    inputs: topLevel.map((name) => path.join(outDir, name)),
    outFile: archivePath,
    overwrite: true,
    date: new Date('2026-01-01T00:00:00.000Z'),
  });

  assert.ok(packResult.size > 0);
  assert.deepEqual(packResult.warnings, []);

  const extractedDir = path.join(archiveDir, 'extracted');
  await unpack({ archive: archivePath, outDir: extractedDir });
  const extractedTopLevel = (await readdir(extractedDir)).sort();

  assert.ok(extractedTopLevel.includes('manifest.json'));
  assert.ok(extractedTopLevel.includes('icons'));
  assert.ok(!extractedTopLevel.includes('out'));
  await access(path.join(extractedDir, 'manifest.json'), constants.F_OK);

  await stop();
  await rm(outDir, { recursive: true, force: true });
  await assert.rejects(access(outDir, constants.F_OK));
  await rm(archiveDir, { recursive: true, force: true });
  await rm(tempRoot, { recursive: true, force: true });
  cleaned = true;

  console.log('Phase 0 smoke checks passed.');
} catch (error) {
  console.error(error);
  console.error(`Smoke files kept for inspection: ${tempRoot}`);
  process.exitCode = 1;
} finally {
  if (!cleaned) {
    await stop().catch(() => {});
  }
}
