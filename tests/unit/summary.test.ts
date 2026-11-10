import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import type { CliIo } from '../../src/cli/command.ts';
import { createCliStyle } from '../../src/cli/style.ts';
import { writeBuildSummary } from '../../src/cli/summary.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('build summary', () => {
  it('prints an ordered file tree with sizes and a total', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'addonova-summary-'));
    tempDirs.push(root);

    writeFileSync(path.join(root, 'manifest.json'), '{}');
    writeFileSync(path.join(root, 'popup.html'), '<html></html>');
    writeFileSync(path.join(root, 'background.js'), '0123456789');
    writeFileSync(path.join(root, 'style.css'), 'a');
    writeFileSync(path.join(root, 'icon.svg'), '<svg>');

    const output = createOutput(root);

    writeBuildSummary(output.io, createCliStyle(false), {
      label: 'Built chrome MV3',
      duration: 1_500,
      outdir: root,
      cwd: root,
    });

    const text = output.text();

    expect(text).toContain('✔ Built chrome MV3 in 1.500 s');
    expect(text).toContain('./manifest.json');
    expect(text.indexOf('manifest.json')).toBeLessThan(
      text.indexOf('popup.html'),
    );
    expect(text.indexOf('popup.html')).toBeLessThan(
      text.indexOf('background.js'),
    );
    expect(text.indexOf('background.js')).toBeLessThan(
      text.indexOf('style.css'),
    );
    expect(text.indexOf('style.css')).toBeLessThan(text.indexOf('icon.svg'));
    expect(text).toContain('Σ Total size: 31 B');
    expect(text).toContain('└─');
  });

  it('colors the tree when enabled', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'addonova-summary-'));
    tempDirs.push(root);

    writeFileSync(path.join(root, 'background.js'), 'export {};');

    const output = createOutput(root);

    writeBuildSummary(output.io, createCliStyle(true), {
      label: 'Built chrome MV3',
      duration: 20,
      outdir: root,
      cwd: root,
    });

    expect(output.text()).toContain('\u001B[');
  });
});

function createOutput(cwd: string): { io: CliIo; text: () => string } {
  let text = '';

  return {
    io: {
      cwd,
      stdout: {
        write(chunk: string) {
          text += chunk;
          return true;
        },
      },
      stderr: {
        write() {
          return true;
        },
      },
    },
    text: () => text,
  };
}
