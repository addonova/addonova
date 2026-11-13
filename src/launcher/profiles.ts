import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BrowserTarget } from '../core/types.ts';
import type { Diagnostic } from '../core/errors.ts';
import type {
  BrowserProfilePlan,
  ResolvedWebExtConfig,
} from './types.ts';

export interface PlanBrowserProfileOptions {
  target: BrowserTarget;
  config: ResolvedWebExtConfig;
  root: string;
  tempDir?: string;
}

export interface BrowserProfilePlanResult {
  profile: BrowserProfilePlan;
  warnings: readonly Diagnostic[];
}

export function planBrowserProfile(
  options: PlanBrowserProfileOptions,
): BrowserProfilePlanResult {
  const { target, config, root } = options;
  const family = getBrowserFamily(target);
  const customArgs =
    family === 'chromium' ? config.chromiumArgs : config.firefoxArgs;
  const explicitProfile =
    family === 'chromium' ? config.chromiumProfile : config.firefoxProfile;
  const argumentProfile = extractProfilePath(customArgs, family);
  const warnings: Diagnostic[] = [];

  if (explicitProfile !== null) {
    if (argumentProfile !== null) {
      warnings.push({
        code: 'ADDONOVA_BROWSER_ARG_IGNORED',
        severity: 'warning',
        message: `Ignoring custom ${formatProfileFlag(family)} argument because an explicit ${target} profile is configured.`,
        suggestion: 'Remove the profile argument from the browser arguments.',
      });
    }

    return {
      profile: {
        path: resolveProfilePath(root, explicitProfile),
        persistent: true,
      },
      warnings,
    };
  }

  if (argumentProfile !== null) {
    return {
      profile: {
        path: resolveProfilePath(root, argumentProfile),
        persistent: true,
      },
      warnings,
    };
  }

  if (config.keepProfileChanges) {
    return {
      profile: {
        path: path.join(
          root,
          '.addonova',
          'browser-profiles',
          target,
        ),
        persistent: true,
      },
      warnings,
    };
  }

  const tempDirectory = options.tempDir ?? os.tmpdir();

  return {
    profile: {
      path: mkdtempSync(path.join(tempDirectory, `addonova-${target}-`)),
      persistent: false,
    },
    warnings,
  };
}

export function getBrowserFamily(
  target: BrowserTarget,
): 'chromium' | 'firefox' {
  return target === 'firefox' ? 'firefox' : 'chromium';
}

export function extractProfilePath(
  args: readonly string[],
  family: 'chromium' | 'firefox',
): string | null {
  const flag = formatProfileFlag(family);
  let profile: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      continue;
    }

    if (argument === flag) {
      const value = args[index + 1];

      if (value !== undefined && !value.startsWith('-')) {
        profile = value;
      }

      continue;
    }

    if (argument.startsWith(`${flag}=`)) {
      const value = argument.slice(flag.length + 1);

      if (value.length > 0) {
        profile = value;
      }
    }
  }

  return profile;
}

export function stripProfileArgs(
  args: readonly string[],
  family: 'chromium' | 'firefox',
): string[] {
  const flag = formatProfileFlag(family);
  const result: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      continue;
    }

    if (argument === flag) {
      const value = args[index + 1];

      if (value !== undefined && !value.startsWith('-')) {
        index += 1;
      }

      continue;
    }

    if (argument.startsWith(`${flag}=`)) {
      continue;
    }

    result.push(argument);
  }

  return result;
}

function formatProfileFlag(family: 'chromium' | 'firefox'): string {
  return family === 'chromium' ? '--user-data-dir' : '--profile';
}

function resolveProfilePath(root: string, profile: string): string {
  return path.isAbsolute(profile) ? profile : path.resolve(root, profile);
}
