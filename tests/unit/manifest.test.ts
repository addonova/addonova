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

import {
  buildManifest,
  writeManifest,
} from '../../src/browser/manifest.js';
import {
  getBrowserTargetInfo,
  supportsManifestVersion,
} from '../../src/browser/targets.js';
import type { ResolvedBrowser } from '../../src/core/config.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('browser targets', () => {
  it('exposes manifest support and Firefox-only capabilities', () => {
    expect(supportsManifestVersion('chrome', 3)).toBe(true);
    expect(supportsManifestVersion('firefox', 2)).toBe(true);
    expect(getBrowserTargetInfo('firefox').supportsBrowserSpecificSettings).toBe(
      true,
    );
    expect(getBrowserTargetInfo('firefox').supportsSidebarAction).toBe(true);
    expect(getBrowserTargetInfo('chrome').deprecatedManifestVersions).toEqual([
      2,
    ]);
  });
});

describe('manifest generation', () => {
  it('merges browser overrides and reports compatibility issues', () => {
    const built = buildManifest(
      {
        name: 'Manifest Demo',
        version: '1.0.0',
        background: { service_worker: 'background.js' },
        action: { default_popup: 'popup.html' },
      },
      createBrowser({
        manifestVersion: 2,
        manifestOverrides: {
          action: { default_popup: 'popup-mv2.html' },
        },
      }),
    );

    expect(built.manifest).toMatchObject({
      manifest_version: 2,
      name: 'Manifest Demo',
      version: '1.0.0',
      background: { service_worker: 'background.js' },
      action: { default_popup: 'popup-mv2.html' },
    });
    expect(built.hasErrors).toBe(false);
    expect(built.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'ADDONOVA_MANIFEST_DEPRECATED_VERSION',
        'ADDONOVA_MANIFEST_ACTION_VERSION',
        'ADDONOVA_MANIFEST_BACKGROUND_VERSION',
      ]),
    );
  });

  it('requires a name and a valid version', () => {
    const built = buildManifest(
      { version: '1.0.0.0.0' },
      createBrowser(),
    );
    const codes = built.diagnostics.map((diagnostic) => diagnostic.code);

    expect(built.hasErrors).toBe(true);
    expect(codes).toEqual(
      expect.arrayContaining([
        'ADDONOVA_MANIFEST_REQUIRED_FIELD',
        'ADDONOVA_MANIFEST_VERSION',
      ]),
    );
  });

  it('validates referenced output files when requested', () => {
    const outdir = createTempDir();
    mkdirSync(path.join(outdir, 'icons'), { recursive: true });
    writeFileSync(path.join(outdir, 'background.js'), 'console.log(1);\n');
    writeFileSync(path.join(outdir, 'icons/icon.svg'), '<svg></svg>\n');

    const built = buildManifest(
      {
        name: 'Manifest Demo',
        version: '1.0.0',
        background: { service_worker: 'background.js' },
        icons: { '16': 'icons/icon.svg' },
        action: { default_popup: 'missing.html' },
        content_scripts: [{ js: ['../outside.js'] }],
        options_ui: { page: 'https://example.com/options' },
      },
      createBrowser(),
      { outdir, checkFiles: true },
    );
    const codes = built.diagnostics.map((diagnostic) => diagnostic.code);

    expect(built.hasErrors).toBe(true);
    expect(codes).toEqual(
      expect.arrayContaining([
        'ADDONOVA_MANIFEST_REFERENCE_MISSING',
        'ADDONOVA_MANIFEST_REFERENCE_INVALID',
        'ADDONOVA_MANIFEST_EXTERNAL_REFERENCE',
      ]),
    );
  });

  it('writes a formatted manifest.json file', () => {
    const outdir = path.join(createTempDir(), 'out');

    const manifestPath = writeManifest(outdir, {
      name: 'Manifest Demo',
      version: '1.0.0',
    });

    expect(manifestPath).toBe(path.join(outdir, 'manifest.json'));
    expect(readFileSync(manifestPath, 'utf8')).toBe(
      '{\n  "name": "Manifest Demo",\n  "version": "1.0.0"\n}\n',
    );
  });
});

function createBrowser(
  overrides: Partial<ResolvedBrowser> = {},
): ResolvedBrowser {
  return {
    target: 'chrome',
    manifestVersion: 3,
    manifestOverrides: {},
    ...overrides,
  };
}

function createTempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'addonova-manifest-'));
  tempDirs.push(directory);

  return directory;
}
