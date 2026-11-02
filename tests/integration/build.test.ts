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

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('project build', () => {
  it('builds extension assets through the real Guchho adapter', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: {
    background: 'src/background.ts',
    popup: 'src/popup/index.html',
  },
  publicDir: 'public',
  manifest: {
    name: 'Build Demo',
    version: '1.0.0',
    background: { service_worker: 'background.js' },
    action: {
      default_popup: 'popup.html',
      default_icon: 'icons/icon.svg',
    },
    icons: { '16': 'icons/icon.svg' },
  },
  minify: false,
};
`,
      'src/shared.ts': `export const message = 'shared-module-inlined';\n`,
      'src/data.json': `{ "value": "json-module-inlined" }\n`,
      'src/background.ts': `import { message } from './shared';\nimport data from './data.json';\nconsole.log(message, data.value);\n`,
      'src/assets/logo.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n',
      'src/popup/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="./style.css" />
    <title>Build Demo</title>
  </head>
  <body>
    <img id="logo" alt="Demo" />
    <script type="module" src="./popup.ts"></script>
  </body>
</html>
`,
      'src/popup/popup.ts': `import logoUrl from '../assets/logo.svg';\nconst logo = document.getElementById('logo');\nif (logo instanceof HTMLImageElement) logo.src = logoUrl;\n`,
      'src/popup/style.css': 'body { color: red; }\n',
      'public/icons/icon.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    const reports = await buildProject(config, {
      transforms: [
        {
          name: 'test-transform',
          include: (id) => id.endsWith('background.ts'),
          transform: (code) =>
            `${code}\nconsole.log('transformed-background');\n`,
        },
      ],
    });

    expect(reports).toHaveLength(1);

    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one build report.');
    }

    const { result, outdir } = report;
    const outputs = result.outputs
      .map((output) =>
        path.relative(outdir, output.path).split(path.sep).join('/'),
      )
      .sort();

    expect(report.browser.target).toBe('chrome');
    expect(report.browser.manifestVersion).toBe(3);
    expect(outdir).toBe(path.join(root, 'dist/chrome'));
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.metafile).toBeDefined();
    expect(result.inputs.length).toBeGreaterThan(0);
    expect(outputs).toContain('background.js');
    expect(outputs).toContain('popup.html');
    expect(hasAsset(outputs, '.js')).toBe(true);
    expect(hasAsset(outputs, '.css')).toBe(true);
    expect(hasAsset(outputs, '.svg')).toBe(true);
    expect(existsSync(path.join(outdir, 'icons/icon.svg'))).toBe(true);
    expect(existsSync(path.join(outdir, 'manifest.json'))).toBe(true);
    expect(report.manifestPath).toBe(path.join(outdir, 'manifest.json'));
    expect(report.manifestDiagnostics).toEqual([]);

    const manifest = JSON.parse(
      readFileSync(path.join(outdir, 'manifest.json'), 'utf8'),
    ) as Record<string, unknown>;
    const background = readFileSync(path.join(outdir, 'background.js'), 'utf8');
    const popup = readFileSync(path.join(outdir, 'popup.html'), 'utf8');

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: 'Build Demo',
      version: '1.0.0',
      background: { service_worker: 'background.js' },
      action: { default_popup: 'popup.html' },
    });

    expect(background).toContain('shared-module-inlined');
    expect(background).toContain('json-module-inlined');
    expect(background).toContain('transformed-background');
    expect(popup).toMatch(/assets\/[^"]+\.js/);
    expect(popup).toMatch(/assets\/[^"]+\.css/);
  }, 30_000);

  it('generates browser-specific manifests for every supported target', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  publicDir: 'public',
  manifest: {
    name: 'Targets Demo',
    version: '1.0.0',
    action: { default_icon: { '16': 'icon.svg' } },
  },
  browsers: {
    chrome: {
      manifest_version: 3,
      background: { service_worker: 'background.js' },
      action: { default_title: 'Chrome' },
    },
    chromium: {
      manifest_version: 3,
      background: { service_worker: 'background.js' },
      action: { default_title: 'Chromium' },
    },
    edge: {
      manifest_version: 3,
      background: { service_worker: 'background.js' },
      action: { default_title: 'Edge' },
    },
    firefox: {
      manifest_version: 3,
      background: { scripts: ['background.js'] },
      action: { default_title: 'Firefox' },
      browser_specific_settings: { gecko: { id: 'demo@example.com' } },
    },
  },
  minify: false,
};
`,
      'src/background.ts': 'export {};\n',
      'public/icon.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    const reports = await buildProject(config);

    expect(reports.map((report) => report.browser.target)).toEqual([
      'chrome',
      'chromium',
      'edge',
      'firefox',
    ]);

    for (const report of reports) {
      const { target } = report.browser;
      const expectedOutdir = path.join(root, 'dist', target);

      expect(report.result.success).toBe(true);
      expect(report.result.errors).toEqual([]);
      expect(report.manifestDiagnostics).toEqual([]);
      expect(report.outdir).toBe(expectedOutdir);
      expect(report.manifestPath).toBe(path.join(expectedOutdir, 'manifest.json'));
      expect(existsSync(path.join(expectedOutdir, 'background.js'))).toBe(true);
      expect(existsSync(path.join(expectedOutdir, 'icon.svg'))).toBe(true);

      const manifest = JSON.parse(
        readFileSync(path.join(expectedOutdir, 'manifest.json'), 'utf8'),
      ) as Record<string, unknown>;
      const action = manifest.action as Record<string, unknown>;

      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toBe('Targets Demo');
      expect(action.default_title).toBe(
        target.charAt(0).toUpperCase() + target.slice(1),
      );
      expect(action.default_icon).toEqual({ '16': 'icon.svg' });

      if (target === 'firefox') {
        expect(manifest.background).toEqual({ scripts: ['background.js'] });
        expect(manifest.browser_specific_settings).toEqual({
          gecko: { id: 'demo@example.com' },
        });
      } else {
        expect(manifest.background).toEqual({
          service_worker: 'background.js',
        });
      }
    }
  }, 60_000);

  it('maps Guchho build failures to diagnostics', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
};
`,
      'src/background.ts': 'const = ;\n',
    });
    const config = await resolveProjectConfig({ cwd: root });

    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one build report.');
    }

    expect(report.result.success).toBe(false);
    expect(report.result.errors.length).toBeGreaterThan(0);
    expect(report.result.errors[0]).toMatchObject({
      code: 'ADDONOVA_BUNDLER_ERROR',
      severity: 'error',
    });
    expect(report.result.errors[0]?.message).not.toBe('');
  }, 30_000);

  it('minifies production output', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: {
    background: 'src/background.ts',
    popup: 'src/popup.html',
  },
  manifest: { name: 'Optimized Demo', version: '1.0.0' },
};
`,
      'src/background.ts': `/* production-comment */
const message = 'production-marker';
console.log(message);
`,
      'src/popup.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="./popup.css" />
  </head>
  <body>
    <p>Popup</p>
  </body>
</html>
`,
      'src/popup.css': `body {
  color: red;
  background: white;
}
`,
    });
    const config = await resolveProjectConfig({ cwd: root });
    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one production build report.');
    }

    const outputs = report.result.outputs.map((output) =>
      path.relative(report.outdir, output.path).split(path.sep).join('/'),
    );
    const background = readFileSync(
      path.join(report.outdir, 'background.js'),
      'utf8',
    );
    const cssFile = outputs.find((file) => file.endsWith('.css'));

    expect(report.result.success).toBe(true);
    expect(outputs.some((file) => file.endsWith('.map'))).toBe(false);
    expect(background).toContain('production-marker');
    expect(background).not.toContain('production-comment');

    expect(cssFile).toBeDefined();

    if (cssFile === undefined) {
      throw new Error('Expected a CSS asset.');
    }

    const css = readFileSync(path.join(report.outdir, cssFile), 'utf8');

    expect(css.trim()).toContain('body{');
    expect(css.trim()).not.toContain('\n');
  }, 60_000);

  it('supports repeated builds across Guchho service restarts', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Repeated Build Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/background.ts': 'console.log("repeat-v1");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const firstReports = await buildProject(config);
    const first = firstReports[0];

    expect(first).toBeDefined();

    if (first === undefined) {
      throw new Error('Expected the first repeated build report.');
    }

    const backgroundPath = path.join(first.outdir, 'background.js');

    expect(first.result.success).toBe(true);
    expect(readFileSync(backgroundPath, 'utf8')).toContain('repeat-v1');

    writeFileSync(
      path.join(root, 'src/background.ts'),
      'console.log("repeat-v2");\n',
      'utf8',
    );

    const secondReports = await buildProject(config);
    const second = secondReports[0];

    expect(second).toBeDefined();

    if (second === undefined) {
      throw new Error('Expected the second repeated build report.');
    }

    expect(second.result.success).toBe(true);
    expect(second.result.errors).toEqual([]);
    expect(second.outdir).toBe(first.outdir);
    expect(existsSync(path.join(second.outdir, 'manifest.json'))).toBe(true);
    expect(readFileSync(backgroundPath, 'utf8')).toContain('repeat-v2');
    expect(readFileSync(backgroundPath, 'utf8')).not.toContain('repeat-v1');
  }, 60_000);

  it('tree-shakes unused exports in production without minification', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Tree Shaking Demo', version: '1.0.0' },
  minify: false,
};
`,
      'src/util.ts': `export function used() { return 'tree-used'; }\nexport function unused() { return 'tree-unused'; }\n`,
      'src/background.ts': `import { used } from './util';\nconsole.log(used());\n`,
    });
    const config = await resolveProjectConfig({ cwd: root });
    const reports = await buildProject(config);
    const report = reports[0];

    expect(report).toBeDefined();

    if (report === undefined) {
      throw new Error('Expected one production build report.');
    }

    const background = readFileSync(
      path.join(report.outdir, 'background.js'),
      'utf8',
    );

    expect(config.mode).toBe('production');
    expect(report.result.success).toBe(true);
    expect(background).toContain('tree-used');
    expect(background).not.toContain('tree-unused');
  }, 30_000);
});

function hasAsset(outputs: readonly string[], extension: string): boolean {
  return outputs.some(
    (file) =>
      file.startsWith('assets/') && file.endsWith(extension),
  );
}

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-build-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
