import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import { runCli } from '../../src/cli/run.ts';
import type { CliIo } from '../../src/cli/command.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('CLI runner', () => {
  it('prints help and version without loading a config', async () => {
    const helpIo = createIo(createProject({}));
    const versionIo = createIo(createProject({}));

    await expect(runCli(['--help'], helpIo.io)).resolves.toBe(0);
    await expect(runCli(['--version'], versionIo.io)).resolves.toBe(0);

    expect(helpIo.stdout()).toContain('Usage:');
    expect(helpIo.stdout()).toContain('info        Show environment');
    expect(versionIo.stdout()).toMatch(/\d+\.\d+\.\d+/);
  });

  it('prints resolved configuration information', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Demo', version: '1.0.0' },
  browsers: ['chrome', 'firefox'],
};
`,
      'src/background.ts': 'export {};\n',
    });
    const { io, stdout, stderr } = createIo(root);

    const exitCode = await runCli(['info'], io);

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Addonova ');
    expect(stdout()).toContain(`Config ${path.join(root, 'addonova.config.ts')}`);
    expect(stdout()).toContain(`Project root ${root}`);
    expect(stdout()).toContain('Entrypoints 1');
    expect(stdout()).toContain('background (script)');
    expect(stdout()).toContain('chrome (MV3), firefox (MV3)');
    expect(stdout()).toContain('Manifest CLI Demo 1.0.0');
  });

  it('reports CLI parse errors and exits with code 1', async () => {
    const { io, stderr } = createIo(createProject({}));

    const exitCode = await runCli(['build', '--browser', 'safari'], io);

    expect(exitCode).toBe(1);
    expect(stderr()).toContain('ADDONOVA_CLI_INVALID_VALUE');
    expect(stderr()).toContain('suggestion:');
  });

  it('builds an extension through the CLI', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Build', version: '1.0.0' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const { io, stdout, stderr } = createIo(root);

    const exitCode = await runCli(['build'], io);

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Built chrome MV3');
    expect(stdout()).toContain('1 outputs');
  });

  it('validates manifest configuration without writing output', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Validate', version: '1.2.3' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const { io, stdout, stderr } = createIo(root);

    const exitCode = await runCli(['validate'], io);

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Validated chrome MV3');
    expect(stdout()).toContain('Configuration is valid.');
    expect(existsSync(path.join(root, 'dist'))).toBe(false);
  });

  it('reports manifest validation errors', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Validate' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const { io, stderr } = createIo(root);

    const exitCode = await runCli(['validate'], io);

    expect(exitCode).toBe(1);
    expect(stderr()).toContain('ADDONOVA_MANIFEST_REQUIRED_FIELD');
    expect(stderr()).toContain('Manifest "version" is required');
  });

  it('cleans generated output and reports when nothing remains', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Clean', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'console.log("clean-cli");\n',
    });
    const { io, stdout, stderr } = createIo(root);

    await expect(runCli(['build'], io)).resolves.toBe(0);
    await expect(runCli(['clean'], io)).resolves.toBe(0);

    expect(stderr()).toBe('');
    expect(stdout()).toContain(`Cleaned ${path.join(root, 'dist')}`);
    expect(existsSync(path.join(root, 'dist'))).toBe(false);
    expect(existsSync(path.join(root, 'src/background.ts'))).toBe(true);

    await expect(runCli(['clean'], io)).resolves.toBe(0);
    expect(stdout()).toContain(`Nothing to clean at ${path.join(root, 'dist')}`);
  }, 30_000);

  it('packs built extensions through the CLI', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Pack', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'console.log("pack-cli");\n',
    });
    const { io, stdout, stderr } = createIo(root);

    await expect(runCli(['build'], io)).resolves.toBe(0);
    await expect(runCli(['pack'], io)).resolves.toBe(0);

    const archivePath = path.join(
      root,
      'dist',
      'addonova-chrome-mv3-1.0.0.zip',
    );

    expect(stderr()).toBe('');
    expect(stdout()).toContain(`Packed chrome MV3 -> ${archivePath}`);
    expect(existsSync(archivePath)).toBe(true);
  }, 30_000);

  it('reports build failures with an actionable diagnostic and exit code 1', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Failed Build', version: '1.0.0' },
};
`,
      'src/background.ts': 'const = ;\n',
    });
    const { io, stdout, stderr } = createIo(root);

    const exitCode = await runCli(['build'], io);

    expect(exitCode).toBe(1);
    expect(stdout()).toContain('Build failed chrome MV3');
    expect(stderr()).toContain('ADDONOVA_BUNDLER_ERROR');
  }, 30_000);

  it('reports missing pack output with a suggestion and exit code 1', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Missing Pack', version: '1.0.0' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const { io, stderr } = createIo(root);

    const exitCode = await runCli(['pack'], io);

    expect(exitCode).toBe(1);
    expect(stderr()).toContain('ADDONOVA_PACK_OUTPUT_MISSING');
    expect(stderr()).toContain('suggestion:');
    expect(stderr()).toContain('addonova build --browser chrome');
  });

  it('refuses unsafe clean directories with exit code 1', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  outdir: '.',
};
`,
      'src/background.ts': 'export {};\n',
    });
    const { io, stderr } = createIo(root);

    const exitCode = await runCli(['clean'], io);

    expect(exitCode).toBe(1);
    expect(stderr()).toContain('ADDONOVA_CLEAN_UNSAFE_OUTDIR');
    expect(stderr()).toContain('suggestion:');
    expect(existsSync(path.join(root, 'src/background.ts'))).toBe(true);
  });

  it('builds and cleans projects in paths containing spaces', async () => {
    const base = mkdtempSync(path.join(tmpdir(), 'addonova-cli-spaces-'));
    tempDirs.push(base);

    const root = path.join(base, 'project with spaces');
    mkdirSync(path.join(root, 'src'), { recursive: true });
    writeFileSync(
      path.join(root, 'addonova.config.ts'),
      `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Spaces', version: '1.0.0' },
  minify: false,
};
`,
      'utf8',
    );
    writeFileSync(
      path.join(root, 'src/background.ts'),
      'console.log("spaces");\n',
      'utf8',
    );

    const { io, stdout, stderr } = createIo(root);
    const exitCode = await runCli(['build'], io);
    const cleanExitCode = await runCli(['clean'], io);

    expect(exitCode).toBe(0);
    expect(cleanExitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Built chrome MV3');
    expect(existsSync(path.join(root, 'dist'))).toBe(false);
    expect(existsSync(path.join(root, 'src/background.ts'))).toBe(true);
  }, 30_000);

  it('reports dev without entrypoints separately from unimplemented builds', async () => {
    const { io, stderr } = createIo(createProject({}));

    const exitCode = await runCli(['dev'], io);

    expect(exitCode).toBe(1);
    expect(stderr()).toContain('ADDONOVA_BUILD_NO_ENTRYPOINTS');
  });

  it('reports build without entrypoints separately from unimplemented builds', async () => {
    const { io, stderr } = createIo(createProject({}));

    const exitCode = await runCli(['build'], io);

    expect(exitCode).toBe(1);
    expect(stderr()).toContain('ADDONOVA_BUILD_NO_ENTRYPOINTS');
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-cli-'));
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
