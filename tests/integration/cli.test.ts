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

  it('scaffolds a project without loading a configuration', async () => {
    const root = createProject({
      'addonova.config.ts': 'throw new Error("init must not load this");\n',
    });
    const { io, stdout, stderr } = createIo(root);

    const exitCode = await runCli(
      ['init', 'app', '--template', 'vanilla-ts', '--no-git', '--offline'],
      io,
    );

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Scaffolded Vanilla TypeScript');
    expect(stdout()).toContain('Next steps:');
    expect(existsSync(path.join(root, 'app', 'addonova.config.ts'))).toBe(true);
    expect(existsSync(path.join(root, 'app', '.git'))).toBe(false);
  });

  it('builds a generated vanilla-ts project', async () => {
    const root = createProject({});
    await initTemplate(root, 'app', 'vanilla-ts');
    installAddonovaShim(path.join(root, 'app'));

    const { io, stdout, stderr } = createIo(path.join(root, 'app'));
    const exitCode = await runCli(['build', '--no-color'], io);

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Built chrome MV3');
    expect(
      existsSync(path.join(root, 'app', 'dist', 'chrome', 'manifest.json')),
    ).toBe(true);
  }, 60_000);

  it('builds a generated vanilla-js project', async () => {
    const root = createProject({});
    await initTemplate(root, 'app', 'vanilla-js');
    installAddonovaShim(path.join(root, 'app'));

    const { io, stdout, stderr } = createIo(path.join(root, 'app'));
    const exitCode = await runCli(['build', '--no-color'], io);

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Built chrome MV3');
    expect(
      existsSync(path.join(root, 'app', 'dist', 'chrome', 'manifest.json')),
    ).toBe(true);
  }, 60_000);

  it('scaffolds and builds a generated react project', async () => {
    const root = createProject({});
    await initTemplate(root, 'app', 'react');
    installAddonovaShim(path.join(root, 'app'));
    installReactShim(path.join(root, 'app'));

    const { io, stdout, stderr } = createIo(path.join(root, 'app'));
    const exitCode = await runCli(['build', '--no-color'], io);

    expect(exitCode).toBe(0);
    expect(stderr()).toBe('');
    expect(stdout()).toContain('Built chrome MV3');
    expect(
      existsSync(path.join(root, 'app', 'dist', 'chrome', 'manifest.json')),
    ).toBe(true);
  }, 60_000);

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
    expect(stdout()).toContain(path.join(root, 'addonova.config.ts'));
    expect(stdout()).toContain('Project root');
    expect(stdout()).toContain('Entrypoints');
    expect(stdout()).toContain('background');
    expect(stdout()).toContain('(script)');
    expect(stdout()).toContain('chrome (MV3), firefox (MV3)');
    expect(stdout()).toContain('Manifest');
    expect(stdout()).toContain('CLI Demo 1.0.0');
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
    expect(stdout()).toContain('background.js');
    expect(stdout()).toContain('Σ Total size:');
  });

  it('styles output when color is enabled and strips it with --no-color', async () => {
    const config = `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'CLI Color', version: '1.0.0' },
};
`;
    const coloredRoot = createProject({
      'addonova.config.ts': config,
      'src/background.ts': 'export {};\n',
    });
    const colored = createIo(coloredRoot, { color: true });

    await expect(runCli(['build'], colored.io)).resolves.toBe(0);

    expect(colored.stdout()).toContain('\u001B[');
    expect(colored.stdout()).toContain('✔');

    const plainRoot = createProject({
      'addonova.config.ts': config,
      'src/background.ts': 'export {};\n',
    });
    const plain = createIo(plainRoot, { color: true });

    await expect(runCli(['build', '--no-color'], plain.io)).resolves.toBe(0);

    expect(plain.stdout()).not.toContain('\u001B[');
    expect(plain.stdout()).toContain('✔');
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

async function initTemplate(
  parent: string,
  directory: string,
  template: string,
): Promise<void> {
  const { io, stderr } = createIo(parent);
  const exitCode = await runCli(
    ['init', directory, '--template', template, '--no-git', '--offline'],
    io,
  );

  expect(exitCode).toBe(0);
  expect(stderr()).toBe('');
}

function installAddonovaShim(root: string): void {
  writeModule(
    root,
    'addonova',
    `export function defineConfig(config) {\n  return config;\n}\n`,
  );
}

function installReactShim(root: string): void {
  writeModule(
    root,
    'react',
    `export function createElement() {\n  return {};\n}\nexport function useState(value) {\n  return [value, () => {}];\n}\nconst React = { createElement, useState };\nexport default React;\n`,
  );
  writeModule(
    root,
    'react/jsx-runtime',
    `export function jsx() {\n  return {};\n}\nexport const jsxs = jsx;\nexport const Fragment = Symbol.for('react.fragment');\n`,
  );
  writeModule(
    root,
    'react/jsx-dev-runtime',
    `export function jsxDEV() {\n  return {};\n}\nexport const Fragment = Symbol.for('react.fragment');\n`,
  );
  writeModule(
    root,
    'react-dom/client',
    `export function createRoot() {\n  return { render() {} };\n}\n`,
  );
}

function writeModule(root: string, name: string, source: string): void {
  const directory = path.join(root, 'node_modules', ...name.split('/'));
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name, version: '0.0.0-test', type: 'module', main: 'index.js' }),
    'utf8',
  );
  writeFileSync(path.join(directory, 'index.js'), source, 'utf8');
}

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
  options: { color?: boolean; isTTY?: boolean } = {},
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
        ...(options.isTTY === undefined ? {} : { isTTY: options.isTTY }),
      },
      stderr: {
        write(chunk: string) {
          stderr += chunk;
          return true;
        },
        ...(options.isTTY === undefined ? {} : { isTTY: options.isTTY }),
      },
      ...(options.color === undefined ? {} : { color: options.color }),
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}
