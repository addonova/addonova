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

import { buildProject } from '../../src/core/build.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';
import { createDevSession } from '../../src/dev/watcher.ts';
import type { DevWatcher } from '../../src/dev/watcher.ts';
import type { CliIo } from '../../src/cli/command.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('project plugins', () => {
  it('bridges transforms through Guchho load', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Plugin Demo', version: '1.0.0' },
  minify: false,
  plugins: [
    {
      name: 'append-plugin-marker',
      transform(code, id) {
        if (!id.endsWith('background.ts')) {
          return null;
        }

        return code + "\\nconsole.log('plugin-transform-marker');\\n";
      },
    },
  ],
};
`,
      'src/background.ts': 'console.log("plugin-source");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one build report.');
    }

    const background = readFileSync(
      path.join(report.outdir, 'background.js'),
      'utf8',
    );

    expect(config.plugins.map((plugin) => plugin.name)).toEqual([
      'append-plugin-marker',
    ]);
    expect(report.result.success).toBe(true);
    expect(report.result.errors).toEqual([]);
    expect(background).toContain('plugin-source');
    expect(background).toContain('plugin-transform-marker');
  }, 30_000);

  it('reports plugin transform failures with the plugin name and source file', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Plugin Failure', version: '1.0.0' },
  minify: false,
  plugins: [
    {
      name: 'broken-plugin',
      transform(code, id) {
        if (id.endsWith('background.ts')) {
          throw new Error('plugin exploded');
        }

        return null;
      },
    },
  ],
};
`,
      'src/background.ts': 'console.log("broken");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one build report.');
    }

    const pluginErrors = report.result.errors.filter(
      (error) => error.code === 'ADDONOVA_PLUGIN_TRANSFORM_FAILED',
    );

    expect(report.result.success).toBe(false);
    expect(pluginErrors).toHaveLength(1);
    expect(pluginErrors[0]).toMatchObject({
      severity: 'error',
      location: { file: path.join(root, 'src/background.ts') },
    });
    expect(pluginErrors[0]?.message).toContain('broken-plugin');
    expect(pluginErrors[0]?.message).toContain('plugin exploded');
    expect(pluginErrors[0]?.suggestion).toBeDefined();
  }, 30_000);

  it('applies plugin transforms during dev rebuilds', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Plugin Dev', version: '1.0.0' },
  minify: false,
  webExt: { disabled: true },
  plugins: [
    {
      name: 'dev-marker',
      transform(code, id) {
        if (!id.endsWith('background.ts')) {
          return null;
        }

        return code + "\\nconsole.log('dev-plugin-marker');\\n";
      },
    },
  ],
};
`,
      'src/background.ts': 'console.log("dev-plugin-v1");\n',
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

    expect(readFileSync(backgroundPath, 'utf8')).toContain('dev-plugin-marker');
    expect(readFileSync(backgroundPath, 'utf8')).toContain('dev-plugin-v1');

    writeFileSync(
      path.join(root, 'src/background.ts'),
      'console.log("dev-plugin-v2");\n',
      'utf8',
    );
    watcher.emit(path.join(root, 'src/background.ts'));
    await session.waitForIdle();

    const rebuilt = readFileSync(backgroundPath, 'utf8');

    expect(rebuilt).toContain('dev-plugin-marker');
    expect(rebuilt).toContain('dev-plugin-v2');
    expect(existsSync(path.join(root, 'dist/chrome/manifest.json'))).toBe(true);

    await session.close();
  }, 30_000);
});

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

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-plugins-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
