import {
  DEFAULT_MANIFEST_VERSION,
  isManifestVersion,
} from '../core/types.ts';
import type { BrowserTarget, ManifestVersion } from '../core/types.ts';

export interface BrowserTargetInfo {
  readonly target: BrowserTarget;
  readonly displayName: string;
  readonly defaultManifestVersion: ManifestVersion;
  readonly supportedManifestVersions: readonly ManifestVersion[];
  readonly deprecatedManifestVersions: readonly ManifestVersion[];
  readonly supportsBrowserSpecificSettings: boolean;
  readonly supportsSidebarAction: boolean;
}

export const BROWSER_TARGET_INFO = {
  chrome: {
    target: 'chrome',
    displayName: 'Chrome',
    defaultManifestVersion: DEFAULT_MANIFEST_VERSION.chrome,
    supportedManifestVersions: [2, 3],
    deprecatedManifestVersions: [2],
    supportsBrowserSpecificSettings: false,
    supportsSidebarAction: false,
  },
  chromium: {
    target: 'chromium',
    displayName: 'Chromium',
    defaultManifestVersion: DEFAULT_MANIFEST_VERSION.chromium,
    supportedManifestVersions: [2, 3],
    deprecatedManifestVersions: [2],
    supportsBrowserSpecificSettings: false,
    supportsSidebarAction: false,
  },
  edge: {
    target: 'edge',
    displayName: 'Edge',
    defaultManifestVersion: DEFAULT_MANIFEST_VERSION.edge,
    supportedManifestVersions: [2, 3],
    deprecatedManifestVersions: [2],
    supportsBrowserSpecificSettings: false,
    supportsSidebarAction: false,
  },
  firefox: {
    target: 'firefox',
    displayName: 'Firefox',
    defaultManifestVersion: DEFAULT_MANIFEST_VERSION.firefox,
    supportedManifestVersions: [2, 3],
    deprecatedManifestVersions: [],
    supportsBrowserSpecificSettings: true,
    supportsSidebarAction: true,
  },
} satisfies Record<BrowserTarget, BrowserTargetInfo>;

export function getBrowserTargetInfo(target: BrowserTarget): BrowserTargetInfo {
  return BROWSER_TARGET_INFO[target];
}

export function supportsManifestVersion(
  target: BrowserTarget,
  version: ManifestVersion,
): boolean {
  return BROWSER_TARGET_INFO[target].supportedManifestVersions.includes(version);
}

export function assertSupportedManifestVersion(
  target: BrowserTarget,
  version: unknown,
): asserts version is ManifestVersion {
  if (!isManifestVersion(version) || !supportsManifestVersion(target, version)) {
    throw new Error(
      `Unsupported manifest version "${String(version)}" for ${target}.`,
    );
  }
}
