import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import type {
  BundlerAdapter,
  BundlerBuildInput,
  BundlerBuildResult,
  BundlerContext,
} from '../../src/bundler/adapter.ts';
import type { CliIo } from '../../src/cli/command.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';
import type { BrowserTarget } from '../../src/core/types.ts';
import { DEV_RELOAD_CLIENT_MARKER } from '../../src/dev/reload-client.ts';
import { createDevSession } from '../../src/dev/watcher.ts';
import type {
  BrowserLauncherFactory,
  DevWatcher,
} from '../../src/dev/watcher.ts';
import type { BrowserLauncher } from '../../src/launcher/types.ts';
import { connectWebSocket } from '../../src/launcher/websocket.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dev auto-reload integration', () => {
  it('injects the reload client and broadcasts rebuilds', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome'],
  manifest: { name: 'Reload Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'export {};\n',
    });
    const watcher = new FakeWatcher();
    const output = createIo(root);
    const launcher = new FakeLauncher('chrome');
    const launcherFactory: BrowserLauncherFactory = () => launcher;
    const config = await resolveProjectConfig({
      cwd: root,
      defaultMode: 'development',
      homeDir: path.join(root, 'home'),
    });
    const session = await createDevSession({
      config,
      io: output.io,
      adapter: new FakeAdapter(),
      debounceMs: 5,
      watcherFactory: () => watcher,
      launcherFactory,
    });

    const extensionDir = path.join(root, 'dist/chrome');
    const manifest = JSON.parse(
      readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'),
    ) as {
      name: string;
      permissions: string[];
      background: { service_worker?: string };
    };
    const backgroundPath = path.join(
      extensionDir,
      manifest.background.service_worker ?? '',
    );
    const background = readFileSync(backgroundPath, 'utf8');
    const reloadUrl = background.match(/ws:\/\/[^"]+/)?.[0];

    expect(manifest.name).toBe('Reload Demo (Development)');
    expect(manifest.permissions).toEqual(['tabs', 'scripting']);
    expect(background).toContain(DEV_RELOAD_CLIENT_MARKER);
    expect(reloadUrl).toBeDefined();

    const connection = await connectWebSocket(reloadUrl ?? '');
    const messages: string[] = [];

    connection.onText((message) => {
      messages.push(message);
    });

    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();
    await waitFor(() => messages.length > 0);

    expect(JSON.parse(messages[0] ?? '')).toEqual({ type: 'reload' });
    expect(launcher.launched).toBe(1);
    expect(launcher.reloaded).toBe(0);

    connection.close();
    await session.close();
  }, 30_000);

  it('emits structured debug logs and rebuild timing', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Debug Demo', version: '1.0.0' },
  minify: false,
  webExt: { disabled: true },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const watcher = new FakeWatcher();
    const output = createIo(root);
    const config = await resolveProjectConfig({
      cwd: root,
      defaultMode: 'development',
      homeDir: path.join(root, 'home'),
    });
    const session = await createDevSession({
      config,
      io: output.io,
      adapter: new FakeAdapter(),
      debounceMs: 5,
      watcherFactory: () => watcher,
      debug: true,
    });

    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(output.stderr()).toContain('"event":"dev.change"');
    expect(output.stderr()).toContain('"event":"dev.rebuild.cycle"');
    expect(output.stdout()).toContain('Rebuild finished in');

    await session.close();
  }, 30_000);
});

class FakeLauncher implements BrowserLauncher {
  extensionId = 'fake-extension';
  running = false;
  launched = 0;
  reloaded = 0;

  constructor(readonly target: BrowserTarget) {}

  get isRunning(): boolean {
    return this.running;
  }

  async launch(): Promise<void> {
    this.launched += 1;
    this.running = true;
  }

  async reload(): Promise<void> {
    this.reloaded += 1;
  }

  async close(): Promise<void> {
    this.running = false;
  }
}

class FakeAdapter implements BundlerAdapter {
  readonly name = 'fake';
  readonly version = '0.0.0';

  async build(): Promise<BundlerBuildResult> {
    throw new Error('The fake adapter only supports contexts.');
  }

  async createContext(input: BundlerBuildInput): Promise<BundlerContext> {
    return new FakeContext(input);
  }
}

class FakeContext implements BundlerContext {
  constructor(private readonly input: BundlerBuildInput) {}

  async rebuild(): Promise<BundlerBuildResult> {
    mkdirSync(this.input.outdir, { recursive: true });

    const outputPath = path.join(this.input.outdir, 'background.js');
    writeFileSync(outputPath, 'built\n');

    return {
      success: true,
      duration: 1,
      outputs: [{ path: outputPath, size: 6 }],
      inputs: [],
      errors: [],
      warnings: [],
    };
  }

  async dispose(): Promise<void> {}
}

class FakeWatcher implements DevWatcher {
  private readonly listeners: Array<(event: string, file: string) => void> = [];

  on(
    event: 'all',
    listener: (event: string, file: string) => void,
  ): void {
    if (event === 'all') {
      this.listeners.push(listener);
    }
  }

  emit(file: string): void {
    for (const listener of this.listeners) {
      listener('change', file);
    }
  }

  async close(): Promise<void> {}
}

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-dev-reload-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}

function createIo(
  cwd: string,
): { io: CliIo; stdout: () => string; stderr: () => string } {
  let stdout = '';
  let stderr = '';

  return {
    io: {
      cwd,
      stdout: {
        write(chunk: string) {
          stdout += chunk;
          return true;
        },
      },
      stderr: {
        write(chunk: string) {
          stderr += chunk;
          return true;
        },
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const started = Date.now();

  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for a condition.');
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}
