import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@guchho/test';

import {
  createDevReloadClientSource,
  DEV_RELOAD_CLIENT_FILENAME,
  DEV_RELOAD_CLIENT_MARKER,
  injectDevReloadClient,
} from '../../src/dev/reload-client.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dev reload client', () => {
  it('creates a client that reconnects and reloads content scripts', () => {
    const source = createDevReloadClientSource({
      url: 'ws://127.0.0.1:1234/',
    });

    expect(source).toContain(DEV_RELOAD_CLIENT_MARKER);
    expect(source).toContain('ws://127.0.0.1:1234/');
    expect(source).toContain('runtime.reload');
    expect(source).toContain('content_scripts');
    expect(source).toContain('tabs.query');
    expect(source).toContain('new WebSocket(url)');
  });

  it('appends to an MV3 background service worker', () => {
    const staging = createStaging({ 'background.js': 'console.log("bg");\n' });
    const manifest: Record<string, unknown> = {
      manifest_version: 3,
      background: { service_worker: 'background.js' },
    };

    const injection = injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    const contents = readFileSync(
      path.join(staging, 'background.js'),
      'utf8',
    );

    expect(injection.files).toEqual(['background.js']);
    expect(injection.warnings).toHaveLength(0);
    expect(contents.startsWith('console.log("bg");')).toBe(true);
    expect(contents).toContain(DEV_RELOAD_CLIENT_MARKER);
  });

  it('appends to the first existing background script', () => {
    const staging = createStaging({
      'first.js': 'first();\n',
      'second.js': 'second();\n',
    });
    const manifest: Record<string, unknown> = {
      manifest_version: 2,
      background: { scripts: ['missing.js', 'second.js'] },
    };

    const injection = injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    expect(injection.files).toEqual(['second.js']);
    expect(readFileSync(path.join(staging, 'second.js'), 'utf8')).toContain(
      DEV_RELOAD_CLIENT_MARKER,
    );
    expect(readFileSync(path.join(staging, 'first.js'), 'utf8')).not.toContain(
      DEV_RELOAD_CLIENT_MARKER,
    );
  });

  it('creates a standalone background entry when none is configured', () => {
    const staging = createStaging({});
    const manifest: Record<string, unknown> = { manifest_version: 3 };

    const injection = injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    expect(injection.files).toEqual([DEV_RELOAD_CLIENT_FILENAME]);
    expect(manifest.background).toEqual({
      service_worker: DEV_RELOAD_CLIENT_FILENAME,
    });
    expect(
      readFileSync(path.join(staging, DEV_RELOAD_CLIENT_FILENAME), 'utf8'),
    ).toContain(DEV_RELOAD_CLIENT_MARKER);
  });

  it('creates a standalone scripts entry for MV2 manifests', () => {
    const staging = createStaging({});
    const manifest: Record<string, unknown> = { manifest_version: 2 };

    injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    expect(manifest.background).toEqual({
      scripts: [DEV_RELOAD_CLIENT_FILENAME],
    });
  });

  it('does not append the client twice', () => {
    const staging = createStaging({ 'background.js': 'bg();\n' });
    const manifest: Record<string, unknown> = {
      manifest_version: 3,
      background: { service_worker: 'background.js' },
    };

    injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });
    injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    const contents = readFileSync(
      path.join(staging, 'background.js'),
      'utf8',
    );

    expect(contents.split(DEV_RELOAD_CLIENT_MARKER)).toHaveLength(2);
  });

  it('warns when the configured service worker is missing', () => {
    const staging = createStaging({});
    const manifest: Record<string, unknown> = {
      manifest_version: 3,
      background: { service_worker: 'missing.js' },
    };

    const injection = injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    expect(injection.files).toEqual([]);
    expect(injection.warnings).toHaveLength(1);
    expect(injection.warnings[0]?.code).toBe(
      'ADDONOVA_DEV_RELOAD_CLIENT_UNAVAILABLE',
    );
  });

  it('warns about background pages', () => {
    const staging = createStaging({ 'background.html': '<html></html>' });
    const manifest: Record<string, unknown> = {
      manifest_version: 2,
      background: { page: 'background.html' },
    };

    const injection = injectDevReloadClient({
      manifest,
      staging,
      url: 'ws://127.0.0.1:1234/',
    });

    expect(injection.files).toEqual([]);
    expect(injection.warnings[0]?.message).toContain(
      'Background pages are not supported',
    );
  });
});

function createStaging(files: Readonly<Record<string, string>>): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'addonova-reload-client-'));
  tempDirs.push(directory);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(directory, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  return directory;
}
