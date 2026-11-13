import { AddonovaError } from '../core/errors.ts';
import {
  HOOK_NAMES,
} from './types.ts';
import type {
  AddonovaHookMap,
  AddonovaHookName,
  AddonovaHooks,
  HookPayload,
  HookRegistration,
} from './types.ts';

export class HookManager {
  private readonly registrationsList: HookRegistration[] = [];

  constructor(registrations: readonly HookRegistration[] = []) {
    this.addAll(registrations);
  }

  get registrations(): readonly HookRegistration[] {
    return [...this.registrationsList];
  }

  add(owner: string, hooks: AddonovaHooks | undefined): void {
    if (hooks === undefined) {
      return;
    }

    for (const event of HOOK_NAMES) {
      const handler = hooks[event];

      if (handler !== undefined) {
        this.on(owner, event, handler);
      }
    }
  }

  on<K extends AddonovaHookName>(
    owner: string,
    event: K,
    handler: AddonovaHookMap[K],
  ): void {
    this.registrationsList.push({
      event,
      owner,
      handler: handler as HookRegistration['handler'],
    });
  }

  addRegistration(registration: HookRegistration): void {
    this.registrationsList.push(registration);
  }

  addAll(registrations: readonly HookRegistration[]): void {
    for (const registration of registrations) {
      this.addRegistration(registration);
    }
  }

  has(event: AddonovaHookName): boolean {
    return this.registrationsList.some(
      (registration) => registration.event === event,
    );
  }

  async run<K extends AddonovaHookName>(
    event: K,
    payload: HookPayload<K>,
  ): Promise<void> {
    for (const registration of this.registrationsList) {
      if (registration.event !== event) {
        continue;
      }

      try {
        await registration.handler(payload as never);
      } catch (error) {
        throw hookError(event, registration.owner, error);
      }
    }
  }
}

export function createHookManager(
  registrations: readonly HookRegistration[] = [],
): HookManager {
  return new HookManager(registrations);
}

export function toHookRegistrations(
  owner: string,
  hooks: AddonovaHooks | undefined,
): readonly HookRegistration[] {
  const manager = new HookManager();

  manager.add(owner, hooks);

  return manager.registrations;
}

export function validateHooks(
  rawHooks: unknown,
  configPath: string | null,
): AddonovaHooks | undefined {
  if (rawHooks === undefined) {
    return undefined;
  }

  if (!isPlainObject(rawHooks)) {
    throw new AddonovaError({
      code: 'ADDONOVA_CONFIG_HOOKS',
      severity: 'error',
      message: 'Config "hooks" must be an object.',
      suggestion: 'Use { "build:done": () => { ... } }.',
      ...(configPath === null ? {} : { location: { file: configPath } }),
    });
  }

  const hooks: AddonovaHooks = {};

  for (const [event, handler] of Object.entries(rawHooks)) {
    if (!isHookName(event)) {
      throw new AddonovaError({
        code: 'ADDONOVA_CONFIG_HOOKS',
        severity: 'error',
        message: `Unknown hook "${event}".`,
        suggestion: `Use one of: ${HOOK_NAMES.join(', ')}.`,
        ...(configPath === null ? {} : { location: { file: configPath } }),
      });
    }

    if (typeof handler !== 'function') {
      throw new AddonovaError({
        code: 'ADDONOVA_CONFIG_HOOKS',
        severity: 'error',
        message: `Hook "${event}" must be a function.`,
        suggestion: 'Remove the hook or provide a function.',
        ...(configPath === null ? {} : { location: { file: configPath } }),
      });
    }

    (hooks as Record<string, unknown>)[event] = handler;
  }

  return hooks;
}

export function hookError(
  event: AddonovaHookName,
  owner: string,
  cause: unknown,
): AddonovaError {
  const source = owner === 'config' ? 'configuration' : `module "${owner}"`;

  return new AddonovaError({
    code: 'ADDONOVA_HOOK_FAILED',
    severity: 'error',
    message: `Hook "${event}" from ${source} failed: ${errorMessage(cause)}`,
    suggestion: 'Fix the hook implementation or remove it from the build.',
    cause,
  });
}

function isHookName(value: string): value is AddonovaHookName {
  return (HOOK_NAMES as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
