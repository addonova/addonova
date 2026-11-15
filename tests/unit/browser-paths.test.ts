import path from 'node:path';

import { describe, expect, it } from '@guchho/test';

import { AddonovaError } from '../../src/core/errors.ts';
import {
  findBrowserBinary,
  resolveBrowserBinary,
  tryFindBrowserBinary,
} from '../../src/launcher/browser-paths.ts';

describe('browser binary detection', () => {
  it('uses a custom absolute binary first', () => {
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      binaries: { chrome: 'C:\\custom\\chrome.exe' },
      platform: 'win32',
      env: {},
      exists: (candidate) => candidate === 'C:\\custom\\chrome.exe',
    });

    expect(binary).toBe('C:\\custom\\chrome.exe');
  });

  it('resolves custom relative binary paths against the project root', () => {
    const expected = path.win32.resolve('C:\\project', 'tools/chrome.exe');
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      binaries: { chrome: 'tools/chrome.exe' },
      root: 'C:\\project',
      platform: 'win32',
      env: {},
      exists: (candidate) => candidate === expected,
    });

    expect(binary).toBe(expected);
  });

  it('detects Windows installation candidates', () => {
    const expected =
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      platform: 'win32',
      env: {
        ProgramFiles: 'C:\\Program Files',
      },
      exists: (candidate) => candidate === expected,
    });

    expect(binary).toBe(expected);
  });

  it('resolves bare command names through PATH and PATHEXT', () => {
    const expected = 'C:\\Tools\\chrome.CMD';
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      binaries: { chrome: 'chrome' },
      platform: 'win32',
      env: {
        PATH: 'C:\\Windows;C:\\Tools',
        PATHEXT: '.EXE;.CMD',
      },
      exists: (candidate) => candidate === expected,
    });

    expect(binary).toBe(expected);
  });

  it('detects Linux candidates', () => {
    const expected = '/usr/bin/google-chrome';
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      platform: 'linux',
      env: {},
      exists: (candidate) => candidate === expected,
    });

    expect(binary).toBe(expected);
  });

  it('detects macOS application bundles', () => {
    const expected =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      platform: 'darwin',
      env: {},
      exists: (candidate) => candidate === expected,
    });

    expect(binary).toBe(expected);
  });

  it('falls back to another browser of the same family', () => {
    const expected = '/usr/bin/chromium';
    const resolved = resolveBrowserBinary({
      target: 'chrome',
      platform: 'linux',
      env: {},
      exists: (candidate) => candidate === expected,
    });

    expect(resolved).toEqual({
      binary: expected,
      requestedTarget: 'chrome',
      matchedTarget: 'chromium',
    });
  });

  it('does not fall back when fallback is disabled', () => {
    const resolved = resolveBrowserBinary({
      target: 'chrome',
      platform: 'linux',
      env: {},
      allowFallback: false,
      exists: (candidate) => candidate === '/usr/bin/chromium',
    });

    expect(resolved).toBeNull();
  });

  it('keeps the exact-target lookup free of fallbacks', () => {
    const binary = tryFindBrowserBinary({
      target: 'chrome',
      platform: 'linux',
      env: {},
      exists: (candidate) => candidate === '/usr/bin/chromium',
    });

    expect(binary).toBeNull();
  });

  it('resolves a configured launcher-only browser through fallback', () => {
    const resolved = resolveBrowserBinary({
      target: 'chrome',
      binaries: { brave: '/custom/brave' },
      platform: 'linux',
      env: {},
      exists: (candidate) => candidate === '/custom/brave',
    });

    expect(resolved?.binary).toBe('/custom/brave');
    expect(resolved?.matchedTarget).toBe('brave');
  });

  it('throws a missing-browser diagnostic', () => {
    try {
      findBrowserBinary({
        target: 'firefox',
        platform: 'linux',
        env: {},
        exists: () => false,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AddonovaError);
      expect((error as AddonovaError).diagnostic.code).toBe(
        'ADDONOVA_BROWSER_NOT_FOUND',
      );
      return;
    }

    throw new Error('Expected a browser-not-found error.');
  });
});
