import {
  existsSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { createDefaultWebExtConfig } from '../../src/launcher/config.ts';
import {
  extractProfilePath,
  planBrowserProfile,
  stripProfileArgs,
} from '../../src/launcher/profiles.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('browser profile planning', () => {
  it('extracts and strips Chromium profile arguments', () => {
    const args = ['--user-data-dir=profile', '--no-first-run'];

    expect(extractProfilePath(args, 'chromium')).toBe('profile');
    expect(stripProfileArgs(args, 'chromium')).toEqual(['--no-first-run']);
  });

  it('extracts and strips separate Firefox profile arguments', () => {
    const args = ['--profile', 'firefox-profile', '--no-remote'];

    expect(extractProfilePath(args, 'firefox')).toBe('firefox-profile');
    expect(stripProfileArgs(args, 'firefox')).toEqual(['--no-remote']);
  });

  it('uses an explicit profile configuration as persistent', () => {
    const root = createTempDir();
    const result = planBrowserProfile({
      target: 'chrome',
      root,
      config: {
        ...createDefaultWebExtConfig(),
        chromiumProfile: 'profiles/chrome',
      },
    });

    expect(result.profile).toEqual({
      path: path.join(root, 'profiles/chrome'),
      persistent: true,
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns when an explicit profile overrides a custom profile argument', () => {
    const root = createTempDir();
    const result = planBrowserProfile({
      target: 'chrome',
      root,
      config: {
        ...createDefaultWebExtConfig(),
        chromiumProfile: 'profiles/chrome',
        chromiumArgs: ['--user-data-dir=profiles/custom'],
      },
    });

    expect(result.profile.path).toBe(path.join(root, 'profiles/chrome'));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('ADDONOVA_BROWSER_ARG_IGNORED');
  });

  it('honors a custom profile argument as persistent', () => {
    const root = createTempDir();
    const result = planBrowserProfile({
      target: 'firefox',
      root,
      config: {
        ...createDefaultWebExtConfig(),
        firefoxArgs: ['--profile=profiles/firefox'],
      },
    });

    expect(result.profile).toEqual({
      path: path.join(root, 'profiles/firefox'),
      persistent: true,
    });
  });

  it('uses a persistent default profile when keepProfileChanges is enabled', () => {
    const root = createTempDir();
    const result = planBrowserProfile({
      target: 'edge',
      root,
      config: {
        ...createDefaultWebExtConfig(),
        keepProfileChanges: true,
      },
    });

    expect(result.profile).toEqual({
      path: path.join(root, '.addonova/browser-profiles/edge'),
      persistent: true,
    });
  });

  it('creates an isolated temporary profile by default', () => {
    const root = createTempDir();
    const tempDir = createTempDir();
    const result = planBrowserProfile({
      target: 'chrome',
      root,
      tempDir,
      config: createDefaultWebExtConfig(),
    });

    expect(result.profile.persistent).toBe(false);
    expect(existsSync(result.profile.path)).toBe(true);
    expect(result.profile.path.startsWith(tempDir)).toBe(true);
  });
});

function createTempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'addonova-profile-'));
  tempDirs.push(directory);
  return directory;
}
