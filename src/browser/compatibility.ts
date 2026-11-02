import type { ResolvedBrowser } from '../core/config.js';
import type { Diagnostic } from '../core/errors.js';
import type { BrowserTargetInfo } from './targets.js';

export function collectCompatibilityDiagnostics(
  manifest: Readonly<Record<string, unknown>>,
  browser: ResolvedBrowser,
  target: BrowserTargetInfo,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const manifestVersion = browser.manifestVersion;
  const background = asRecord(manifest.background);

  if (target.deprecatedManifestVersions.includes(manifestVersion)) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_DEPRECATED_VERSION',
      severity: 'warning',
      message: `Manifest V${manifestVersion} is deprecated for ${target.displayName}.`,
      suggestion: 'Prefer Manifest V3 for current browser releases.',
    });
  }

  if (manifestVersion === 2 && manifest.action !== undefined) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_ACTION_VERSION',
      severity: 'warning',
      message:
        'Manifest V2 uses "browser_action"; the "action" field was preserved unchanged.',
      suggestion:
        'Use browser_action for MV2 or a browser-specific manifest override.',
    });
  }

  if (manifestVersion === 3 && manifest.browser_action !== undefined) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_ACTION_VERSION',
      severity: 'warning',
      message:
        'Manifest V3 uses "action"; the "browser_action" field was preserved unchanged.',
      suggestion:
        'Use action for MV3 or a browser-specific manifest override.',
    });
  }

  if (manifestVersion === 2 && background?.service_worker !== undefined) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_BACKGROUND_VERSION',
      severity: 'warning',
      message:
        'Manifest V2 does not use "background.service_worker"; the field was preserved unchanged.',
      suggestion:
        'Use background.scripts for MV2 or a browser-specific manifest override.',
    });
  }

  if (manifestVersion === 3) {
    if (target.target === 'firefox') {
      if (background?.service_worker !== undefined) {
        diagnostics.push({
          code: 'ADDONOVA_MANIFEST_BACKGROUND_VERSION',
          severity: 'warning',
          message:
            'Firefox Manifest V3 uses "background.scripts"; "background.service_worker" was preserved unchanged.',
          suggestion:
            'Use background.scripts for Firefox MV3 or a browser-specific manifest override.',
        });
      }
    } else {
      if (background?.scripts !== undefined) {
        diagnostics.push({
          code: 'ADDONOVA_MANIFEST_BACKGROUND_VERSION',
          severity: 'warning',
          message: `${target.displayName} Manifest V3 does not use "background.scripts"; the field was preserved unchanged.`,
          suggestion:
            'Use background.service_worker for MV3 or a browser-specific manifest override.',
        });
      }

      if (background?.page !== undefined) {
        diagnostics.push({
          code: 'ADDONOVA_MANIFEST_BACKGROUND_VERSION',
          severity: 'warning',
          message: `${target.displayName} Manifest V3 does not use "background.page"; the field was preserved unchanged.`,
          suggestion:
            'Use background.service_worker for MV3 or a browser-specific manifest override.',
        });
      }
    }
  }

  if (manifestVersion === 2 && manifest.host_permissions !== undefined) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_TARGET_FIELD',
      severity: 'warning',
      message:
        'Manifest V2 uses "permissions" for host access; "host_permissions" was preserved unchanged.',
      suggestion:
        'Merge host patterns into permissions for MV2 or use a browser-specific override.',
    });
  }

  for (const field of ['browser_specific_settings', 'applications'] as const) {
    if (
      manifest[field] !== undefined &&
      !target.supportsBrowserSpecificSettings
    ) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_TARGET_FIELD',
        severity: 'warning',
        message: `"${field}" is Firefox-specific and was preserved for ${target.displayName}.`,
        suggestion:
          'Move Firefox-specific manifest fields under a firefox browser override.',
      });
    }
  }

  if (manifest.sidebar_action !== undefined && !target.supportsSidebarAction) {
    diagnostics.push({
      code: 'ADDONOVA_MANIFEST_TARGET_FIELD',
      severity: 'warning',
      message: `"sidebar_action" is Firefox-specific and was preserved for ${target.displayName}.`,
      suggestion:
        'Move sidebar_action under a firefox browser override or use side_panel where supported.',
    });
  }

  if (manifestVersion === 3 && target.target !== 'firefox') {
    if (hasPermission(manifest, 'webRequestBlocking')) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_PERMISSION',
        severity: 'warning',
        message:
          'The "webRequestBlocking" permission in MV3 is restricted for this Chromium-based target.',
        suggestion:
          'Use declarativeNetRequest or verify that the deployment context allows webRequestBlocking.',
      });
    }
  }

  if (manifestVersion === 3) {
    const hostPattern = getPermissions(manifest).find(isHostPattern);

    if (hostPattern !== undefined) {
      diagnostics.push({
        code: 'ADDONOVA_MANIFEST_PERMISSION',
        severity: 'warning',
        message: `Host pattern "${hostPattern}" appears in "permissions" under MV3.`,
        suggestion:
          'Move host patterns to "host_permissions" for MV3 or use a browser-specific override.',
      });
    }
  }

  return diagnostics;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getPermissions(
  manifest: Readonly<Record<string, unknown>>,
): readonly string[] {
  const permissions = manifest.permissions;

  return Array.isArray(permissions)
    ? permissions.filter((value): value is string => typeof value === 'string')
    : [];
}

function hasPermission(
  manifest: Readonly<Record<string, unknown>>,
  permission: string,
): boolean {
  return getPermissions(manifest).includes(permission);
}

function isHostPattern(permission: string): boolean {
  return permission.includes('://');
}
