import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface PackageInfo {
  name?: string;
  version?: string;
}

export interface ManifestDefaults {
  name?: string;
  version: string;
  versionName?: string;
}

export function readPackageInfo(root: string): PackageInfo {
  const packagePath = path.join(root, 'package.json');

  if (!existsSync(packagePath)) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(packagePath, 'utf8'));

    if (!isPlainObject(parsed)) {
      return {};
    }

    const info: PackageInfo = {};

    if (typeof parsed.name === 'string' && parsed.name.trim() !== '') {
      info.name = parsed.name.trim();
    }

    if (typeof parsed.version === 'string' && parsed.version.trim() !== '') {
      info.version = parsed.version.trim();
    }

    return info;
  } catch {
    return {};
  }
}

export function toManifestDefaults(info: PackageInfo): ManifestDefaults {
  const defaults: ManifestDefaults = {
    version: '0.0.0',
  };

  if (info.name !== undefined) {
    defaults.name = info.name;
  }

  if (info.version !== undefined) {
    const normalized = normalizeManifestVersion(info.version);

    defaults.version = normalized.version;

    if (normalized.versionName !== undefined) {
      defaults.versionName = normalized.versionName;
    }
  }

  return defaults;
}

export function normalizeManifestVersion(raw: string): {
  version: string;
  versionName?: string;
} {
  const value = raw.trim();

  if (/^\d+(?:\.\d+){0,3}$/.test(value)) {
    return {
      version: value
        .split('.')
        .map((part) => clampVersionPart(part))
        .join('.'),
    };
  }

  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/.exec(value);

  if (match === null) {
    return { version: '0.0.0', versionName: value };
  }

  const parts = [
    clampVersionPart(match[1]),
    clampVersionPart(match[2] ?? '0'),
    clampVersionPart(match[3] ?? '0'),
  ];

  if (match[4] !== undefined) {
    parts.push(clampVersionPart(match[4]));
  }

  return { version: parts.join('.'), versionName: value };
}

export function applyManifestDefaults(
  manifest: Readonly<Record<string, unknown>>,
  defaults: ManifestDefaults,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...manifest };

  if (
    (typeof next.name !== 'string' || next.name.trim() === '') &&
    defaults.name !== undefined
  ) {
    next.name = defaults.name;
  }

  if (typeof next.version !== 'string' || next.version.trim() === '') {
    next.version = defaults.version;
  }

  if (
    (next.version_name === undefined || next.version_name === '') &&
    defaults.versionName !== undefined
  ) {
    next.version_name = defaults.versionName;
  }

  return next;
}

function clampVersionPart(value: string | undefined): string {
  if (value === undefined) {
    return '0';
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return '0';
  }

  return String(Math.min(Math.floor(parsed), 65535));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
