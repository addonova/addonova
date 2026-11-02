import { describe, expect, it } from '@guchho/test';

import { buildManifest } from '../../src/browser/manifest.ts';
import {
  BROWSER_TARGET_INFO,
  getBrowserTargetInfo,
  supportsManifestVersion,
} from '../../src/browser/targets.ts';
import type { ResolvedBrowser } from '../../src/core/config.ts';
import { BROWSER_TARGETS } from '../../src/core/types.ts';

describe('browser target model', () => {
  it('exposes a default and supported manifest versions for every target', () => {
    expect(BROWSER_TARGETS).toEqual(['chrome', 'chromium', 'edge', 'firefox']);

    for (const target of BROWSER_TARGETS) {
      const info = getBrowserTargetInfo(target);

      expect(info.target).toBe(target);
      expect(info.displayName).not.toBe('');
      expect(info.supportedManifestVersions).toContain(
        info.defaultManifestVersion,
      );
      expect(supportsManifestVersion(target, 2)).toBe(true);
      expect(supportsManifestVersion(target, 3)).toBe(true);
      expect(BROWSER_TARGET_INFO[target]).toBe(info);
    }
  });

  it('marks Firefox as the only target with Firefox-only capabilities', () => {
    expect(getBrowserTargetInfo('firefox').supportsBrowserSpecificSettings).toBe(
      true,
    );
    expect(getBrowserTargetInfo('firefox').supportsSidebarAction).toBe(true);

    for (const target of ['chrome', 'chromium', 'edge'] as const) {
      expect(getBrowserTargetInfo(target).supportsBrowserSpecificSettings).toBe(
        false,
      );
      expect(getBrowserTargetInfo(target).supportsSidebarAction).toBe(false);
    }
  });
});

describe('manifest merging and compatibility', () => {
  it('deep-merges browser overrides without dropping base fields', () => {
    const built = buildManifest(
      {
        name: 'Merge Demo',
        version: '1.0.0',
        permissions: ['storage'],
        action: {
          default_popup: 'popup.html',
          default_icon: { '16': 'icon.svg' },
        },
      },
      createBrowser('chrome', 3, {
        action: { default_title: 'Chrome Demo' },
      }),
    );

    expect(built.manifest).toMatchObject({
      manifest_version: 3,
      permissions: ['storage'],
      action: {
        default_popup: 'popup.html',
        default_icon: { '16': 'icon.svg' },
        default_title: 'Chrome Demo',
      },
    });
    expect(built.hasErrors).toBe(false);
    expect(built.diagnostics).toEqual([]);
  });

  it('preserves unsupported browser-specific fields instead of stripping them', () => {
    const built = buildManifest(
      {
        name: 'Preserve Demo',
        version: '1.0.0',
        browser_specific_settings: {
          gecko: { id: 'demo@example.com' },
        },
        sidebar_action: { default_panel: 'sidebar.html' },
        page_action: { default_title: 'Page' },
      },
      createBrowser('chrome', 3),
    );

    expect(built.manifest.browser_specific_settings).toEqual({
      gecko: { id: 'demo@example.com' },
    });
    expect(built.manifest.sidebar_action).toEqual({
      default_panel: 'sidebar.html',
    });
    expect(built.manifest.page_action).toEqual({ default_title: 'Page' });
    expect(built.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(['ADDONOVA_MANIFEST_TARGET_FIELD']),
    );
  });

  it('reports MV2 and MV3 background shape mismatches per browser', () => {
    const mv2Worker = buildManifest(
      {
        name: 'Background Demo',
        version: '1.0.0',
        background: { service_worker: 'background.js' },
      },
      createBrowser('chrome', 2),
    );
    const mv3Scripts = buildManifest(
      {
        name: 'Background Demo',
        version: '1.0.0',
        background: { scripts: ['background.js'] },
      },
      createBrowser('chrome', 3),
    );
    const firefoxScripts = buildManifest(
      {
        name: 'Background Demo',
        version: '1.0.0',
        background: { scripts: ['background.js'] },
      },
      createBrowser('firefox', 3),
    );
    const firefoxWorker = buildManifest(
      {
        name: 'Background Demo',
        version: '1.0.0',
        background: { service_worker: 'background.js' },
      },
      createBrowser('firefox', 3),
    );

    expect(hasCode(mv2Worker, 'ADDONOVA_MANIFEST_BACKGROUND_VERSION')).toBe(
      true,
    );
    expect(hasCode(mv3Scripts, 'ADDONOVA_MANIFEST_BACKGROUND_VERSION')).toBe(
      true,
    );
    expect(hasCode(firefoxScripts, 'ADDONOVA_MANIFEST_BACKGROUND_VERSION')).toBe(
      false,
    );
    expect(hasCode(firefoxWorker, 'ADDONOVA_MANIFEST_BACKGROUND_VERSION')).toBe(
      true,
    );
  });

  it('reports action, permission, and host-version differences', () => {
    const mv2Action = buildManifest(
      {
        name: 'Action Demo',
        version: '1.0.0',
        action: { default_title: 'Action' },
        host_permissions: ['https://example.com/*'],
      },
      createBrowser('chrome', 2),
    );
    const mv3BrowserAction = buildManifest(
      {
        name: 'Action Demo',
        version: '1.0.0',
        browser_action: { default_title: 'Action' },
      },
      createBrowser('chrome', 3),
    );
    const mv3Permissions = buildManifest(
      {
        name: 'Permission Demo',
        version: '1.0.0',
        permissions: ['https://example.com/*', 'webRequestBlocking'],
      },
      createBrowser('edge', 3),
    );
    const firefoxWebRequest = buildManifest(
      {
        name: 'Permission Demo',
        version: '1.0.0',
        permissions: ['webRequestBlocking'],
      },
      createBrowser('firefox', 3),
    );

    expect(hasCode(mv2Action, 'ADDONOVA_MANIFEST_ACTION_VERSION')).toBe(true);
    expect(hasCode(mv2Action, 'ADDONOVA_MANIFEST_TARGET_FIELD')).toBe(true);
    expect(hasCode(mv3BrowserAction, 'ADDONOVA_MANIFEST_ACTION_VERSION')).toBe(
      true,
    );
    expect(hasCode(mv3Permissions, 'ADDONOVA_MANIFEST_PERMISSION')).toBe(true);
    expect(hasCode(firefoxWebRequest, 'ADDONOVA_MANIFEST_PERMISSION')).toBe(
      false,
    );
  });
});

function createBrowser(
  target: ResolvedBrowser['target'],
  manifestVersion: ResolvedBrowser['manifestVersion'],
  manifestOverrides: Readonly<Record<string, unknown>> = {},
): ResolvedBrowser {
  return { target, manifestVersion, manifestOverrides };
}

function hasCode(
  built: ReturnType<typeof buildManifest>,
  code: string,
): boolean {
  return built.diagnostics.some((diagnostic) => diagnostic.code === code);
}
