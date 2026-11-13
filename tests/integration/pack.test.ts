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

import { unpack } from 'guchho';
import { afterEach, describe, expect, it } from '@guchho/test';

import { buildProject } from '../../src/core/build.ts';
import { resolveProjectConfig } from '../../src/core/config.ts';
import { getArchivePath, packProject } from '../../src/core/pack.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('project pack', () => {
  it('packages built extensions with manifest.json at the archive root', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: {
    name: 'Pack Demo',
    version: '1.0.0',
    background: { service_worker: 'background.js' },
    icons: { '16': 'icons/icon.svg' },
  },
  minify: false,
};
`,
      'src/background.ts': 'console.log("pack-me");\n',
      'public/icons/icon.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await buildProject(config);

    const results = await packProject(config);
    const result = results[0];

    expect(result).toBeDefined();

    if (result === undefined) {
      throw new Error('Expected one pack result.');
    }

    expect(result.archivePath).toBe(
      path.join(root, 'dist', 'addonova-chrome-mv3-1.0.0.zip'),
    );
    expect(result.size).toBeGreaterThan(0);
    expect(existsSync(result.archivePath)).toBe(true);

    const extracted = path.join(root, 'unpacked');
    await unpack({ archive: result.archivePath, outDir: extracted });

    expect(existsSync(path.join(extracted, 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(extracted, 'background.js'))).toBe(true);
    expect(existsSync(path.join(extracted, 'icons/icon.svg'))).toBe(true);

    await expect(packProject(config)).rejects.toHaveProperty(
      'code',
      'ADDONOVA_PACK_OUTPUT_EXISTS',
    );

    const overwriteConfig = {
      ...config,
      pack: { ...config.pack, overwrite: true },
    };

    await expect(packProject(overwriteConfig)).resolves.toHaveLength(1);
  }, 60_000);

  it('filters archive files and preserves nested output paths', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: {
    name: 'Filtered Pack',
    version: '1.0.0',
    background: { service_worker: 'background.js' },
    icons: { '16': 'icons/icon.svg' },
  },
  minify: false,
  pack: { format: 'tar.gz' },
};
`,
      'src/background.ts': 'console.log("filtered");\n',
      'public/icons/icon.svg': '<svg></svg>\n',
      'public/icons/private/secret.svg': '<svg></svg>\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await buildProject(config);

    const [result] = await packProject(config, {
      format: 'zip',
      exclude: ['icons/private/**'],
    });

    expect(result).toBeDefined();

    if (result === undefined) {
      throw new Error('Expected one pack result.');
    }

    expect(result.archivePath).toBe(
      path.join(root, 'dist', 'addonova-chrome-mv3-1.0.0.zip'),
    );

    const extracted = path.join(root, 'unpacked-filtered');
    await unpack({ archive: result.archivePath, outDir: extracted });

    expect(existsSync(path.join(extracted, 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(extracted, 'background.js'))).toBe(true);
    expect(existsSync(path.join(extracted, 'icons/icon.svg'))).toBe(true);
    expect(existsSync(path.join(extracted, 'icons/private/secret.svg'))).toBe(
      false,
    );
  }, 60_000);

  it('packs a Firefox source archive without build output or dependencies', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Source Pack', version: '1.0.0' },
  browsers: ['firefox'],
  minify: false,
  pack: { sources: true },
};
`,
      'src/background.ts': 'console.log("sources");\n',
      'node_modules/ignored/index.js': 'module.exports = 1;\n',
      '.git/config': '[core]\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await buildProject(config);

    const [result] = await packProject(config);

    expect(result).toBeDefined();

    if (result === undefined) {
      throw new Error('Expected one pack result.');
    }

    expect(result.sources).toBeDefined();

    if (result.sources === undefined) {
      throw new Error('Expected a source archive.');
    }

    expect(result.sources.archivePath).toBe(
      path.join(root, 'dist', 'addonova-firefox-mv3-1.0.0-sources.zip'),
    );
    expect(result.sources.files).toBeGreaterThan(0);

    const extracted = path.join(root, 'unpacked-sources');
    await unpack({
      archive: result.sources.archivePath,
      outDir: extracted,
    });

    expect(existsSync(path.join(extracted, 'addonova.config.ts'))).toBe(true);
    expect(existsSync(path.join(extracted, 'src/background.ts'))).toBe(true);
    expect(existsSync(path.join(extracted, 'dist'))).toBe(false);
    expect(existsSync(path.join(extracted, 'node_modules'))).toBe(false);
    expect(existsSync(path.join(extracted, '.git'))).toBe(false);
  }, 60_000);

  it('rejects source archives when no Firefox target is configured', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Source Pack', version: '1.0.0' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await expect(
      packProject(config, { sources: true }),
    ).rejects.toHaveProperty(
      'code',
      'ADDONOVA_PACK_SOURCES_UNSUPPORTED',
    );
  });

  it('reports missing build output', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Pack Demo', version: '1.0.0' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await expect(packProject(config)).rejects.toHaveProperty(
      'code',
      'ADDONOVA_PACK_OUTPUT_MISSING',
    );
  });

  it('rejects a single outFile for multiple browser targets', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  browsers: ['chrome', 'firefox'],
  pack: { outFile: 'dist/extension.zip' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await expect(packProject(config)).rejects.toHaveProperty(
      'code',
      'ADDONOVA_PACK_OUTFILE_AMBIGUOUS',
    );
  });

  it('derives a tar.gz archive name from the manifest', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Pack Demo', version: '2.0.0' },
  pack: { format: 'tar.gz' },
};
`,
      'src/background.ts': 'export {};\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const browser = config.browsers[0];

    expect(browser).toBeDefined();

    if (browser === undefined) {
      throw new Error('Expected one browser target.');
    }

    expect(getArchivePath(config, browser)).toBe(
      path.join(root, 'dist', 'addonova-chrome-mv3-2.0.0.tar.gz'),
    );
  });

  it('produces byte-identical archives for deterministic packs', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Deterministic Demo', version: '1.0.0' },
  minify: false,
  pack: { deterministic: true },
};
`,
      'src/background.ts': 'console.log("deterministic");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    await buildProject(config);

    const [first] = await packProject(config);

    expect(first).toBeDefined();

    if (first === undefined) {
      throw new Error('Expected one pack result.');
    }

    const firstBytes = readFileSync(first.archivePath);

    rmSync(first.archivePath);

    const [second] = await packProject(config);

    expect(second).toBeDefined();

    if (second === undefined) {
      throw new Error('Expected a second pack result.');
    }

    const secondBytes = readFileSync(second.archivePath);

    expect(first.archivePath).toBe(second.archivePath);
    expect(firstBytes.equals(secondBytes)).toBe(true);
  }, 60_000);
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-pack-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
