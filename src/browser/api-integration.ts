import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { AddonovaError } from '../core/errors.ts';
import type { ResolvedBrowserApiConfig } from '../core/config.ts';
import type { BrowserTarget } from '../core/types.ts';

export interface BrowserApiBundlerSettings {
  readonly alias: Readonly<Record<string, string>>;
  readonly define: Readonly<Record<string, string>>;
  readonly external: readonly string[];
}

export const BROWSER_API_SUBPATHS = [
  'chrome',
  'chromium',
  'edge',
  'firefox',
] as const;

export function getBrowserApiBundlerSettings(
  target: BrowserTarget,
  config: ResolvedBrowserApiConfig,
): BrowserApiBundlerSettings {
  if (config.mode === 'bundle') {
    const define: Record<string, string> = config.define
      ? { __ADDONOVA_BROWSER__: JSON.stringify(target) }
      : {};

    return {
      alias: { [config.packageName]: `${config.packageName}/${target}` },
      define,
      external: [],
    };
  }

  return {
    alias: {},
    define: {},
    external: [
      config.packageName,
      ...BROWSER_API_SUBPATHS.map(
        (subpath) => `${config.packageName}/${subpath}`,
      ),
    ],
  };
}

export function assertBrowserApiInstalled(
  root: string,
  config: ResolvedBrowserApiConfig,
): void {
  if (config.mode !== 'bundle') {
    return;
  }

  if (isBrowserApiInstalled(root, config)) {
    return;
  }

  throw new AddonovaError({
    code: 'ADDONOVA_BROWSER_API_NOT_FOUND',
    severity: 'error',
    message: `The browser API package "${config.packageName}" could not be resolved from ${root}.`,
    suggestion:
      'Install the package in the project, or set browserApi to "external" to keep it external.',
  });
}

export function isBrowserApiInstalled(
  root: string,
  config: Pick<ResolvedBrowserApiConfig, 'packageName'>,
): boolean {
  return isPackageInstalled(root, config.packageName);
}

function isPackageInstalled(root: string, packageName: string): boolean {
  const requireFromProject = createRequire(path.join(root, 'package.json'));

  for (const specifier of [packageName, `${packageName}/package.json`]) {
    try {
      requireFromProject.resolve(specifier);

      return true;
    } catch {
      continue;
    }
  }

  let directory = path.resolve(root);

  while (true) {
    const packageJson = path.join(
      directory,
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    );

    if (existsSync(packageJson)) {
      return true;
    }

    const parent = path.dirname(directory);

    if (parent === directory) {
      return false;
    }

    directory = parent;
  }
}
