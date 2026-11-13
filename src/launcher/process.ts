import {
  spawn as nodeSpawn,
} from 'node:child_process';
import type {
  ChildProcess,
  SpawnOptions,
  StdioOptions,
} from 'node:child_process';

export type SpawnFunction = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export interface StartProcessOptions {
  command: string;
  args: readonly string[];
  stdio?: StdioOptions;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  spawn?: SpawnFunction;
}

export class LineReader {
  private readonly stream: NodeJS.ReadableStream;
  private readonly listeners = new Set<(line: string) => void>();
  private readonly recentLines: string[] = [];
  private buffer = '';
  private finished = false;
  private readonly handleData = (chunk: Buffer | string): void => {
    this.buffer += chunk.toString();

    let newlineIndex = this.buffer.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.emitLine(line);
      newlineIndex = this.buffer.indexOf('\n');
    }
  };
  private readonly handleEnd = (): void => {
    if (this.buffer.length > 0) {
      this.emitLine(this.buffer.replace(/\r$/, ''));
      this.buffer = '';
    }

    this.finished = true;
  };

  constructor(stream: NodeJS.ReadableStream) {
    this.stream = stream;
    this.stream.on('data', this.handleData);
    this.stream.once('end', this.handleEnd);
    this.stream.once('close', this.handleEnd);
  }

  onLine(listener: (line: string) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  waitForLine(
    predicate: (line: string) => boolean,
    timeoutMs: number,
  ): Promise<string> {
    const recent = [...this.recentLines]
      .reverse()
      .find((line) => predicate(line));

    if (recent !== undefined) {
      return Promise.resolve(recent);
    }

    if (this.finished) {
      return Promise.reject(
        new Error('Process output ended before the expected line was received.'),
      );
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for process output after ${timeoutMs}ms.`));
      }, timeoutMs);

      const removeListener = this.onLine((line) => {
        if (predicate(line)) {
          cleanup();
          resolve(line);
        }
      });

      const cleanup = (): void => {
        clearTimeout(timer);
        removeListener();
      };
    });
  }

  close(): void {
    this.stream.off('data', this.handleData);
    this.stream.off('end', this.handleEnd);
    this.stream.off('close', this.handleEnd);
    this.listeners.clear();
  }

  private emitLine(line: string): void {
    this.recentLines.push(line);

    if (this.recentLines.length > 50) {
      this.recentLines.shift();
    }

    for (const listener of this.listeners) {
      listener(line);
    }
  }
}

export class ManagedProcess {
  readonly child: ChildProcess;
  readonly stdout: LineReader | null;
  readonly stderr: LineReader | null;
  spawnError: Error | null = null;
  private exitCodeValue: number | null = null;
  private exitedValue = false;
  private resolveExit: (() => void) | null = null;
  private readonly exitListeners = new Set<() => void>();
  private readonly exitPromise: Promise<void>;
  private readonly handleExit = (
    code: number | null,
    _signal: NodeJS.Signals | null,
  ): void => {
    this.exitCodeValue = code;
    this.exitedValue = true;
    this.finish();
  };
  private readonly handleError = (error: Error): void => {
    this.spawnError = error;
    this.exitedValue = true;
    this.finish();
  };

  constructor(options: StartProcessOptions) {
    const spawn = options.spawn ?? nodeSpawn;

    this.child = spawn(
      options.command,
      [...options.args],
      {
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        env: options.env ?? process.env,
        stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    this.stdout = this.child.stdout === null
      ? null
      : new LineReader(this.child.stdout);
    this.stderr = this.child.stderr === null
      ? null
      : new LineReader(this.child.stderr);

    this.exitPromise = new Promise<void>((resolve) => {
      this.resolveExit = resolve;
    });

    this.child.once('exit', this.handleExit);
    this.child.once('error', this.handleError);

    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      this.exitCodeValue = this.child.exitCode;
      this.exitedValue = true;
      this.finish();
    }
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  get exited(): boolean {
    return this.exitedValue;
  }

  get exitCode(): number | null {
    return this.exitCodeValue;
  }

  get isRunning(): boolean {
    return !this.exitedValue;
  }

  onExit(listener: () => void): () => void {
    if (this.exitedValue) {
      listener();
      return () => {};
    }

    this.exitListeners.add(listener);

    return () => {
      this.exitListeners.delete(listener);
    };
  }

  async waitForExit(timeoutMs: number): Promise<boolean> {
    if (this.exitedValue) {
      return true;
    }

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => {
        resolve(false);
      }, timeoutMs);
    });
    const exited = this.exitPromise.then(() => true);
    const result = await Promise.race([exited, timeout]);

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    return result;
  }

  async terminate(gracePeriodMs = 2_000): Promise<void> {
    if (this.exitedValue) {
      this.dispose();
      return;
    }

    try {
      this.child.kill('SIGTERM');
    } catch {
      // The process may have exited between the check and the signal.
    }

    if (await this.waitForExit(gracePeriodMs)) {
      this.dispose();
      return;
    }

    if (process.platform === 'win32' && this.child.pid !== undefined) {
      await runTaskkill(this.child.pid);

      if (await this.waitForExit(gracePeriodMs)) {
        this.dispose();
        return;
      }
    }

    try {
      this.child.kill('SIGKILL');
    } catch {
      // The process may have exited before the signal was sent.
    }

    await this.waitForExit(1_000);
    this.dispose();
  }

  dispose(): void {
    this.stdout?.close();
    this.stderr?.close();
    this.child.off('exit', this.handleExit);
    this.child.off('error', this.handleError);
  }

  private finish(): void {
    for (const listener of this.exitListeners) {
      listener();
    }

    this.exitListeners.clear();
    this.resolveExit?.();
    this.resolveExit = null;
  }
}

export async function waitForOutputLine(
  readers: readonly (LineReader | null)[],
  predicate: (line: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const available = readers.filter(
    (reader): reader is LineReader => reader !== null,
  );

  if (available.length === 0) {
    throw new Error('The browser process does not expose stdout or stderr.');
  }

  return new Promise<string>((resolve, reject) => {
    const removers: Array<() => void> = [];

    const cleanup = (): void => {
      clearTimeout(timer);

      for (const remove of removers) {
        remove();
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for process output after ${timeoutMs}ms.`));
    }, timeoutMs);

    for (const reader of available) {
      removers.push(
        reader.onLine((line) => {
          if (predicate(line)) {
            cleanup();
            resolve(line);
          }
        }),
      );
    }
  });
}

function runTaskkill(pid: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const killer = nodeSpawn(
      'taskkill',
      ['/PID', String(pid), '/T', '/F'],
      {
        stdio: 'ignore',
        windowsHide: true,
      },
    );

    killer.once('exit', () => {
      resolve();
    });
    killer.once('error', () => {
      resolve();
    });
  });
}
