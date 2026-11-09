import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { unpack } from 'guchho';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'targets');
const exampleDir = path.join(repoRoot, 'examples', 'basic');
const tempRoot = mkdtempSync(path.join(tmpdir(), 'addonova-acceptance-'));

const targets = [
  {
    config: 'chrome-mv2.config.ts',
    target: 'chrome',
    manifestVersion: 2,
    action: 'browser_action',
    background: { scripts: ['background.js'] },
    outdir: 'out/chrome-mv2',
  },
  {
    config: 'chrome-mv3.config.ts',
    target: 'chrome',
    manifestVersion: 3,
    action: 'action',
    background: { service_worker: 'background.js' },
    outdir: 'out/chrome-mv3',
  },
  {
    config: 'edge-mv3.config.ts',
    target: 'edge',
    manifestVersion: 3,
    action: 'action',
    background: { service_worker: 'background.js' },
    outdir: 'out/edge-mv3',
  },
  {
    config: 'firefox-mv3.config.ts',
    target: 'firefox',
    manifestVersion: 3,
    action: 'action',
    background: { scripts: ['background.js'] },
    outdir: 'out/firefox-mv3',
  },
];

function run(args, cwd) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `addonova ${args.join(' ')} failed with exit code ${result.status}\n` +
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return result;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertManifestFiles(manifest, outdir) {
  const references = [];
  const background = manifest.background;
  const action = manifest.action ?? manifest.browser_action;

  if (typeof background?.service_worker === 'string') {
    references.push(background.service_worker);
  }

  if (Array.isArray(background?.scripts)) {
    references.push(...background.scripts);
  }

  if (typeof background?.page === 'string') {
    references.push(background.page);
  }

  if (typeof action?.default_popup === 'string') {
    references.push(action.default_popup);
  }

  if (typeof action?.default_icon === 'string') {
    references.push(action.default_icon);
  }

  if (action?.default_icon !== null && typeof action?.default_icon === 'object') {
    references.push(...Object.values(action.default_icon));
  }

  if (manifest.icons !== null && typeof manifest.icons === 'object') {
    references.push(...Object.values(manifest.icons));
  }

  for (const contentScript of manifest.content_scripts ?? []) {
    references.push(...(contentScript.js ?? []), ...(contentScript.css ?? []));
  }

  for (const reference of references) {
    assert.equal(typeof reference, 'string');
    assert.ok(!reference.startsWith('..'), `Unsafe manifest reference: ${reference}`);
    assert.ok(
      existsSync(path.join(outdir, reference)),
      `Manifest reference does not exist: ${reference}`,
    );
  }
}

try {
  assert.ok(
    existsSync(cliPath),
    'dist/cli/index.js is missing; run "npm run build" before acceptance checks.',
  );

  const version = run(['--version'], repoRoot);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);

  const targetsDir = path.join(tempRoot, 'targets');
  cpSync(fixtureDir, targetsDir, { recursive: true });

  for (const target of targets) {
    run(
      [
        'build',
        '--config',
        target.config,
        '--browser',
        target.target,
        '--outdir',
        target.outdir,
        '--mode',
        'production',
      ],
      targetsDir,
    );

    const outdir = path.join(targetsDir, target.outdir, target.target);
    const manifest = readJson(path.join(outdir, 'manifest.json'));

    assert.equal(manifest.manifest_version, target.manifestVersion);
    assert.deepEqual(manifest.background, target.background);
    assert.ok(manifest[target.action]);
    assert.equal(
      manifest[target.action === 'action' ? 'browser_action' : 'action'],
      undefined,
    );
    assertManifestFiles(manifest, outdir);
    assert.ok(existsSync(path.join(outdir, 'popup.html')));
    assert.ok(existsSync(path.join(outdir, 'content.js')));
    assert.ok(existsSync(path.join(outdir, 'background.js')));
  }

  run(
    ['validate', '--config', 'chrome-mv3.config.ts'],
    targetsDir,
  );

  run(
    ['pack', '--config', 'chrome-mv3.config.ts', '--outdir', 'out/chrome-mv3'],
    targetsDir,
  );

  const archivePath = path.join(
    targetsDir,
    'out',
    'chrome-mv3',
    'addonova-chrome-mv3-1.0.0.zip',
  );

  assert.ok(existsSync(archivePath), 'Expected a packed archive.');

  const extractedDir = path.join(tempRoot, 'extracted');
  await unpack({ archive: archivePath, outDir: extractedDir });

  assert.ok(existsSync(path.join(extractedDir, 'manifest.json')));
  assert.ok(existsSync(path.join(extractedDir, 'background.js')));

  run(
    ['clean', '--config', 'chrome-mv3.config.ts', '--outdir', 'out/chrome-mv3'],
    targetsDir,
  );

  assert.equal(existsSync(path.join(targetsDir, 'out', 'chrome-mv3')), false);

  const exampleCopy = path.join(tempRoot, 'example');
  cpSync(exampleDir, exampleCopy, { recursive: true });

  run(['build'], exampleCopy);

  const exampleOutdir = path.join(exampleCopy, 'dist', 'chrome');
  const exampleBackground = readFileSync(
    path.join(exampleOutdir, 'background.js'),
    'utf8',
  ).trim();

  assert.ok(existsSync(path.join(exampleOutdir, 'popup.html')));
  assert.ok(existsSync(path.join(exampleOutdir, 'content.js')));
  assert.equal(exampleBackground.includes('\n'), false);

  console.log('Acceptance smoke checks passed.');
} catch (error) {
  console.error(error);
  console.error(`Acceptance files kept for inspection: ${tempRoot}`);
  process.exitCode = 1;
  process.exit();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
