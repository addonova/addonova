import { describe, expect, it } from '@guchho/test';

import { buildManifest } from '../../src/browser/manifest.ts';
import type { ResolvedBrowser } from '../../src/core/config.ts';
import {
  normalizeManifestVersion,
  toManifestDefaults,
} from '../../src/core/package.ts';

describe('manifest features', () => {
  it('converts MV3 fields to MV2 when enabled', () => {
    const browser: ResolvedBrowser = {
      target: 'chrome',
      manifestVersion: 2,
      manifestOverrides: {},
    };
    const built = buildManifest(
      {
        name: 'Conversion',
        version: '1.0.0',
        action: { default_title: 'Action' },
        permissions: ['storage'],
        host_permissions: ['https://example.com/*'],
        background: { service_worker: 'background.js' },
        web_accessible_resources: [
          { resources: ['assets/logo.svg'], matches: ['<all_urls>'] },
        ],
      },
      browser,
      { convertManifest: true },
    );

    expect(built.manifest).toMatchObject({
      browser_action: { default_title: 'Action' },
      permissions: ['storage', 'https://example.com/*'],
      background: { scripts: ['background.js'] },
      web_accessible_resources: ['assets/logo.svg'],
    });
    expect(built.manifest.action).toBe(undefined);
    expect(built.manifest.host_permissions).toBe(undefined);
    expect(
      built.diagnostics.filter(
        (diagnostic) => diagnostic.code === 'ADDONOVA_MANIFEST_CONVERTED',
      ),
    ).toHaveLength(4);
  });

  it('preserves fields when conversion is disabled', () => {
    const browser: ResolvedBrowser = {
      target: 'chrome',
      manifestVersion: 2,
      manifestOverrides: {},
    };
    const built = buildManifest(
      {
        name: 'No conversion',
        version: '1.0.0',
        action: { default_title: 'Action' },
        host_permissions: ['https://example.com/*'],
        background: { service_worker: 'background.js' },
      },
      browser,
      { convertManifest: false },
    );

    expect(built.manifest).toMatchObject({
      action: { default_title: 'Action' },
      host_permissions: ['https://example.com/*'],
      background: { service_worker: 'background.js' },
    });
    expect(
      built.diagnostics.some(
        (diagnostic) => diagnostic.code === 'ADDONOVA_MANIFEST_CONVERTED',
      ),
    ).toBe(false);
  });

  it('resolves manifest functions with context and package defaults', () => {
    const browser: ResolvedBrowser = {
      target: 'firefox',
      manifestVersion: 2,
      manifestOverrides: { description: 'override' },
    };
    const built = buildManifest(
      (context) => ({
        version: '3.1.4',
        description: `${context.browser}|${context.manifestVersion}|${context.mode}|${context.command}`,
      }),
      browser,
      {
        defaults: {
          name: 'package-name',
          version: '1.0.0',
        },
        mode: 'development',
        command: 'dev',
      },
    );

    expect(built.manifest).toMatchObject({
      name: 'package-name',
      version: '3.1.4',
      description: 'override',
      manifest_version: 2,
    });
  });

  it('normalizes package versions and prerelease names', () => {
    expect(normalizeManifestVersion('1.2.3-beta.1')).toEqual({
      version: '1.2.3',
      versionName: '1.2.3-beta.1',
    });
    expect(normalizeManifestVersion('2')).toEqual({ version: '2' });
    expect(normalizeManifestVersion('not-a-version')).toEqual({
      version: '0.0.0',
      versionName: 'not-a-version',
    });
    expect(
      toManifestDefaults({ name: 'demo', version: '4.5.6-rc.2' }),
    ).toEqual({
      name: 'demo',
      version: '4.5.6',
      versionName: '4.5.6-rc.2',
    });
  });
});
