import type { BrowserTarget, ManifestVersion } from '../core/types.ts';

export interface ManifestConversion {
  field: string;
  message: string;
}

export function convertManifest(
  manifest: Record<string, unknown>,
  manifestVersion: ManifestVersion,
  target: BrowserTarget,
): readonly ManifestConversion[] {
  return manifestVersion === 2
    ? convertToManifestV2(manifest, target)
    : convertToManifestV3(manifest, target);
}

function convertToManifestV2(
  manifest: Record<string, unknown>,
  _target: BrowserTarget,
): readonly ManifestConversion[] {
  const conversions: ManifestConversion[] = [];

  if (manifest.action !== undefined && manifest.browser_action === undefined) {
    manifest.browser_action = manifest.action;
    delete manifest.action;
    conversions.push({
      field: 'action',
      message: 'Converted "action" to "browser_action" for Manifest V2.',
    });
  }

  if (manifest.host_permissions !== undefined) {
    const hosts = asStringArray(manifest.host_permissions);

    if (hosts.length > 0 || Array.isArray(manifest.host_permissions)) {
      const permissions = unique([
        ...asStringArray(manifest.permissions),
        ...hosts,
      ]);

      if (permissions.length > 0) {
        manifest.permissions = permissions;
      }

      delete manifest.host_permissions;
      conversions.push({
        field: 'host_permissions',
        message: 'Merged "host_permissions" into "permissions" for Manifest V2.',
      });
    }
  }

  if (Array.isArray(manifest.web_accessible_resources)) {
    const resources = flattenWebAccessibleResources(
      manifest.web_accessible_resources,
    );

    if (resources !== null) {
      manifest.web_accessible_resources = resources;
      conversions.push({
        field: 'web_accessible_resources',
        message:
          'Flattened "web_accessible_resources" objects into a string array for Manifest V2.',
      });
    }
  }

  const background = asRecord(manifest.background);

  if (
    background !== null &&
    background.service_worker !== undefined &&
    background.scripts === undefined
  ) {
    const worker = background.service_worker;

    if (typeof worker === 'string' && worker.trim() !== '') {
      background.scripts = [worker];
    }

    delete background.service_worker;
    conversions.push({
      field: 'background.service_worker',
      message:
        'Converted "background.service_worker" to "background.scripts" for Manifest V2.',
    });
  }

  return conversions;
}

function convertToManifestV3(
  manifest: Record<string, unknown>,
  target: BrowserTarget,
): readonly ManifestConversion[] {
  const conversions: ManifestConversion[] = [];

  if (manifest.action === undefined) {
    const action = manifest.browser_action ?? manifest.page_action;

    if (action !== undefined) {
      manifest.action = action;
      delete manifest.browser_action;
      delete manifest.page_action;
      conversions.push({
        field: 'browser_action',
        message: 'Converted "browser_action" to "action" for Manifest V3.',
      });
    }
  }

  if (target !== 'firefox') {
    const permissions = asStringArray(manifest.permissions);
    const hostPermissions = permissions.filter(isHostPattern);
    const otherPermissions = permissions.filter(
      (permission) => !isHostPattern(permission),
    );

    if (hostPermissions.length > 0) {
      manifest.host_permissions = unique([
        ...asStringArray(manifest.host_permissions),
        ...hostPermissions,
      ]);
      manifest.permissions = otherPermissions;
      conversions.push({
        field: 'permissions',
        message:
          'Moved host patterns from "permissions" to "host_permissions" for Manifest V3.',
      });
    }

    const background = asRecord(manifest.background);

    if (
      background !== null &&
      background.service_worker === undefined &&
      background.scripts !== undefined
    ) {
      const scripts = asStringArray(background.scripts);

      if (scripts.length === 1 && scripts[0] !== undefined) {
        background.service_worker = scripts[0];
        delete background.scripts;
        conversions.push({
          field: 'background.scripts',
          message:
            'Converted "background.scripts" to "background.service_worker" for Manifest V3.',
        });
      }
    }
  }

  return conversions;
}

function flattenWebAccessibleResources(
  resources: readonly unknown[],
): readonly string[] | null {
  const flattened: string[] = [];
  let changed = false;

  for (const entry of resources) {
    if (typeof entry === 'string') {
      flattened.push(entry);
      continue;
    }

    if (isRecord(entry)) {
      changed = true;

      for (const resource of asStringArray(entry.resources)) {
        flattened.push(resource);
      }

      continue;
    }

    return null;
  }

  return changed ? unique(flattened) : null;
}

function isHostPattern(permission: string): boolean {
  return permission.includes('://');
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
