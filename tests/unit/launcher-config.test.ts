import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { resolveProjectConfig } from '../../src/core/config.ts';
import { AddonovaError } from '../../src/core/errors.ts';
import {
  createDefaultWebExtConfig,
  defineWebExtConfig,
  mergeWebExtConfig,
} from '../../src/launcher/config.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('web-ext configuration', () => {
  it('provides launcher defaults', async () => {
    const root = createProject({});
    const config = await resolveProjectConfig({
      cwd: root,
      homeDir: path.join(root, 'home'),
    });

    expect(config.webExt).toEqual(createDefaultWebExtConfig());
  });

  it('merges global, project config, and project web-ext config by precedence', async () => {
    const root = createProject({
      'home/.addonova/web-ext.config.ts': `export default {
  binaries: { chrome: '/global/chrome' },
  chromiumArgs: ['--global'],
  startUrls: ['https://global.example'],
};
`,
      'addonova.config.ts': `export default {
  webExt: {
    binaries: {
      chrome: '/config/chrome',
      firefox: '/config/firefox',
    },
    chromiumArgs: ['--config'],
    keepProfileChanges: true,
  },
};
`,
      'web-ext.config.ts': `export default {
  disabled: true,
  binaries: { edge: '/project/edge' },
  startUrls: ['https://project.example'],
};
`,
    });

    const config = await resolveProjectConfig({
      cwd: root,
      homeDir: path.join(root, 'home'),
    });

    expect(config.webExt).toEqual({
      disabled: true,
      binaries: {
        chrome: '/config/chrome',
        firefox: '/config/firefox',
        edge: '/project/edge',
      },
      chromiumArgs: ['--config'],
      firefoxArgs: [],
      chromiumProfile: null,
      firefoxProfile: null,
      keepProfileChanges: true,
      startUrls: ['https://project.example'],
    });
  });

  it('merges binary maps without replacing unrelated targets', () => {
    expect(
      mergeWebExtConfig(
        { binaries: { chrome: '/chrome', firefox: '/firefox' } },
        { binaries: { chrome: '/override', edge: '/edge' } },
      ),
    ).toEqual({
      binaries: {
        chrome: '/override',
        firefox: '/firefox',
        edge: '/edge',
      },
    });
  });

  it('replaces arrays instead of concatenating them', () => {
    expect(
      mergeWebExtConfig(
        { chromiumArgs: ['--one'], startUrls: ['https://one.example'] },
        { chromiumArgs: ['--two'], startUrls: ['https://two.example'] },
      ),
    ).toEqual({
      chromiumArgs: ['--two'],
      startUrls: ['https://two.example'],
    });
  });

  it('preserves defineWebExtConfig input', () => {
    const input = { disabled: true, binaries: { chrome: '/chrome' } };

    expect(defineWebExtConfig(input)).toBe(input);
  });

  it('rejects invalid web-ext options', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  webExt: { disabled: 'yes' },
};
`,
    });

    await expectError(
      () =>
        resolveProjectConfig({
          cwd: root,
          homeDir: path.join(root, 'home'),
        }),
      'ADDONOVA_WEB_EXT_CONFIG_INVALID',
    );
  });

  it('rejects unsupported binary targets', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  webExt: { binaries: { safari: '/safari' } },
};
`,
    });

    await expectError(
      () =>
        resolveProjectConfig({
          cwd: root,
          homeDir: path.join(root, 'home'),
        }),
      'ADDONOVA_WEB_EXT_CONFIG_INVALID',
    );
  });

  it('reports project web-ext config load failures', async () => {
    const root = createProject({
      'web-ext.config.ts': 'export default {',
    });

    await expectError(
      () =>
        resolveProjectConfig({
          cwd: root,
          homeDir: path.join(root, 'home'),
        }),
      'ADDONOVA_WEB_EXT_CONFIG_LOAD_FAILED',
    );
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-web-ext-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}

async function expectError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(AddonovaError);
    expect((error as AddonovaError).diagnostic.code).toBe(code);
    return;
  }

  throw new Error(`Expected a ${code} error.`);
}
