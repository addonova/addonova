import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import {
  collectLocales,
  parseI18nMessages,
  parseMessagesJson,
  validateManifestLocales,
} from '../../src/browser/locales.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('locale parsing', () => {
  it('parses flat i18n message files', () => {
    const parsed = parseI18nMessages(
      `@app_name
Volume Booster

@app_description
Line one
Line two
`,
      'en.i18n',
    );

    expect(parsed.messages).toEqual({
      app_name: { message: 'Volume Booster' },
      app_description: { message: 'Line one Line two' },
    });
    expect(parsed.diagnostics).toEqual([]);
  });

  it('reports duplicate and empty i18n messages', () => {
    const parsed = parseI18nMessages(
      `@app_name
First
@app_name
Second
@empty
`,
      'hi.i18n',
      'warning',
    );

    expect(parsed.messages.app_name).toEqual({ message: 'Second' });
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'ADDONOVA_LOCALES_DUPLICATE',
        'ADDONOVA_LOCALES_INVALID',
      ]),
    );
    expect(
      parsed.diagnostics.every(
        (diagnostic) => diagnostic.severity === 'warning',
      ),
    ).toBe(true);
  });

  it('parses standard messages.json files with placeholders', () => {
    const parsed = parseMessagesJson(
      JSON.stringify({
        app_name: {
          message: 'Demo $name$',
          description: 'Extension name.',
          placeholders: {
            name: { content: '$1', example: 'Demo' },
          },
        },
      }),
      'messages.json',
      'error',
    );

    expect(parsed.messages).toEqual({
      app_name: {
        message: 'Demo $name$',
        description: 'Extension name.',
        placeholders: {
          name: { content: '$1', example: 'Demo' },
        },
      },
    });
    expect(parsed.diagnostics).toEqual([]);
  });

  it('reports invalid standard messages.json entries', () => {
    const parsed = parseMessagesJson(
      JSON.stringify({
        app_name: { message: '' },
        bad_key: 'not-an-object',
        bad_placeholders: {
          message: 'Hi $name$',
          placeholders: { name: { content: '' } },
        },
      }),
      'messages.json',
      'error',
    );

    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'ADDONOVA_LOCALES_INVALID',
      ]),
    );
    expect(
      parsed.diagnostics.every(
        (diagnostic) => diagnostic.severity === 'error',
      ),
    ).toBe(true);
  });
});

describe('locale collection', () => {
  it('collects flat sources and generates messages.json files', () => {
    const root = createProject({
      'src/_locales/en.i18n': '@app_name\nDemo\n',
      'src/_locales/hi.i18n': '@app_name\nडेमो\n',
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });

    expect([...collection.catalogs.keys()]).toEqual(['en', 'hi']);
    expect(collection.files).toEqual([
      {
        path: '_locales/en/messages.json',
        contents: '{\n  "app_name": {\n    "message": "Demo"\n  }\n}\n',
      },
      {
        path: '_locales/hi/messages.json',
        contents: '{\n  "app_name": {\n    "message": "डेमो"\n  }\n}\n',
      },
    ]);
    expect(collection.diagnostics).toEqual([]);
  });

  it('collects standard public locales', () => {
    const root = createProject({
      'public/_locales/en/messages.json': JSON.stringify({
        app_name: { message: 'Demo' },
      }),
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });

    expect(collection.files).toEqual([]);
    expect(collection.catalogs.get('en')?.messages).toEqual({
      app_name: { message: 'Demo' },
    });
    expect(collection.diagnostics).toEqual([]);
  });

  it('errors for the default locale and warns for other locales', () => {
    const root = createProject({
      'src/_locales/en.i18n': '@app_name\n',
      'src/_locales/hi.i18n': '@app_name\n',
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });

    expect(
      collection.diagnostics.find(
        (diagnostic) =>
          diagnostic.severity === 'error' &&
          diagnostic.code === 'ADDONOVA_LOCALES_INVALID',
      ),
    ).toBeDefined();
    expect(
      collection.diagnostics.find(
        (diagnostic) =>
          diagnostic.severity === 'warning' &&
          diagnostic.code === 'ADDONOVA_LOCALES_INVALID',
      ),
    ).toBeDefined();
  });

  it('errors when a locale is defined by both source layouts', () => {
    const root = createProject({
      'public/_locales/en/messages.json': JSON.stringify({
        app_name: { message: 'Public' },
      }),
      'src/_locales/en.i18n': '@app_name\nSource\n',
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });

    expect(collection.catalogs.size).toBe(1);
    expect(collection.files).toEqual([]);
    expect(collection.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'ADDONOVA_LOCALES_DUPLICATE',
    );
  });
});

describe('manifest locale validation', () => {
  it('requires default_locale when locale sources exist', () => {
    const root = createProject({
      'src/_locales/en.i18n': '@app_name\nDemo\n',
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });
    const diagnostics = validateManifestLocales(
      { name: '__MSG_app_name__', version: '1.0.0' },
      collection,
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'ADDONOVA_MANIFEST_DEFAULT_LOCALE',
    );
  });

  it('requires locale sources when default_locale is set', () => {
    const root = createProject({});
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
    });
    const diagnostics = validateManifestLocales(
      { name: 'Demo', version: '1.0.0', default_locale: 'en' },
      collection,
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'ADDONOVA_MANIFEST_LOCALES_MISSING',
    );
  });

  it('requires locale sources when manifest fields use __MSG_ references', () => {
    const root = createProject({});
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
    });
    const diagnostics = validateManifestLocales(
      { name: '__MSG_app_name__', version: '1.0.0' },
      collection,
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'ADDONOVA_MANIFEST_LOCALES_MISSING',
    );
  });

  it('validates default references and warns for other locales', () => {
    const root = createProject({
      'src/_locales/en.i18n': '@app_name\nDemo\n',
      'src/_locales/hi.i18n': '@other\nअन्य\n',
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });
    const diagnostics = validateManifestLocales(
      {
        name: '__MSG_app_name__',
        version: '1.0.0',
        default_locale: 'en',
      },
      collection,
    );

    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'ADDONOVA_MANIFEST_LOCALE_MESSAGE_MISSING' &&
          diagnostic.severity === 'warning',
      ),
    ).toBe(true);
    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'ADDONOVA_MANIFEST_LOCALE_MESSAGE_MISSING' &&
          diagnostic.severity === 'error',
      ),
    ).toBe(false);
  });

  it('errors when the default locale misses a referenced message', () => {
    const root = createProject({
      'src/_locales/en.i18n': '@app_name\nDemo\n',
    });
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
      defaultLocale: 'en',
    });
    const diagnostics = validateManifestLocales(
      {
        name: '__MSG_app_name__',
        description: '__MSG_missing__',
        version: '1.0.0',
        default_locale: 'en',
      },
      collection,
    );

    expect(
      diagnostics.find(
        (diagnostic) =>
          diagnostic.code === 'ADDONOVA_MANIFEST_LOCALE_MESSAGE_MISSING' &&
          diagnostic.severity === 'error',
      ),
    ).toBeDefined();
  });

  it('accepts manifests without localized fields', () => {
    const root = createProject({});
    const collection = collectLocales({
      root,
      srcDir: 'src',
      publicDir: path.join(root, 'public'),
    });

    expect(
      validateManifestLocales(
        { name: 'Demo', version: '1.0.0' },
        collection,
      ),
    ).toEqual([]);
  });
});

function createProject(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'addonova-locales-'));
  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return root;
}
