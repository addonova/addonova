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

import { AddonovaError } from '../../src/core/errors.ts';
import {
  BUILTIN_TEMPLATES,
  detectPackageManager,
  initProject,
  isBuiltinTemplate,
  resolveBuiltinTemplate,
} from '../../src/core/init.ts';
import type {
  InitProjectResult,
  TemplateDownloader,
} from '../../src/core/init.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('initProject', () => {
  for (const template of BUILTIN_TEMPLATES) {
    it(`scaffolds the bundled ${template} template`, async () => {
      const base = createTempDirectory();
      const result = await initProject({
        cwd: base,
        directory: 'my-extension',
        template,
        git: false,
      });

      expect(result.template).toBe(template);
      expect(result.gitInitialized).toBe(false);
      expect(existsSync(path.join(result.root, '.gitignore'))).toBe(true);
      expect(existsSync(path.join(result.root, '_gitignore'))).toBe(false);

      const configName =
        template === 'vanilla-js' ? 'addonova.config.js' : 'addonova.config.ts';

      expect(existsSync(path.join(result.root, configName))).toBe(true);
      expect(existsSync(path.join(result.root, 'package.json'))).toBe(true);
      expect(result.files).toContain('package.json');
      expect(result.files).toContain('src/_locales/en.i18n');
      expect(result.files).not.toContain('_gitignore');
      expectNoPlaceholders(result);

      const packageJson = JSON.parse(
        readFileSync(path.join(result.root, 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> };
      const config = readFileSync(path.join(result.root, configName), 'utf8');
      const background = readFileSync(
        path.join(
          result.root,
          'src',
          'entrypoints',
          template === 'vanilla-js' ? 'background.js' : 'background.ts',
        ),
        'utf8',
      );
      const locale = readFileSync(
        path.join(result.root, 'src', '_locales', 'en.i18n'),
        'utf8',
      );

      expect(packageJson.dependencies?.['@addonova/browser']).toBe('^0.2.0');
      expect(config).toContain("browserApi: 'bundle'");
      expect(config).toContain("default_locale: 'en'");
      expect(config).toContain("name: '__MSG_app_name__'");
      expect(config).toContain("description: '__MSG_app_description__'");
      expect(background).toContain("from '@addonova/browser'");
      expect(locale).toContain('@app_name\nMy Extension');
      expect(locale).not.toContain('__PROJECT_TITLE__');
    });
  }

  it('resolves template names and aliases', () => {
    expect(resolveBuiltinTemplate('vanilla')).toBe('vanilla-ts');
    expect(resolveBuiltinTemplate('REACT')).toBe('react');
    expect(resolveBuiltinTemplate('missing')).toBeNull();
    expect(isBuiltinTemplate('vanilla-js')).toBe(true);
    expect(isBuiltinTemplate('svelte')).toBe(false);
  });

  it('defaults to vanilla-ts in the current directory', async () => {
    const base = createTempDirectory();
    const result = await initProject({ cwd: base, git: false });

    expect(result.template).toBe('vanilla-ts');
    expect(result.root).toBe(path.resolve(base));
    expect(existsSync(path.join(base, 'addonova.config.ts'))).toBe(true);
  });

  it('rejects a non-empty directory without force', async () => {
    const base = createTempDirectory();
    writeFileSync(path.join(base, 'keep.txt'), 'keep', 'utf8');

    await expectError(
      initProject({ cwd: base, git: false }),
      'ADDONOVA_INIT_DIRECTORY_NOT_EMPTY',
    );

    expect(existsSync(path.join(base, 'keep.txt'))).toBe(true);
  });

  it('scaffolds into a non-empty directory with force', async () => {
    const base = createTempDirectory();
    writeFileSync(path.join(base, 'keep.txt'), 'keep', 'utf8');

    const result = await initProject({ cwd: base, force: true, git: false });

    expect(existsSync(path.join(base, 'keep.txt'))).toBe(true);
    expect(existsSync(path.join(base, 'addonova.config.ts'))).toBe(true);
    expect(result.files).toContain('keep.txt');
  });

  it('rejects a target path that is a file', async () => {
    const base = createTempDirectory();
    writeFileSync(path.join(base, 'target'), 'file', 'utf8');

    await expectError(
      initProject({ cwd: base, directory: 'target', git: false }),
      'ADDONOVA_INIT_DIRECTORY_INVALID',
    );
  });

  it('rejects unknown, invalid, and offline remote templates', async () => {
    const base = createTempDirectory();

    await expectError(
      initProject({ cwd: base, template: 'svelte', git: false }),
      'ADDONOVA_INIT_TEMPLATE_UNKNOWN',
    );
    await expectError(
      initProject({ cwd: base, template: 'gh:owner/../evil', git: false }),
      'ADDONOVA_INIT_TEMPLATE_INVALID',
    );
    await expectError(
      initProject({
        cwd: base,
        template: 'gh:owner/repo',
        offline: true,
        git: false,
      }),
      'ADDONOVA_INIT_OFFLINE',
    );
  });

  it('downloads remote templates through an injected downloader', async () => {
    const base = createTempDirectory();
    const calls: Array<{ source: string; dir: string }> = [];
    const downloader: TemplateDownloader = {
      async download(source, dir) {
        calls.push({ source, dir });
        mkdirSync(path.join(dir, 'src'), { recursive: true });
        writeFileSync(
          path.join(dir, 'package.json'),
          JSON.stringify({ name: '__PROJECT_NAME__' }),
          'utf8',
        );
        writeFileSync(path.join(dir, '_gitignore'), 'node_modules/\n', 'utf8');
        writeFileSync(
          path.join(dir, 'README.md'),
          '# __PROJECT_TITLE__\n',
          'utf8',
        );
      },
    };

    const result = await initProject({
      cwd: base,
      directory: 'remote-app',
      template: 'owner/repo',
      downloader,
      git: false,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.source).toBe('gh:owner/repo');
    expect(calls[0]?.dir).toBe(path.join(base, 'remote-app'));
    expect(existsSync(path.join(base, 'remote-app', '.gitignore'))).toBe(true);
    expectNoPlaceholders(result);
  });

  it('reports downloader failures', async () => {
    const base = createTempDirectory();
    const downloader: TemplateDownloader = {
      async download() {
        throw new Error('network down');
      },
    };

    await expectError(
      initProject({
        cwd: base,
        template: 'gh:owner/repo',
        downloader,
        git: false,
      }),
      'ADDONOVA_INIT_DOWNLOAD_FAILED',
    );
  });

  it('runs the injected git initializer by default', async () => {
    const base = createTempDirectory();
    const roots: string[] = [];

    const result = await initProject({
      cwd: base,
      directory: 'app',
      gitInit: async (root) => {
        roots.push(root);
        return true;
      },
    });

    expect(result.gitInitialized).toBe(true);
    expect(roots).toEqual([path.join(base, 'app')]);
  });

  it('skips git when disabled or already initialized', async () => {
    const base = createTempDirectory();
    let calls = 0;
    const gitInit = async (): Promise<boolean> => {
      calls += 1;
      return true;
    };

    const disabled = await initProject({
      cwd: base,
      directory: 'no-git',
      git: false,
      gitInit,
    });
    mkdirSync(path.join(base, 'existing-git', '.git'), { recursive: true });
    const existing = await initProject({
      cwd: base,
      directory: 'existing-git',
      gitInit,
    });

    expect(disabled.gitInitialized).toBe(false);
    expect(existing.gitInitialized).toBe(false);
    expect(calls).toBe(0);
  });

  it('treats git failures as warnings', async () => {
    const base = createTempDirectory();
    const result = await initProject({
      cwd: base,
      directory: 'app',
      gitInit: async () => {
        throw new Error('git missing');
      },
    });

    expect(result.gitInitialized).toBe(false);
    expect(result.warnings[0]).toContain('git init failed');
    expect(result.warnings[0]).toContain('git missing');
  });
});

describe('detectPackageManager', () => {
  it('prefers an explicit package manager', async () => {
    const base = createTempDirectory();
    writeFileSync(path.join(base, 'yarn.lock'), '', 'utf8');

    await expect(
      detectPackageManager({ cwd: base, explicit: 'bun' }),
    ).resolves.toBe('bun');
  });

  it('uses the npm user agent', async () => {
    const base = createTempDirectory();

    await expect(
      detectPackageManager({
        cwd: base,
        env: { npm_config_user_agent: 'pnpm/9.0.0 npm/? node/v20' },
      }),
    ).resolves.toBe('pnpm');
  });

  it('detects lockfiles and falls back to npm', async () => {
    const yarn = createTempDirectory();
    writeFileSync(path.join(yarn, 'yarn.lock'), '', 'utf8');

    const bare = createTempDirectory();

    await expect(detectPackageManager({ cwd: yarn, env: {} })).resolves.toBe(
      'yarn',
    );
    await expect(detectPackageManager({ cwd: bare, env: {} })).resolves.toBe(
      'npm',
    );
  });
});

function createTempDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'addonova-init-'));
  tempDirs.push(directory);
  return directory;
}

async function expectError(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AddonovaError);
    expect((error as AddonovaError).diagnostic.code).toBe(code);
    return;
  }

  throw new Error(`Expected initProject to reject with ${code}.`);
}

function expectNoPlaceholders(result: InitProjectResult): void {
  const packageJson = readFileSync(
    path.join(result.root, 'package.json'),
    'utf8',
  );
  const readme = readFileSync(path.join(result.root, 'README.md'), 'utf8');

  expect(packageJson).not.toContain('__PROJECT_NAME__');
  expect(packageJson).not.toContain('__ADDONOVA_VERSION__');
  expect(readme).not.toContain('__PROJECT_TITLE__');
  expect(packageJson).toContain(path.basename(result.root));
}
