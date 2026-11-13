import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { discoverIcons } from '../../src/browser/icons.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('icon discovery', () => {
  it('discovers icons, theme pairs, and reports partial sets', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'addonova-icons-'));
    tempDirs.push(root);
    mkdirSync(path.join(root, 'icons'));
    writeFileSync(path.join(root, 'icons', 'icon-16.png'), 'png');
    writeFileSync(path.join(root, 'icons', 'icon-32.svg'), 'svg');
    writeFileSync(path.join(root, 'icons', 'icon-light-48.png'), 'png');
    writeFileSync(path.join(root, 'icons', 'icon-dark-48.png'), 'png');
    writeFileSync(path.join(root, 'icons', 'icon-light-96.png'), 'png');
    writeFileSync(path.join(root, 'icons', 'icon-bad.png'), 'png');

    const discovered = discoverIcons(root);

    expect(discovered.icons).toEqual({
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.svg',
    });
    expect(discovered.themeIcons).toEqual([
      {
        light: 'icons/icon-light-48.png',
        dark: 'icons/icon-dark-48.png',
        size: 48,
      },
    ]);
    expect(discovered.warnings).toHaveLength(2);
    expect(discovered.warnings[0]).toContain('unsupported icon file');
    expect(discovered.warnings[1]).toContain('no matching dark theme icon');
  });
});
