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

describe('convention entrypoints', () => {
  it('discovers entrypoints and synthesizes the manifest', async () => {
    const root = createProject({
      'package.json': JSON.stringify({
        name: 'convention-demo',
        version: '1.2.3-beta.1',
      }),
      'addonova.config.ts': `export default {
  browsers: ['chrome'],
  minify: false,
};
`,
      'src/entrypoints/background.ts': `function defineBackground(options) { return options; }
export default defineBackground({ main() { console.log('background'); } });
`,
      'src/entrypoints/content.ts': `import './content.css';
function defineContentScript(options) { return options; }
export default defineContentScript({
  matches: ['https://example.com/*'],
  runAt: 'document_end',
  allFrames: true,
  main() { console.log('content'); },
});
`,
      'src/entrypoints/content.css': 'body { outline: 1px solid red; }\n',
      'src/entrypoints/popup.html': page('Popup'),
      'src/entrypoints/options.html': page('Options'),
      'src/entrypoints/sidepanel.html': page('Side panel'),
      'src/entrypoints/devtools.html': page('Devtools'),
      'src/entrypoints/newtab.html': page('New tab'),
      'src/entrypoints/sandbox.html': page('Sandbox'),
      'public/icons/icon-16.png': 'png',
      'public/icons/icon-32.png': 'png',
      'public/icons/icon-light-16.png': 'png',
      'public/icons/icon-dark-16.png': 'png',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const [report] = await buildProject(config);

    expect(report).toBeDefined();

    if (report === undefined) {
      return;
    }

    const manifest = report.manifest;

    expect(manifest).toMatchObject({
      name: 'convention-demo',
      version: '1.2.3',
      version_name: '1.2.3-beta.1',
      manifest_version: 3,
      background: { service_worker: 'background.js' },
      action: { default_popup: 'popup.html' },
      options_ui: { page: 'options.html' },
      side_panel: { default_path: 'sidepanel.html' },
      devtools_page: 'devtools.html',
      chrome_url_overrides: { newtab: 'newtab.html' },
      sandbox: { pages: ['sandbox.html'] },
      icons: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
      },
    });

    const contentScripts = manifest?.content_scripts;

    expect(Array.isArray(contentScripts)).toBe(true);

    if (!Array.isArray(contentScripts)) {
      return;
    }

    const contentScript = contentScripts[0];
    expect(contentScript).toMatchObject({
      matches: ['https://example.com/*'],
      js: ['content.js'],
      run_at: 'document_end',
      all_frames: true,
    });

    const css = readStringArray(contentScript, 'css');
    expect(css.length).toBe(1);
    expect(existsSync(path.join(report.outdir, css[0] ?? ''))).toBe(true);
    expect(manifest?.theme_icons).toEqual([
      {
        light: 'icons/icon-light-16.png',
        dark: 'icons/icon-dark-16.png',
        size: 16,
      },
    ]);
    expect(report.manifestDiagnostics).toEqual([]);
  }, 30_000);

  it('evaluates manifest functions per browser and mode', async () => {
    const root = createProject({
      'package.json': JSON.stringify({ name: 'function-demo', version: '5.0.0' }),
      'addonova.config.ts': `export default {
  browsers: {
    chrome: { manifest_version: 3 },
    firefox: { manifest_version: 2 },
  },
  entrypoints: { background: 'src/background.ts' },
  manifest: (context) => ({
    name: 'Function demo',
    version: '9.9.9',
    description: [context.browser, context.manifestVersion, context.mode, context.command].join('|'),
  }),
  minify: false,
};
`,
      'src/background.ts': 'console.log("background");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const reports = await buildProject(config);

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.manifest?.description)).toEqual([
      'chrome|3|production|build',
      'firefox|2|production|build',
    ]);
    expect(reports.map((report) => report.manifest?.version)).toEqual([
      '9.9.9',
      '9.9.9',
    ]);
    expect(reports[0]?.manifest?.background).toEqual({
      service_worker: 'background.js',
    });
    expect(reports[1]?.manifest?.background).toEqual({
      scripts: ['background.js'],
    });
  }, 30_000);

  it('injects import.meta.env values from dotenv files', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  browsers: ['chrome'],
  entrypoints: { background: 'src/background.ts' },
  manifest: { name: 'Env demo', version: '1.0.0' },
  minify: false,
};
`,
      '.env': 'ADDONOVA_API_URL=https://base.example.com\nVITE_FLAG=base\n',
      '.env.production': 'ADDONOVA_API_URL=https://production.example.com\n',
      '.env.chrome': 'ADDONOVA_API_URL=https://chrome.example.com\n',
      'src/background.ts': `console.log(
  import.meta.env.BROWSER,
  import.meta.env.MODE,
  import.meta.env.DEV,
  import.meta.env.PROD,
  import.meta.env.MANIFEST_VERSION,
  import.meta.env.ADDONOVA_API_URL,
  import.meta.env.VITE_FLAG,
);
`,
    });
    const config = await resolveProjectConfig({ cwd: root });
    const [report] = await buildProject(config);

    expect(report).toBeDefined();

    if (report === undefined) {
      return;
    }

    const background = readFileSync(
      path.join(report.outdir, 'background.js'),
      'utf8',
    );

    expect(background).toContain('"chrome"');
    expect(background).toContain('"production"');
    expect(background).toContain('false');
    expect(background).toContain('true');
    expect(background).toContain('3');
    expect(background).toContain('https://chrome.example.com');
    expect(background).toContain('"base"');
  }, 30_000);

  it('reports discovered content scripts without matches', async () => {
    const root = createProject({
      'addonova.config.ts': `export default {
  browsers: ['chrome'],
  manifest: { name: 'Missing matches', version: '1.0.0' },
  minify: false,
};
`,
      'src/entrypoints/content.ts': 'console.log("content");\n',
    });
    const config = await resolveProjectConfig({ cwd: root });
    const [report] = await buildProject(config);

    expect(report).toBeDefined();
    expect(
      report?.manifestDiagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'ADDONOVA_MANIFEST_CONTENT_SCRIPT_MATCHES' &&
          diagnostic.severity === 'error',
      ),
    ).toBe(true);
    expect(report?.manifestPath).toBe(null);
  }, 30_000);
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-entrypoints-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}

function page(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body></body></html>\n`;
}

function readStringArray(
  value: unknown,
  key: string,
): readonly string[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const entry = (value as Record<string, unknown>)[key];

  return Array.isArray(entry)
    ? entry.filter((item): item is string => typeof item === 'string')
    : [];
}
