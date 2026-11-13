import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { BrowserTarget, BuildMode, ManifestVersion } from './types.ts';

export interface LoadBuildEnvOptions {
  root: string;
  mode: BuildMode;
  browser: BrowserTarget;
  manifestVersion?: ManifestVersion;
}

export interface BuildEnv {
  values: Readonly<Record<string, string>>;
  mode: BuildMode;
  browser: BrowserTarget;
  manifestVersion: ManifestVersion;
  dev: boolean;
  prod: boolean;
}

const ENV_PREFIX = 'import.meta.env.';

export function loadBuildEnv(options: LoadBuildEnvOptions): BuildEnv {
  const values: Record<string, string> = {};
  const files = [
    '.env',
    '.env.local',
    `.env.${options.mode}`,
    `.env.${options.mode}.local`,
    `.env.${options.browser}`,
    `.env.${options.browser}.local`,
  ];

  for (const filename of files) {
    mergeEnvFile(values, path.join(options.root, filename));
  }

  return {
    values,
    mode: options.mode,
    browser: options.browser,
    manifestVersion: options.manifestVersion ?? 3,
    dev: options.mode === 'development',
    prod: options.mode === 'production',
  };
}

export function toImportMetaEnvDefines(
  env: BuildEnv,
): Record<string, string> {
  const defines: Record<string, string> = {
    [`${ENV_PREFIX}MODE`]: JSON.stringify(env.mode),
    [`${ENV_PREFIX}DEV`]: String(env.dev),
    [`${ENV_PREFIX}PROD`]: String(env.prod),
    [`${ENV_PREFIX}BROWSER`]: JSON.stringify(env.browser),
    [`${ENV_PREFIX}MANIFEST_VERSION`]: String(env.manifestVersion),
  };

  for (const [key, value] of Object.entries(env.values)) {
    if (key.startsWith('ADDONOVA_') || key.startsWith('VITE_')) {
      defines[`${ENV_PREFIX}${key}`] = JSON.stringify(value);
    }
  }

  return defines;
}

function mergeEnvFile(
  target: Record<string, string>,
  filePath: string,
): void {
  if (!existsSync(filePath)) {
    return;
  }

  let source: string;

  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const line of source.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (parsed === null) {
      continue;
    }

    target[parsed.key] = expandVariables(parsed.value, target);
  }
}

function parseEnvLine(
  line: string,
): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (trimmed === '' || trimmed.startsWith('#')) {
    return null;
  }

  const withoutExport = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;
  const separator = withoutExport.indexOf('=');

  if (separator <= 0) {
    return null;
  }

  const key = withoutExport.slice(0, separator).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: parseEnvValue(withoutExport.slice(separator + 1).trim()),
  };
}

function parseEnvValue(value: string): string {
  if (value.length >= 2) {
    const quote = value[0];

    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      const body = value.slice(1, -1);

      return quote === '"'
        ? body
            .replaceAll('\\n', '\n')
            .replaceAll('\\r', '\r')
            .replaceAll('\\t', '\t')
            .replaceAll('\\"', '"')
        : body;
    }
  }

  const comment = value.search(/\s#/);

  return comment === -1 ? value : value.slice(0, comment).trimEnd();
}

function expandVariables(
  value: string,
  values: Readonly<Record<string, string>>,
): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    return values[name] ?? process.env[name] ?? '';
  });
}
