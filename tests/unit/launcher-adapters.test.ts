import { describe, expect, it } from '@guchho/test';

import type { Diagnostic } from '../../src/core/errors.ts';
import type { BrowserTarget } from '../../src/core/types.ts';
import { buildChromiumArgs } from '../../src/launcher/adapters/chromium.ts';
import { buildFirefoxArgs } from '../../src/launcher/adapters/firefox.ts';
import type { LaunchBrowserOptions } from '../../src/launcher/adapters/types.ts';
import { createDefaultWebExtConfig } from '../../src/launcher/config.ts';
import type { ResolvedWebExtConfig } from '../../src/launcher/types.ts';

describe('browser adapter launch arguments', () => {
  it('includes the required Chromium flags', () => {
    const { options } = createOptions('chrome');

    const args = buildChromiumArgs(options);

    expect(args).toContain('--remote-debugging-pipe');
    expect(args).toContain('--enable-unsafe-extension-debugging');
    expect(args).toContain('--no-first-run');
    expect(args).toContain('--no-default-browser-check');
    expect(args).toContain(`--user-data-dir=${options.profile.path}`);
  });

  it('adds Chromium custom arguments and start URLs', () => {
    const { options } = createOptions('chrome', {
      chromiumArgs: ['--window-size=800,600'],
      startUrls: ['https://example.com'],
    });

    const args = buildChromiumArgs(options);

    expect(args).toContain('--window-size=800,600');
    expect(args[args.length - 1]).toBe('https://example.com');
  });

  it('ignores conflicting Chromium arguments with a warning', () => {
    const warnings: Diagnostic[] = [];
    const { options } = createOptions(
      'chrome',
      {
        chromiumArgs: [
          '--remote-debugging-port=9222',
          '--disable-extensions',
          '--window-size=800,600',
        ],
      },
      warnings,
    );

    const args = buildChromiumArgs(options);

    expect(args).not.toContain('--remote-debugging-port=9222');
    expect(args).not.toContain('--disable-extensions');
    expect(args).toContain('--window-size=800,600');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]?.code).toBe('ADDONOVA_BROWSER_ARG_IGNORED');
  });

  it('adds --load-extension when a directory is provided', () => {
    const { options } = createOptions('chrome');

    const args = buildChromiumArgs(options, '/project/dist/chrome');

    expect(args).toContain('--load-extension=/project/dist/chrome');
  });

  it('includes the required Firefox flags', () => {
    const { options } = createOptions('firefox');

    const args = buildFirefoxArgs(options);

    expect(args).toContain('--new-instance');
    expect(args).toContain('--no-remote');
    expect(args).toContain('--profile');
    expect(args).toContain(options.profile.path);
    expect(args).toContain('--remote-debugging-port=0');
  });

  it('adds Firefox custom arguments and start URLs', () => {
    const { options } = createOptions('firefox', {
      firefoxArgs: ['--width=1280'],
      startUrls: ['https://example.com'],
    });

    const args = buildFirefoxArgs(options);

    expect(args).toContain('--width=1280');
    expect(args[args.length - 1]).toBe('https://example.com');
  });

  it('ignores conflicting Firefox arguments with a warning', () => {
    const warnings: Diagnostic[] = [];
    const { options } = createOptions(
      'firefox',
      {
        firefoxArgs: ['--remote-debugging-port=9222', '--width=1280'],
      },
      warnings,
    );

    const args = buildFirefoxArgs(options);

    expect(args).not.toContain('--remote-debugging-port=9222');
    expect(args).toContain('--width=1280');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('ADDONOVA_BROWSER_ARG_IGNORED');
  });
});

function createOptions(
  target: BrowserTarget,
  config: Partial<ResolvedWebExtConfig> = {},
  warnings: Diagnostic[] = [],
): { options: LaunchBrowserOptions } {
  return {
    options: {
      target,
      binary: `/browsers/${target}`,
      extensionDir: '/project/dist/chrome',
      profile: { path: '/tmp/addonova-profile', persistent: false },
      config: { ...createDefaultWebExtConfig(), ...config },
      projectRoot: '/project',
      env: {},
      onWarning: (diagnostic) => {
        warnings.push(diagnostic);
      },
    },
  };
}
