import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import {
  findConfigFile,
  resolveProjectConfig,
} from '../../src/core/config.ts';
import { AddonovaError } from '../../src/core/errors.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('configuration resolution', () => {
  it('loads a TypeScript config and normalizes paths, browsers, and entrypoints', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: {
    background: 'src/background.ts',
    popup: 'src/popup/index.html',
  },
  browsers: {
    chrome: { action: { default_title: 'Demo' } },
    firefox: {},
  },
  manifest: {
    name: 'Demo',
    version: '1.2.3',
    manifest_version: 2,
  },
  outdir: 'build',
  publicDir: 'static',
  minify: false,
  sourcemap: 'linked',
};
`,
      'src/background.ts': 'export {};\n',
      'src/popup/index.html': '<!doctype html><html></html>\n',
    });

    const config = await resolveProjectConfig({ cwd: root });

    expect(config.configPath).toBe(path.join(root, 'addonova.config.ts'));
    expect(config.root).toBe(root);
    expect(config.outdir).toBe(path.join(root, 'build'));
    expect(config.publicDir).toBe(path.join(root, 'static'));
    expect(config.mode).toBe('production');
    expect(config.minify).toBe(false);
    expect(config.sourcemap).toBe('linked');
    expect(config.manifest).toMatchObject({
      name: 'Demo',
      version: '1.2.3',
      manifest_version: 2,
    });
    expect(config.entrypoints).toEqual([
      {
        name: 'background',
        input: path.join(root, 'src/background.ts'),
        kind: 'script',
      },
      {
        name: 'popup',
        input: path.join(root, 'src/popup/index.html'),
        kind: 'html',
      },
    ]);
    expect(config.browsers).toEqual([
      {
        target: 'chrome',
        manifestVersion: 2,
        manifestOverrides: { action: { default_title: 'Demo' } },
      },
      {
        target: 'firefox',
        manifestVersion: 2,
        manifestOverrides: {},
      },
    ]);
  });

  it('finds the nearest config from a nested working directory', async () => {
    const root = createProject({
      'packages/app/addonova.config.json': JSON.stringify({
        entrypoints: ['src/one.ts', 'src/two.ts'],
      }),
      'packages/app/src/one.ts': 'export {};\n',
      'packages/app/src/two.ts': 'export {};\n',
    });
    const cwd = path.join(root, 'packages/app/src');

    expect(findConfigFile(cwd)).toBe(
      path.join(root, 'packages/app/addonova.config.json'),
    );

    const config = await resolveProjectConfig({ cwd });

    expect(config.root).toBe(path.join(root, 'packages/app'));
    expect(config.entrypoints.map((entrypoint) => entrypoint.name)).toEqual([
      'one',
      'two',
    ]);
    expect(config.browsers).toEqual([
      {
        target: 'chrome',
        manifestVersion: 3,
        manifestOverrides: {},
      },
    ]);
  });

  it('uses defaults when no config exists', async () => {
    const root = createProject({});

    const config = await resolveProjectConfig({ cwd: root });

    expect(config.configPath).toBeNull();
    expect(config.root).toBe(root);
    expect(config.entrypoints).toEqual([]);
    expect(config.manifest).toEqual({});
    expect(config.outdir).toBe(path.join(root, 'dist'));
    expect(config.publicDir).toBe(path.join(root, 'public'));
    expect(config.mode).toBe('production');
    expect(config.minify).toBe(true);
    expect(config.sourcemap).toBe(false);
    expect(config.browsers).toEqual([
      {
        target: 'chrome',
        manifestVersion: 3,
        manifestOverrides: {},
      },
    ]);
  });

  it('applies CLI overrides and development defaults', async () => {
    const root = createProject({});

    const config = await resolveProjectConfig({
      cwd: root,
      defaultMode: 'development',
      overrides: {
        browsers: ['firefox'],
        manifestVersion: 2,
        mode: 'production',
        outdir: 'cli-output',
        minify: true,
        sourcemap: 'inline',
      },
    });

    expect(config.mode).toBe('production');
    expect(config.minify).toBe(true);
    expect(config.sourcemap).toBe('inline');
    expect(config.outdir).toBe(path.join(root, 'cli-output'));
    expect(config.browsers).toEqual([
      {
        target: 'firefox',
        manifestVersion: 2,
        manifestOverrides: {},
      },
    ]);
  });

  it('normalizes native Windows separators in entrypoint paths', async () => {
    if (process.platform !== 'win32') {
      return;
    }

    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src\\\\background.ts' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    expect(config.entrypoints).toEqual([
      {
        name: 'background',
        input: path.join(root, 'src/background.ts'),
        kind: 'script',
      },
    ]);
  });

  it('rejects an explicit config path that does not exist', () => {
    const root = createProject({});

    expectConfigError(
      () => findConfigFile(root, 'missing.config.ts'),
      'ADDONOVA_CONFIG_NOT_FOUND',
    );
  });

  it('rejects invalid manifest versions', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  manifest: { manifest_version: 4 },
};
`,
    });

    await expectConfigErrorAsync(
      () => resolveProjectConfig({ cwd: root }),
      'ADDONOVA_CONFIG_MANIFEST',
    );
  });

  it('rejects duplicate entrypoint names and missing files', async () => {
    const duplicateRoot = createProject({
      'addonova.config.ts': `export default {
  entrypoints: ['src/one/background.ts', 'src/two/background.ts'],
};
`,
      'src/one/background.ts': 'export {};\n',
      'src/two/background.ts': 'export {};\n',
    });
    const missingRoot = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/missing.ts' },
};
`,
    });

    await expectConfigErrorAsync(
      () => resolveProjectConfig({ cwd: duplicateRoot }),
      'ADDONOVA_CONFIG_DUPLICATE_ENTRYPOINT',
    );
    await expectConfigErrorAsync(
      () => resolveProjectConfig({ cwd: missingRoot }),
      'ADDONOVA_CONFIG_ENTRYPOINT_MISSING',
    );
  });

  it('rejects unsupported browsers', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  browsers: ['safari'],
};
`,
    });

    await expectConfigErrorAsync(
      () => resolveProjectConfig({ cwd: root }),
      'ADDONOVA_CONFIG_BROWSER',
    );
  });

  it('reports config syntax and runtime load failures', async () => {
    const root = createProject({
      'addonova.config.ts': 'export default {',
    });

    await expectConfigErrorAsync(
      () => resolveProjectConfig({ cwd: root }),
      'ADDONOVA_CONFIG_LOAD_FAILED',
    );
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-config-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}

function expectConfigError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expectAddonovaError(error, code);
    return;
  }

  throw new Error(`Expected a ${code} error.`);
}

async function expectConfigErrorAsync(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    expectAddonovaError(error, code);
    return;
  }

  throw new Error(`Expected a ${code} error.`);
}

function expectAddonovaError(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(AddonovaError);
  expect((error as AddonovaError).diagnostic.code).toBe(code);
}
