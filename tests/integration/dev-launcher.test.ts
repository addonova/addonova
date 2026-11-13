import {
  mkdirSync,
  mkdtempSync,
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
import { AddonovaError } from '../../src/core/errors.ts';
import { createDevSession } from '../../src/dev/watcher.ts';
import type {
  BrowserLauncherFactory,
  DevWatcher,
} from '../../src/dev/watcher.ts';
import type { BrowserTarget } from '../../src/core/types.ts';
import type { BrowserLauncher } from '../../src/launcher/types.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dev browser launcher integration', () => {
  it('launches, reloads, and closes configured browsers', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome', 'firefox'],
  manifest: { name: 'Launcher Dev', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'export {};\n',
    });
    const watcher = new FakeWatcher();
    const output = createIo(root);
    const launchers = new Map<BrowserTarget, FakeLauncher>();
    const factoryCalls: Array<{
      target: BrowserTarget;
      extensionDir: string;
    }> = [];
    const launcherFactory: BrowserLauncherFactory = (
      target,
      _config,
      extensionDir,
    ) => {
      factoryCalls.push({ target, extensionDir });

      const launcher = new FakeLauncher(target);
      launchers.set(target, launcher);

      return launcher;
    };
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

    expect(factoryCalls).toEqual([
      {
        target: 'chrome',
        extensionDir: path.join(root, 'dist/chrome'),
      },
      {
        target: 'firefox',
        extensionDir: path.join(root, 'dist/firefox'),
      },
    ]);
    expect(launchers.get('chrome')?.launched).toBe(1);
    expect(launchers.get('firefox')?.launched).toBe(1);

    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(launchers.get('chrome')?.reloaded).toBe(1);
    expect(launchers.get('firefox')?.reloaded).toBe(1);

    await session.close();

    expect(launchers.get('chrome')?.closed).toBe(1);
    expect(launchers.get('firefox')?.closed).toBe(1);
  }, 30_000);

  it('does not create launchers when webExt.disabled is true', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Disabled Launcher', version: '1.0.0' },
  minify: false,
  webExt: { disabled: true },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const watcher = new FakeWatcher();
    const output = createIo(root);
    let factoryCalls = 0;
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
      launcherFactory: () => {
        factoryCalls += 1;
        throw new Error('Launcher factory should not be called.');
      },
    });

    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(factoryCalls).toBe(0);

    await session.close();
  }, 30_000);

  it('warns about launch failures and retries on the next rebuild', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Retry Launcher', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'export {};\n',
    });
    const watcher = new FakeWatcher();
    const output = createIo(root);
    const launcher = new FakeLauncher('chrome');
    launcher.failLaunch = true;
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
      launcherFactory: () => launcher,
    });

    expect(launcher.launched).toBe(1);
    expect(output.stderr()).toContain('Synthetic launch failure');

    launcher.failLaunch = false;
    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(launcher.launched).toBe(2);
    expect(session.isClosed).toBe(false);

    await session.close();
  }, 30_000);
});

class FakeLauncher implements BrowserLauncher {
  extensionId = 'fake-extension';
  running = false;
  launched = 0;
  reloaded = 0;
  closed = 0;
  failLaunch = false;

  constructor(readonly target: BrowserTarget) {}

  get isRunning(): boolean {
    return this.running;
  }

  async launch(): Promise<void> {
    this.launched += 1;

    if (this.failLaunch) {
      throw new AddonovaError({
        code: 'ADDONOVA_BROWSER_LAUNCH_FAILED',
        severity: 'error',
        message: 'Synthetic launch failure.',
      });
    }

    this.running = true;
  }

  async reload(): Promise<void> {
    this.reloaded += 1;
  }

  async close(): Promise<void> {
    this.closed += 1;
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
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-dev-launcher-'));
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
