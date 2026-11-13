import type { WebSocketConnection } from './websocket.ts';
import { connectWebSocket } from './websocket.ts';

export interface BidiClientOptions {
  timeoutMs?: number;
}

export interface BidiClient {
  call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T>;
  newSession(): Promise<void>;
  installWebExtension(extensionPath: string): Promise<string>;
  uninstallWebExtension(extensionId: string): Promise<void>;
  closeBrowser(): Promise<void>;
  dispose(): void;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface BidiResponse {
  id?: number;
  result?: unknown;
  error?: string;
  message?: string;
  stacktrace?: string;
}

export class BidiError extends Error {
  readonly method: string;

  constructor(method: string, message: string) {
    super(message);
    this.name = 'BidiError';
    this.method = method;
  }
}

export async function connectBidi(
  url: string,
  options: BidiClientOptions = {},
): Promise<BidiClient> {
  const connection = await connectWebSocket(url, {
    timeoutMs: options.timeoutMs ?? 10_000,
  });

  return createBidiClient(connection, options);
}

export function createBidiClient(
  connection: WebSocketConnection,
  options: BidiClientOptions = {},
): BidiClient {
  const defaultTimeoutMs = options.timeoutMs ?? 10_000;
  const pending = new Map<number, PendingRequest>();
  let nextId = 1;
  let disposed = false;

  const rejectPending = (error: Error): void => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }

    pending.clear();
  };

  const removeTextListener = connection.onText((text) => {
    let parsed: BidiResponse;

    try {
      parsed = JSON.parse(text) as BidiResponse;
    } catch {
      return;
    }

    if (typeof parsed.id !== 'number') {
      return;
    }

    const request = pending.get(parsed.id);

    if (request === undefined) {
      return;
    }

    pending.delete(parsed.id);
    clearTimeout(request.timer);

    if (parsed.error !== undefined) {
      request.reject(
        new BidiError(
          request.method,
          parsed.message ?? parsed.error ?? `BiDi command "${request.method}" failed.`,
        ),
      );
      return;
    }

    request.resolve(parsed.result);
  });

  const removeCloseListener = connection.onClose(() => {
    rejectPending(new Error('The browser BiDi connection closed.'));
  });

  const call = <T>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = defaultTimeoutMs,
  ): Promise<T> => {
    if (disposed || !connection.isOpen) {
      return Promise.reject(new Error('The browser BiDi connection is closed.'));
    }

    const id = nextId;
    nextId += 1;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(`BiDi command "${method}" timed out after ${timeoutMs}ms.`),
        );
      }, timeoutMs);

      pending.set(id, {
        method,
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
        timer,
      });

      try {
        connection.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(
          error instanceof Error
            ? error
            : new Error('Failed to send a WebDriver BiDi command.'),
        );
      }
    });
  };

  return {
    call,
    async newSession(): Promise<void> {
      await call('session.new', { capabilities: {} });
    },
    async installWebExtension(extensionPath: string): Promise<string> {
      const result = await call<{
        extension?: unknown;
        extensions?: readonly { extension?: unknown }[];
      }>('webExtension.install', {
        extensionData: {
          type: 'path',
          path: extensionPath,
        },
      });

      const extensionId =
        typeof result?.extension === 'string'
          ? result.extension
          : result?.extensions?.[0]?.extension;

      if (typeof extensionId !== 'string') {
        throw new BidiError(
          'webExtension.install',
          'The browser did not return an extension id.',
        );
      }

      return extensionId;
    },
    async uninstallWebExtension(extensionId: string): Promise<void> {
      await call('webExtension.uninstall', { extension: extensionId });
    },
    async closeBrowser(): Promise<void> {
      try {
        await call('browser.close', {}, 2_000);
      } catch {
        // The browser may already be shutting down.
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      rejectPending(new Error('The browser BiDi connection was closed.'));
      removeTextListener();
      removeCloseListener();
      connection.close();
    },
  };
}
