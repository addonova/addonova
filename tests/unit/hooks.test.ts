import { describe, expect, it } from '@guchho/test';

import {
  createHookManager,
  hookError,
  toHookRegistrations,
  validateHooks,
} from '../../src/hooks/manager.ts';
import { HOOK_NAMES } from '../../src/hooks/types.ts';
import type { BuildDoneHookPayload } from '../../src/hooks/types.ts';
import type { ResolvedConfig } from '../../src/core/config.ts';

const payload = { config: {} as ResolvedConfig, reports: [] } as BuildDoneHookPayload;

describe('hook manager', () => {
  it('registers every documented hook name', () => {
    expect([...HOOK_NAMES].sort()).toEqual(
      [
        'build:done',
        'build:manifestGenerated',
        'build:publicAssets',
        'config:resolved',
        'dev:reload',
        'entrypoints:found',
        'entrypoints:resolved',
      ].sort(),
    );
  });

  it('runs hooks in registration order and tracks owners', async () => {
    const events: string[] = [];
    const manager = createHookManager();

    manager.add('config', {
      'build:done': () => {
        events.push('config');
      },
    });
    manager.add('module-b', {
      'build:done': () => {
        events.push('module-b');
      },
    });
    manager.add('module-a', {
      'build:done': () => {
        events.push('module-a');
      },
    });

    expect(manager.registrations.map((registration) => registration.owner)).toEqual(
      ['config', 'module-b', 'module-a'],
    );
    expect(manager.has('build:done')).toBe(true);
    expect(manager.has('dev:reload')).toBe(false);

    await manager.run('build:done', payload);

    expect(events).toEqual(['config', 'module-b', 'module-a']);
  });

  it('converts typed hooks into owned registrations', () => {
    const handler = (): void => {};

    expect(toHookRegistrations('config', undefined)).toEqual([]);
    expect(
      toHookRegistrations('config', { 'config:resolved': handler }),
    ).toEqual([
      {
        event: 'config:resolved',
        owner: 'config',
        handler,
      },
    ]);
  });

  it('wraps hook failures with the event, owner, and cause', async () => {
    const manager = createHookManager();
    const cause = new Error('boom');

    manager.add('my-module', {
      'build:done': () => {
        throw cause;
      },
    });

    await expect(manager.run('build:done', payload)).rejects.toThrow(
      'Hook "build:done" from module "my-module" failed: boom',
    );

    const wrapped = hookError('config:resolved', 'config', cause);

    expect(wrapped).toMatchObject({
      name: 'AddonovaError',
      message: 'Hook "config:resolved" from configuration failed: boom',
      diagnostic: {
        code: 'ADDONOVA_HOOK_FAILED',
        severity: 'error',
        cause,
      },
    });
    expect(wrapped.code).toBe('ADDONOVA_HOOK_FAILED');
    expect(wrapped.message).toContain('from configuration failed');
  });

  it('validates hook configuration shape and names', () => {
    expect(validateHooks(undefined, null)).toBeUndefined();

    expect(() => validateHooks([], null)).toThrow('must be an object');
    expect(() => validateHooks({ 'unknown:event': () => {} }, null)).toThrow(
      'Unknown hook "unknown:event"',
    );
    expect(() =>
      validateHooks({ 'build:done': 'not-a-function' }, null),
    ).toThrow('must be a function');

    const hooks = validateHooks(
      { 'build:done': () => {} },
      '/project/addonova.config.ts',
    );

    expect(Object.keys(hooks ?? {})).toEqual(['build:done']);
  });
});
