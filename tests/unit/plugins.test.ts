import { describe, expect, it } from '@guchho/test';

import {
  createPluginManager,
  mergePluginDiagnostics,
  validatePlugins,
} from '../../src/plugins/manager.ts';
import type { AddonovaPlugin } from '../../src/plugins/types.ts';

describe('plugin manager', () => {
  it('validates plugin names, hooks, and deterministic registration', () => {
    expect(() => validatePlugins([{ name: '' }])).toThrow('non-empty name');
    expect(() =>
      validatePlugins([{ name: 'same' }, { name: 'same' }]),
    ).toThrow('Duplicate plugin name');
    expect(() =>
      validatePlugins([
        { name: 'bad-hook', transform: 'not-a-function' },
      ] as unknown as readonly AddonovaPlugin[]),
    ).toThrow('must be a function');
    expect(validatePlugins(undefined)).toEqual([]);
  });

  it('runs lifecycle hooks and transforms in registration order', async () => {
    const events: string[] = [];
    const plugins: readonly AddonovaPlugin[] = [
      {
        name: 'first',
        buildStart() {
          events.push('first:start');
        },
        transform(code) {
          events.push('first:transform');

          return `${code}-1`;
        },
        buildEnd() {
          events.push('first:end');
        },
      },
      {
        name: 'second',
        buildStart() {
          events.push('second:start');
        },
        transform(code) {
          events.push('second:transform');

          return `${code}-2`;
        },
        buildEnd() {
          events.push('second:end');
        },
      },
    ];
    const manager = createPluginManager(plugins);

    expect(manager.plugins.map((plugin) => plugin.name)).toEqual([
      'first',
      'second',
    ]);
    expect(manager.transforms.map((transform) => transform.name)).toEqual([
      'first',
      'second',
    ]);

    await manager.buildStart();

    let code = 'code';

    for (const transform of manager.transforms) {
      code = (await transform.transform(code, '/project/src/entry.ts')) ?? code;
    }

    await manager.buildEnd();

    expect(code).toBe('code-1-2');
    expect(events).toEqual([
      'first:start',
      'second:start',
      'first:transform',
      'second:transform',
      'first:end',
      'second:end',
    ]);
  });

  it('reports transform failures with plugin name and source location', async () => {
    const manager = createPluginManager([
      {
        name: 'failing-plugin',
        transform() {
          throw new Error('transform exploded');
        },
      },
    ]);
    const transform = manager.transforms[0];

    expect(transform).toBeDefined();

    if (transform === undefined) {
      throw new Error('Expected one plugin transform.');
    }

    await expect(
      transform.transform('code', '/project/src/background.ts'),
    ).rejects.toThrow('transform exploded');

    const diagnostics = manager.takeDiagnostics();

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
      severity: 'error',
      location: { file: '/project/src/background.ts' },
    });
    expect(diagnostics[0]?.message).toContain('failing-plugin');
    expect(diagnostics[0]?.message).toContain('transform exploded');
    expect(manager.takeDiagnostics()).toHaveLength(0);
  });

  it('replaces adapter plugin failures with precise diagnostics', () => {
    const result = {
      success: true,
      duration: 5,
      outputs: [],
      inputs: [],
      warnings: [],
      errors: [
        {
          code: 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
          severity: 'error' as const,
          message: 'Guchho wrapper message',
        },
      ],
    };
    const merged = mergePluginDiagnostics(result, [
      {
        code: 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
        severity: 'error',
        message: 'Precise plugin diagnostic.',
        location: { file: '/project/src/background.ts' },
      },
    ]);

    expect(merged.success).toBe(false);
    expect(merged.errors).toHaveLength(1);
    expect(merged.errors[0]).toMatchObject({
      message: 'Precise plugin diagnostic.',
      location: { file: '/project/src/background.ts' },
    });
  });

  it('reports lifecycle hook failures with the plugin name', async () => {
    const startManager = createPluginManager([
      {
        name: 'boot-plugin',
        buildStart() {
          throw new Error('start failed');
        },
      },
    ]);
    const endManager = createPluginManager([
      {
        name: 'shutdown-plugin',
        buildEnd() {
          throw new Error('end failed');
        },
      },
    ]);

    await expect(startManager.buildStart()).rejects.toHaveProperty(
      'code',
      'ADDONOVA_PLUGIN_BUILD_START_FAILED',
    );
    await expect(startManager.buildStart()).rejects.toThrow('boot-plugin');
    await expect(endManager.buildEnd()).rejects.toHaveProperty(
      'code',
      'ADDONOVA_PLUGIN_BUILD_END_FAILED',
    );
    await expect(endManager.buildEnd()).rejects.toThrow('shutdown-plugin');
  });
});
