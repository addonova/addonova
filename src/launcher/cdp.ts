import type { ChildProcess } from 'node:child_process';

export interface CdpClientOptions {
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  timeoutMs?: number;
}

export interface CdpClient {
  call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T>;
  loadUnpacked(extensionPath: string): Promise<string>;
  uninstall(extensionId: string): Promise<void>;
  getExtensions(): Promise<unknown>;
  closeBrowser(): Promise<void>;
  dispose(): void;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface CdpResponse {
  id?: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: string;
  };
}

export class CdpError extends Error {
  readonly code: number | undefined;
  readonly method: string;

  constructor(method: string, message: string, code?: number) {
    super(message);
    this.name = 'CdpError';
    this.method = method;
    this.code = code;
  }
}

export function createCdpClient(options: CdpClientOptions): CdpClient {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pending = new Map<number, PendingRequest>();
  let nextId = 1;
  let buffer = '';
  let disposed = false;

  const handleData = (chunk: Buffer | string): void => {
    buffer += chunk.toString();

    let separatorIndex = buffer.indexOf('\0');

    while (separatorIndex !== -1) {
      const message = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 1);
      handleMessage(message);
      separatorIndex = buffer.indexOf('\0');
    }
  };

  const handleMessage = (message: string): void => {
    if (message.length === 0) {
      return;
    }

    let parsed: CdpResponse;

    try {
      parsed = JSON.parse(message) as CdpResponse;
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
        new CdpError(
          request.method,
          parsed.error.message ?? `CDP command "${request.method}" failed.`,
          parsed.error.code,
        ),
      );
      return;
    }

    request.resolve(parsed.result);
  };

  const handleEnd = (): void => {
    rejectPending(new Error('The browser CDP connection closed.'));
  };

  const rejectPending = (error: Error): void => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }

    pending.clear();
  };

  options.stdout.on('data', handleData);
  options.stdout.once('end', handleEnd);
  options.stdout.once('close', handleEnd);

  const call = <T>(
    method: string,
    params: Record<string, unknown> = {},
    requestTimeoutMs = timeoutMs,
  ): Promise<T> => {
    if (disposed) {
      return Promise.reject(new Error('The browser CDP connection is closed.'));
    }

    const id = nextId;
    nextId += 1;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(`CDP command "${method}" timed out after ${requestTimeoutMs}ms.`),
        );
      }, requestTimeoutMs);

      pending.set(id, {
        method,
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
        timer,
      });

      try {
        options.stdin.write(`${JSON.stringify({ id, method, params })}\0`);
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(
          error instanceof Error
            ? error
            : new Error('Failed to write to the browser CDP pipe.'),
        );
      }
    });
  };

  return {
    call,
    async loadUnpacked(extensionPath: string): Promise<string> {
      const result = await call<{ id?: unknown }>(
        'Extensions.loadUnpacked',
        { path: extensionPath },
      );

      if (typeof result?.id !== 'string') {
        throw new CdpError(
          'Extensions.loadUnpacked',
          'The browser did not return an extension id.',
        );
      }

      return result.id;
    },
    async uninstall(extensionId: string): Promise<void> {
      await call('Extensions.uninstall', { id: extensionId });
    },
    async getExtensions(): Promise<unknown> {
      return call('Extensions.getExtensions');
    },
    async closeBrowser(): Promise<void> {
      try {
        await call('Browser.close', {}, 2_000);
      } catch {
        // The browser may already be shutting down.
      }
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      rejectPending(new Error('The browser CDP connection was closed.'));
      options.stdout.off('data', handleData);
      options.stdout.off('end', handleEnd);
      options.stdout.off('close', handleEnd);
    },
  };
}

export function connectCdpPipe(
  child: ChildProcess,
  timeoutMs = 10_000,
): CdpClient {
  const outgoing = child.stdio[3];
  const incoming = child.stdio[4];

  if (
    outgoing === null ||
    outgoing === undefined ||
    incoming === null ||
    incoming === undefined
  ) {
    throw new Error(
      'The browser process did not expose the CDP pipe file descriptors.',
    );
  }

  return createCdpClient({
    stdin: outgoing as NodeJS.WritableStream,
    stdout: incoming as NodeJS.ReadableStream,
    timeoutMs,
  });
}

export function isMethodNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('not found') ||
    message.includes("wasn't found") ||
    message.includes('not supported') ||
    message.includes('unknown method')
  );
}
