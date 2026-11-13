import { describe, expect, it } from '@guchho/test';

import {
  applyDevManifestAdditions,
  DevReloadServer,
  DEV_MANIFEST_NAME_SUFFIX,
} from '../../src/dev/browser.ts';
import { connectWebSocket } from '../../src/launcher/websocket.ts';

describe('dev reload server', () => {
  it('broadcasts reload messages to connected clients', async () => {
    const server = new DevReloadServer();
    const url = await server.start();
    const connection = await connectWebSocket(url);
    const messages: string[] = [];

    connection.onText((message) => {
      messages.push(message);
    });

    await waitFor(() => server.connections === 1);

    expect(server.reload()).toBe(1);
    await waitFor(() => messages.length === 1);
    expect(JSON.parse(messages[0] ?? '')).toEqual({ type: 'reload' });

    connection.close();
    await waitFor(() => server.connections === 0);
    await server.close();
  }, 10_000);

  it('starts and closes cleanly without clients', async () => {
    const server = new DevReloadServer();

    expect(server.url).toBeNull();

    const url = await server.start();

    expect(url.startsWith('ws://127.0.0.1:')).toBe(true);
    expect(server.url).toBe(url);
    expect(server.reload()).toBe(0);

    await server.close();

    expect(server.url).toBeNull();
  }, 10_000);
});

describe('dev manifest additions', () => {
  it('adds MV3 permissions and a development name suffix', () => {
    const manifest: Record<string, unknown> = {
      name: 'Demo Extension',
      manifest_version: 3,
      permissions: ['storage'],
    };

    applyDevManifestAdditions(manifest, { manifestVersion: 3 });

    expect(manifest.name).toBe(`Demo Extension${DEV_MANIFEST_NAME_SUFFIX}`);
    expect(manifest.permissions).toEqual(['storage', 'tabs', 'scripting']);
  });

  it('adds only tabs for MV2 and preserves existing permissions', () => {
    const manifest: Record<string, unknown> = {
      name: 'Demo Extension',
      manifest_version: 2,
      permissions: ['tabs', 'storage'],
    };

    applyDevManifestAdditions(manifest, { manifestVersion: 2 });

    expect(manifest.permissions).toEqual(['tabs', 'storage']);
  });

  it('does not duplicate the development name suffix', () => {
    const manifest: Record<string, unknown> = {
      name: `Demo Extension${DEV_MANIFEST_NAME_SUFFIX}`,
      manifest_version: 3,
    };

    applyDevManifestAdditions(manifest, { manifestVersion: 3 });

    expect(manifest.name).toBe(`Demo Extension${DEV_MANIFEST_NAME_SUFFIX}`);
    expect(manifest.permissions).toEqual(['tabs', 'scripting']);
  });
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const started = Date.now();

  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for a condition.');
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}
