import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { createHookManager } from '../../src/hooks/manager.ts';
import type { PublicAssetsHookPayload } from '../../src/hooks/types.ts';
import { resolveModules } from '../../src/modules/loader.ts';
import type {
  AddonovaModule,
  AddonovaModuleContext,
} from '../../src/modules/types.ts';
import type { AddonovaUserConfig, ResolvedConfig } from '../../src/core/config.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('module loader', () => {
  it('runs module setup with config options, entrypoints, aliases, and files', async () => {
    const root = createProject({
      'src/module.ts': 'export const value = "module";\n',
      'src/shared.ts': 'export const shared = "shared";\n',
    });
    const hooks = createHookManager();
    const events: string[] = [];
    let receivedOptions: unknown;
    const module: AddonovaModule = {
      name: 'demo',
      configKey: 'demo',
      setup(context) {
        receivedOptions = context.options;
        events.push('setup');
        context.addEntrypoint('module-page', 'src/module.ts');
        context.addAlias('@shared', './src/shared.ts');
        context.addAlias('shared-package', 'shared-package');
        context.addFile('generated/module.txt', 'from-module');
        context.hooks.on('build:publicAssets', () => {
          events.push('public-assets');
        });
      },
    };
    const config = {
      demo: { greeting: 'hello' },
      modules: [module],
    } as unknown as AddonovaUserConfig;

    const resolution = await resolveModules({
      root,
      configPath: path.join(root, 'addonova.config.ts'),
      config,
      mode: 'development',
      hooks,
    });

    expect(receivedOptions).toEqual({ greeting: 'hello' });
    expect(events).toEqual(['setup']);
    expect(resolution.modules).toEqual([module]);
    expect(resolution.files).toEqual([]);
    expect(resolution.entrypoints).toEqual([
      {
        name: 'module-page',
        input: path.join(root, 'src/module.ts'),
        kind: 'script',
      },
    ]);
    expect(resolution.alias).toEqual({
      '@shared': path.join(root, 'src/shared.ts'),
      'shared-package': 'shared-package',
    });
    expect(
      hooks.registrations.map((registration) => registration.event),
    ).toEqual(['build:publicAssets', 'build:publicAssets']);

    const assets: PublicAssetsHookPayload['assets'] = [];

    await hooks.run('build:publicAssets', {
      config: {} as ResolvedConfig,
      browser: { target: 'chrome', manifestVersion: 3, manifestOverrides: {} },
      outdir: path.join(root, 'dist'),
      assets,
    });

    expect(events).toEqual(['setup', 'public-assets']);
    expect(assets).toEqual([
      { path: 'generated/module.txt', contents: 'from-module' },
    ]);
  });

  it('loads configured modules before alphabetically sorted local modules', async () => {
    const root = createProject({
      'src/entry.ts': 'export {};\n',
      'modules/zeta.ts': `export default { name: 'zeta', setup() {} };\n`,
      'modules/alpha.ts': `export default { name: 'alpha', setup() {} };\n`,
      'modules/_ignored.ts': `export default { name: 'ignored', setup() {} };\n`,
      'modules/alpha.test.ts': `export default { name: 'test', setup() {} };\n`,
      'modules/types.d.ts': 'export interface Ignored {}\n',
    });
    const inline: AddonovaModule = {
      name: 'inline',
      setup() {},
    };

    const resolution = await resolveModules({
      root,
      configPath: null,
      config: { modules: [inline] } as AddonovaUserConfig,
      mode: 'production',
      hooks: createHookManager(),
    });

    expect(resolution.modules.map((module) => module.name)).toEqual([
      'inline',
      'alpha',
      'zeta',
    ]);
    expect(resolution.files).toEqual([
      path.join(root, 'modules/alpha.ts'),
      path.join(root, 'modules/zeta.ts'),
    ]);
  });

  it('reports duplicate and invalid modules', async () => {
    const root = createProject({});

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [
            { name: 'same', setup() {} },
            { name: 'same', setup() {} },
          ],
        } as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toHaveProperty('code', 'ADDONOVA_MODULE_DUPLICATE');

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [{ name: '', setup() {} }],
        } as unknown as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toHaveProperty('code', 'ADDONOVA_MODULE_INVALID');

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [{ name: 'broken' }],
        } as unknown as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toThrow('must provide a setup() function');
  });

  it('wraps setup failures with the module name', async () => {
    const root = createProject({});
    const error = new Error('setup exploded');

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [
            {
              name: 'broken-module',
              setup() {
                throw error;
              },
            },
          ],
        } as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toHaveProperty('code', 'ADDONOVA_MODULE_SETUP_FAILED');

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [
            {
              name: 'broken-module',
              setup() {
                throw error;
              },
            },
          ],
        } as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toThrow('Module "broken-module" failed during setup: setup exploded');
  });

  it('rejects invalid generated file paths and aliases', async () => {
    const root = createProject({});
    const moduleFor = (
      apply: (context: AddonovaModuleContext) => void,
      name = 'invalid-module',
    ): AddonovaModule => ({
      name,
      setup: apply,
    });

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [
            moduleFor((context) => {
              context.addFile('../escape.txt', 'nope');
            }),
          ],
        } as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toHaveProperty('code', 'ADDONOVA_MODULE_INVALID');

    await expect(
      resolveModules({
        root,
        configPath: null,
        config: {
          modules: [
            moduleFor((context) => {
              context.addAlias('', 'src/shared.ts');
            }, 'invalid-alias'),
          ],
        } as AddonovaUserConfig,
        mode: 'production',
        hooks: createHookManager(),
      }),
    ).rejects.toThrow('must provide a non-empty alias name and target');
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-modules-unit-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
