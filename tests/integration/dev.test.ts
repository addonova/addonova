import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { createDevSession } from '../../src/dev/watcher.js';
import type {
  DevWatcher,
  DevWatcherOptions,
} from '../../src/dev/watcher.js';
import type {
  BundlerAdapter,
  BundlerBuildInput,
  BundlerBuildResult,
  BundlerContext,
} from '../../src/bundler/adapter.js';
import type { CliIo } from '../../src/cli/command.js';
import { resolveProjectConfig } from '../../src/core/config.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dev session', () => {
  it('rebuilds warm contexts and keeps the last successful output', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome'],
  manifest: { name: 'Dev Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'export {};\n',
      'public/icon.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>\n',
    });
    const adapter = new FakeAdapter();
    const watcher = new FakeWatcher();
    const output = createIo(root);
    const watchedPaths: string[][] = [];
    let watcherOptions: DevWatcherOptions | undefined;
    const config = await resolveProjectConfig({
      cwd: root,
      defaultMode: 'development',
    });

    const session = await createDevSession({
      config,
      io: output.io,
      adapter,
      debounceMs: 5,
      watcherFactory: (paths, options) => {
        watchedPaths.push([...paths]);
        watcherOptions = options;
        return watcher;
      },
      reloadConfig: () =>
        resolveProjectConfig({ cwd: root, defaultMode: 'development' }),
    });

    const outdir = path.join(root, 'dist/chrome');
    const backgroundPath = path.join(outdir, 'background.js');

    expect(adapter.createdContexts).toBe(1);
    expect(watchedPaths).toHaveLength(1);
    expect(watchedPaths[0]).toContain(root);
    expect(watchedPaths[0]).toContain(path.join(root, 'addonova.config.ts'));
    expect(watcherOptions?.ignored(path.join(root, 'dist'))).toBe(true);
    expect(watcherOptions?.ignored(path.join(root, 'node_modules'))).toBe(true);
    expect(watcherOptions?.ignored(path.join(root, 'src/background.ts'))).toBe(
      false,
    );
    expect(readFileSync(backgroundPath, 'utf8')).toBe('v1');
    expect(existsSync(path.join(outdir, 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(outdir, 'icon.svg'))).toBe(true);
    expect(existsSync(path.join(outdir, 'stale.txt'))).toBe(false);

    adapter.mode = 'fail';
    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(readFileSync(backgroundPath, 'utf8')).toBe('v1');
    expect(existsSync(path.join(outdir, 'partial.txt'))).toBe(false);
    expect(output.stderr()).toContain('keeping the last successful output');

    adapter.mode = 'success';
    adapter.versionLabel = 'v2';
    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(readFileSync(backgroundPath, 'utf8')).toBe('v2');
    expect(existsSync(path.join(outdir, 'stale.txt'))).toBe(false);

    writeFileSync(
      path.join(root, 'addonova.config.ts'),
      `export default {
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome', 'edge'],
  manifest: { name: 'Dev Demo 2', version: '1.0.1' },
  minify: false,
};
`,
      'utf8',
    );
    watcher.emit(path.join(root, 'addonova.config.ts'));
    await session.waitForIdle();

    expect(adapter.createdContexts).toBe(3);
    expect(adapter.disposedContexts).toBe(1);
    expect(output.stdout()).toContain('Reloaded configuration');
    expect(readFileSync(backgroundPath, 'utf8')).toBe('v2');
    expect(
      readFileSync(path.join(root, 'dist/edge/background.js'), 'utf8'),
    ).toBe('v2');
    expect(
      JSON.parse(readFileSync(path.join(outdir, 'manifest.json'), 'utf8')),
    ).toMatchObject({ name: 'Dev Demo 2', version: '1.0.1' });

    await session.close();

    expect(watcher.closed).toBe(true);
    expect(adapter.disposed).toBe(1);
    expect(adapter.disposedContexts).toBe(3);
    expect(session.isClosed).toBe(true);
  }, 30_000);

  it('uses the real Guchho adapter for warm builds', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Real Dev Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'console.log("dev-v1");\n',
    });
    const watcher = new FakeWatcher();
    const output = createIo(root);
    const config = await resolveProjectConfig({
      cwd: root,
      defaultMode: 'development',
    });

    const session = await createDevSession({
      config,
      io: output.io,
      debounceMs: 5,
      watcherFactory: () => watcher,
    });

    const backgroundPath = path.join(root, 'dist/chrome/background.js');

    expect(existsSync(backgroundPath)).toBe(true);
    expect(readFileSync(backgroundPath, 'utf8')).toContain('dev-v1');

    writeFileSync(
      path.join(root, 'src/background.ts'),
      'console.log("dev-v2");\n',
      'utf8',
    );
    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    expect(readFileSync(backgroundPath, 'utf8')).toContain('dev-v2');
    expect(readFileSync(backgroundPath, 'utf8')).not.toContain('dev-v1');

    await session.close();
  }, 30_000);
});

class FakeAdapter implements BundlerAdapter {
  readonly name = 'fake';
  readonly version = '0.0.0';
  mode: 'success' | 'fail' = 'success';
  versionLabel = 'v1';
  createdContexts = 0;
  disposedContexts = 0;
  disposed = 0;

  async build(): Promise<BundlerBuildResult> {
    throw new Error('The fake adapter only supports contexts.');
  }

  async createContext(input: BundlerBuildInput): Promise<BundlerContext> {
    this.createdContexts += 1;

    return new FakeContext(this, input);
  }

  async dispose(): Promise<void> {
    this.disposed += 1;
  }
}

class FakeContext implements BundlerContext {
  private disposed = false;

  constructor(
    private readonly adapter: FakeAdapter,
    private readonly input: BundlerBuildInput,
  ) {}

  async rebuild(): Promise<BundlerBuildResult> {
    mkdirSync(this.input.outdir, { recursive: true });

    if (this.adapter.mode === 'fail') {
      writeFileSync(path.join(this.input.outdir, 'partial.txt'), 'partial\n');

      return {
        success: false,
        duration: 1,
        outputs: [],
        inputs: [],
        errors: [
          {
            code: 'ADDONOVA_BUNDLER_ERROR',
            severity: 'error',
            message: 'Synthetic build failure.',
          },
        ],
        warnings: [],
      };
    }

    const content = this.adapter.versionLabel;
    const outputPath = path.join(this.input.outdir, 'background.js');

    writeFileSync(outputPath, content);
    writeFileSync(path.join(this.input.outdir, 'stale.txt'), 'stale\n');

    return {
      success: true,
      duration: 1,
      outputs: [{ path: outputPath, size: content.length }],
      inputs: [],
      errors: [],
      warnings: [],
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.adapter.disposedContexts += 1;
  }
}

class FakeWatcher implements DevWatcher {
  closed = false;
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

  async close(): Promise<void> {
    this.closed = true;
  }
}

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-dev-'));
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
