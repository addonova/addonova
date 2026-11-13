import { EventEmitter } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';

import { afterEach, describe, expect, it } from '@guchho/test';

import { createDefaultWebExtConfig } from '../../src/launcher/config.ts';
import { createBrowserLauncher } from '../../src/launcher/launcher.ts';
import type { SpawnFunction } from '../../src/launcher/process.ts';
import type { ResolvedWebExtConfig } from '../../src/launcher/types.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('browser launcher lifecycle', () => {
  it('launches a browser and loads the extension through the CDP pipe', async () => {
    const project = createProject();
    const fake = createFakeSpawn();
    const launcher = createLauncher(project, fake.spawn);

    await launcher.launch();

    expect(launcher.isRunning).toBe(true);
    expect(launcher.extensionId).toBe(`ext-${fake.children[0]?.pid}-1`);
    expect(fake.children[0]?.requests[0]?.method).toBe('Extensions.loadUnpacked');
    expect(spawnedArgs(fake, 0)).toContain('--remote-debugging-pipe');

    await launcher.close();
  });

  it('reloads the extension after a rebuild', async () => {
    const project = createProject();
    const fake = createFakeSpawn();
    const launcher = createLauncher(project, fake.spawn);

    await launcher.launch();
    await launcher.reload();

    const child = fake.children[0];
    expect(child?.requests.map((request) => request.method)).toEqual([
      'Extensions.loadUnpacked',
      'Extensions.uninstall',
      'Extensions.loadUnpacked',
    ]);
    expect(launcher.extensionId).toBe(`ext-${child?.pid}-2`);

    await launcher.close();
  });

  it('relaunches the browser after an unexpected exit', async () => {
    const project = createProject();
    const fake = createFakeSpawn();
    const launcher = createLauncher(project, fake.spawn);

    await launcher.launch();
    fake.children[0]?.exitFromBrowser(1);

    expect(launcher.isRunning).toBe(false);

    await launcher.reload();

    expect(fake.children).toHaveLength(2);
    expect(launcher.isRunning).toBe(true);

    await launcher.close();
  });

  it('closes gracefully and removes an isolated profile', async () => {
    const project = createProject();
    const fake = createFakeSpawn();
    const launcher = createLauncher(project, fake.spawn);

    await launcher.launch();
    const profilePath = readProfilePath(fake, 0);

    expect(existsSync(profilePath)).toBe(true);

    await launcher.close();

    expect(launcher.isRunning).toBe(false);
    expect(existsSync(profilePath)).toBe(false);
  });

  it('keeps persistent profiles after shutdown', async () => {
    const project = createProject();
    const fake = createFakeSpawn();
    const launcher = createLauncher(project, fake.spawn, {
      keepProfileChanges: true,
    });

    await launcher.launch();
    const profilePath = readProfilePath(fake, 0);

    await launcher.close();

    expect(profilePath).toBe(
      path.join(project.root, '.addonova', 'browser-profiles', 'chrome'),
    );
    expect(existsSync(profilePath)).toBe(true);
  });
});

interface FakeProject {
  root: string;
  binary: string;
  extensionDir: string;
}

function createProject(): FakeProject {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-launcher-'));
  tempDirs.push(root);
  const binary = path.join(root, 'fake-browser');
  const extensionDir = path.join(root, 'dist', 'chrome');
  writeFileSync(binary, '');
  mkdirSync(extensionDir, { recursive: true });

  return { root, binary, extensionDir };
}

function createLauncher(
  project: FakeProject,
  spawn: SpawnFunction,
  config: Partial<ResolvedWebExtConfig> = {},
) {
  return createBrowserLauncher({
    target: 'chrome',
    extensionDir: project.extensionDir,
    projectRoot: project.root,
    config: {
      ...createDefaultWebExtConfig(),
      binaries: { chrome: project.binary },
      ...config,
    },
    spawn,
    launchTimeoutMs: 1_000,
    protocolTimeoutMs: 1_000,
  });
}

interface SentMessage {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

class FakeChild extends EventEmitter {
  readonly pid: number;
  readonly args: string[];
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdio: Array<PassThrough | null>;
  readonly requests: SentMessage[] = [];
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  private loadCount = 0;

  constructor(index: number, args: readonly string[]) {
    super();
    this.pid = 5_000 + index;
    this.args = [...args];
    const outgoing = new PassThrough();
    const incoming = new PassThrough();
    this.stdio = [null, this.stdout, this.stderr, outgoing, incoming];

    let buffer = '';
    outgoing.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString();

      let separatorIndex = buffer.indexOf('\0');

      while (separatorIndex !== -1) {
        const message = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 1);

        if (message.length > 0) {
          this.handleRequest(JSON.parse(message) as SentMessage, incoming);
        }

        separatorIndex = buffer.indexOf('\0');
      }
    });
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    if (this.signalCode !== null || this.exitCode !== null) {
      return true;
    }

    this.signalCode = signal;
    setImmediate(() => {
      this.emit('exit', null, signal);
    });

    return true;
  }

  exitFromBrowser(code = 0): void {
    if (this.signalCode !== null || this.exitCode !== null) {
      return;
    }

    this.exitCode = code;
    this.emit('exit', code, null);
  }

  private handleRequest(
    message: SentMessage,
    incoming: PassThrough,
  ): void {
    this.requests.push(message);
    let result: Record<string, unknown> = {};

    if (message.method === 'Extensions.loadUnpacked') {
      this.loadCount += 1;
      result = { id: `ext-${this.pid}-${this.loadCount}` };
    }

    incoming.write(`${JSON.stringify({ id: message.id, result })}\0`);
  }
}

function createFakeSpawn(): {
  spawn: SpawnFunction;
  children: FakeChild[];
} {
  const children: FakeChild[] = [];
  const spawn: SpawnFunction = (_command, args) => {
    const child = new FakeChild(children.length, args);
    children.push(child);
    return child as unknown as ChildProcess;
  };

  return { spawn, children };
}

function spawnedArgs(
  fake: { children: FakeChild[] },
  index: number,
): string[] {
  return fake.children[index]?.args ?? [];
}

function readProfilePath(
  fake: { children: FakeChild[] },
  index: number,
): string {
  const args = spawnedArgs(fake, index);
  const profileArg = args.find((argument) =>
    argument.startsWith('--user-data-dir='),
  );

  if (profileArg === undefined) {
    throw new Error('The launch did not include a profile directory.');
  }

  return profileArg.slice('--user-data-dir='.length);
}
