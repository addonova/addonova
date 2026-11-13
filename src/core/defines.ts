import type { BrowserTarget } from './types.ts';

export type RunAt =
  | 'document_start'
  | 'document_end'
  | 'document_idle';

export type ContentScriptWorld = 'ISOLATED' | 'MAIN';

export type CssInjectionMode = 'manifest' | 'manual' | 'none';

export interface ContentScriptContext {
  readonly isValid: boolean;
  onInvalidated(callback: () => void): () => void;
  setTimeout(
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ): ReturnType<typeof globalThis.setTimeout>;
  clearTimeout(id: ReturnType<typeof globalThis.setTimeout>): void;
  setInterval(
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ): ReturnType<typeof globalThis.setInterval>;
  clearInterval(id: ReturnType<typeof globalThis.setInterval>): void;
}

export interface BackgroundDefinition {
  persistent?: boolean;
  type?: 'module';
  main?: () => void | Promise<void>;
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  [key: string]: unknown;
}

export interface ContentScriptDefinition {
  matches?: readonly string[];
  excludeMatches?: readonly string[];
  includeGlobs?: readonly string[];
  excludeGlobs?: readonly string[];
  allFrames?: boolean;
  runAt?: RunAt;
  matchAboutBlank?: boolean;
  matchOriginAsFallback?: boolean;
  world?: ContentScriptWorld;
  cssInjectionMode?: CssInjectionMode;
  registration?: 'manifest' | 'runtime';
  include?: readonly string[];
  exclude?: readonly string[];
  main?: (context: ContentScriptContext) => void | Promise<void>;
  [key: string]: unknown;
}

export interface UnlistedScriptDefinition {
  main?: () => void | Promise<void>;
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  [key: string]: unknown;
}

export interface PageDefinition {
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  [key: string]: unknown;
}

export function defineBackground(
  definition: BackgroundDefinition | (() => void | Promise<void>),
): BackgroundDefinition {
  const resolved =
    typeof definition === 'function' ? { main: definition } : definition;

  runMain(resolved.main);

  return resolved;
}

export function defineContentScript(
  definition: ContentScriptDefinition,
): ContentScriptDefinition {
  if (definition.registration !== 'runtime') {
    runMain(definition.main, createContentScriptContext());
  }

  return definition;
}

export function defineUnlistedScript(
  definition: UnlistedScriptDefinition | (() => void | Promise<void>),
): UnlistedScriptDefinition {
  const resolved =
    typeof definition === 'function' ? { main: definition } : definition;

  runMain(resolved.main);

  return resolved;
}

export function definePage(
  definition: PageDefinition = {},
): PageDefinition {
  return definition;
}

export function createContentScriptContext(): ContentScriptContext {
  const invalidationHandlers = new Set<() => void>();
  let invalidated = false;

  const context: ContentScriptContext = {
    get isValid() {
      if (invalidated) {
        return false;
      }

      const runtime = getRuntime();

      return runtime === undefined || runtime.id !== undefined;
    },
    onInvalidated(callback) {
      invalidationHandlers.add(callback);

      return () => {
        invalidationHandlers.delete(callback);
      };
    },
    setTimeout(callback, delay, ...args) {
      return globalThis.setTimeout(() => {
        if (context.isValid) {
          callback(...args);
        }
      }, delay);
    },
    clearTimeout(id) {
      globalThis.clearTimeout(id);
    },
    setInterval(callback, delay, ...args) {
      let interval: ReturnType<typeof globalThis.setInterval>;

      interval = globalThis.setInterval(() => {
        if (!context.isValid) {
          globalThis.clearInterval(interval);

          for (const handler of invalidationHandlers) {
            try {
              handler();
            } catch {
              // Ignore invalidation handler failures.
            }
          }

          return;
        }

        callback(...args);
      }, delay);

      return interval;
    },
    clearInterval(id) {
      globalThis.clearInterval(id);
    },
  };

  return context;
}

interface RuntimeLike {
  id?: string;
}

function getRuntime(): RuntimeLike | undefined {
  const global = globalThis as {
    browser?: { runtime?: RuntimeLike };
    chrome?: { runtime?: RuntimeLike };
  };

  return global.browser?.runtime ?? global.chrome?.runtime;
}

function runMain<Args extends readonly unknown[]>(
  main: ((...args: Args) => void | Promise<void>) | undefined,
  ...args: Args
): void {
  if (typeof main !== 'function') {
    return;
  }

  try {
    const result = main(...args);

    if (
      result !== undefined &&
      result !== null &&
      typeof (result as Promise<void>).catch === 'function'
    ) {
      void (result as Promise<void>).catch(reportError);
    }
  } catch (error) {
    reportError(error);
  }
}

function reportError(error: unknown): void {
  console.error('[addonova] Entrypoint failed:', error);
}
