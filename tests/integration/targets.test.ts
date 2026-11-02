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
import type { BrowserTarget, ManifestVersion } from '../../src/core/types.ts';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/targets', import.meta.url),
);
const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

interface TargetFixture {
  config: string;
  target: BrowserTarget;
  manifestVersion: ManifestVersion;
  action: 'action' | 'browser_action';
  background: Record<string, unknown>;
  extraManifest?: Record<string, unknown>;
}

const fixtures: readonly TargetFixture[] = [
  {
    config: 'chrome-mv2.config.ts',
    target: 'chrome',
    manifestVersion: 2,
    action: 'browser_action',
    background: { scripts: ['background.js'] },
  },
  {
    config: 'chrome-mv3.config.ts',
    target: 'chrome',
    manifestVersion: 3,
    action: 'action',
    background: { service_worker: 'background.js' },
  },
  {
    config: 'edge-mv3.config.ts',
    target: 'edge',
    manifestVersion: 3,
    action: 'action',
    background: { service_worker: 'background.js' },
    extraManifest: { action: { default_title: 'Edge Fixture' } },
  },
  {
    config: 'firefox-mv3.config.ts',
    target: 'firefox',
    manifestVersion: 3,
    action: 'action',
    background: { scripts: ['background.js'] },
    extraManifest: {
      browser_specific_settings: { gecko: { id: 'target-fixture@example.com' } },
    },
  },
];

describe('target fixtures', () => {
  for (const fixture of fixtures) {
    it(`builds a loadable ${fixture.target} MV${fixture.manifestVersion} extension`, async () => {
      const outdir = mkdtempSync(
        path.join(tmpdir(), `addonova-target-${fixture.target}-`),
      );
      tempDirs.push(outdir);

      const config = await resolveProjectConfig({
        cwd: fixtureRoot,
        explicitConfigPath: fixture.config,
        overrides: { outdir },
      });
      const reports = await buildProject(config);
      const report = reports[0];

      expect(reports).toHaveLength(1);
      expect(report).toBeDefined();

      if (report === undefined) {
        throw new Error(`Expected a ${fixture.config} build report.`);
      }

      const { result } = report;
      const targetOutdir = path.join(outdir, fixture.target);
      const manifest = JSON.parse(
        readFileSync(path.join(targetOutdir, 'manifest.json'), 'utf8'),
      ) as Record<string, unknown>;
      const popup = readFileSync(
        path.join(targetOutdir, 'popup.html'),
        'utf8',
      );
      const background = readFileSync(
        path.join(targetOutdir, 'background.js'),
        'utf8',
      );
      const content = readFileSync(
        path.join(targetOutdir, 'content.js'),
        'utf8',
      );

      expect(report.browser.target).toBe(fixture.target);
      expect(report.browser.manifestVersion).toBe(fixture.manifestVersion);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(report.manifestPath).not.toBeNull();
      expect(report.manifestDiagnostics.every((item) => item.severity !== 'error')).toBe(
        true,
      );
      expect(manifest).toMatchObject({
        manifest_version: fixture.manifestVersion,
        name: 'Target Fixture',
        version: '1.0.0',
        background: fixture.background,
        icons: { '48': 'icons/icon.svg' },
        content_scripts: [
          { matches: ['https://example.com/*'], js: ['content.js'] },
        ],
        ...fixture.extraManifest,
      });
      expect(manifest[fixture.action]).toMatchObject({
        default_popup: 'popup.html',
        default_icon: 'icons/icon.svg',
      });
      expect(manifest[fixture.action === 'action' ? 'browser_action' : 'action'])
        .toBeUndefined();
      expect(existsSync(path.join(targetOutdir, 'icons/icon.svg'))).toBe(true);
      expect(popup).not.toContain('popup.ts');
      expect(popup).toMatch(/assets\/[^"]+\.js/);
      expect(popup).toMatch(/assets\/[^"]+\.css/);
      expect(background).toContain('target-fixture-background');
      expect(content).toContain('target-fixture-content');

      if (fixture.target === 'chrome' && fixture.manifestVersion === 2) {
        expect(
          report.manifestDiagnostics.map((diagnostic) => diagnostic.code),
        ).toContain('ADDONOVA_MANIFEST_DEPRECATED_VERSION');
      }
    }, 60_000);
  }
});
