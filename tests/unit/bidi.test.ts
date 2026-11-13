import { describe, expect, it } from '@guchho/test';

import {
  BidiError,
  createBidiClient,
} from '../../src/launcher/bidi.ts';
import type { WebSocketConnection } from '../../src/launcher/websocket.ts';

interface SentMessage {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

describe('WebDriver BiDi client', () => {
  it('starts a session', async () => {
    const fake = createFakeConnection((message) => {
      fake.respond({ id: message.id, result: {} });
    });
    const client = createBidiClient(fake.connection, { timeoutMs: 50 });

    await client.newSession();

    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.method).toBe('session.new');
    expect(fake.sent[0]?.params).toEqual({ capabilities: {} });

    client.dispose();
  });

  it('installs a web extension and returns its id', async () => {
    const fake = createFakeConnection((message) => {
      fake.respond({ id: message.id, result: { extension: 'ext-1' } });
    });
    const client = createBidiClient(fake.connection, { timeoutMs: 50 });

    const extensionId = await client.installWebExtension(
      '/project/dist/firefox',
    );

    expect(extensionId).toBe('ext-1');
    expect(fake.sent[0]?.method).toBe('webExtension.install');
    expect(fake.sent[0]?.params).toEqual({
      extensionData: { type: 'path', path: '/project/dist/firefox' },
    });

    client.dispose();
  });

  it('accepts the extensions array install response', async () => {
    const fake = createFakeConnection((message) => {
      fake.respond({
        id: message.id,
        result: { extensions: [{ extension: 'ext-2' }] },
      });
    });
    const client = createBidiClient(fake.connection, { timeoutMs: 50 });

    expect(await client.installWebExtension('/project/dist/firefox')).toBe(
      'ext-2',
    );

    client.dispose();
  });

  it('uninstalls a web extension', async () => {
    const fake = createFakeConnection((message) => {
      fake.respond({ id: message.id, result: {} });
    });
    const client = createBidiClient(fake.connection, { timeoutMs: 50 });

    await client.uninstallWebExtension('ext-1');

    expect(fake.sent[0]?.method).toBe('webExtension.uninstall');
    expect(fake.sent[0]?.params).toEqual({ extension: 'ext-1' });

    client.dispose();
  });

  it('closes the browser', async () => {
    const fake = createFakeConnection((message) => {
      fake.respond({ id: message.id, result: {} });
    });
    const client = createBidiClient(fake.connection, { timeoutMs: 50 });

    await client.closeBrowser();

    expect(fake.sent[0]?.method).toBe('browser.close');

    client.dispose();
  });

  it('times out unanswered commands', async () => {
    const fake = createFakeConnection();
    const client = createBidiClient(fake.connection, { timeoutMs: 10 });

    try {
      await client.call('session.new', {}, 10);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('timed out');
      client.dispose();
      return;
    }

    throw new Error('Expected a BiDi timeout.');
  });

  it('surfaces BiDi command errors', async () => {
    const fake = createFakeConnection((message) => {
      fake.respond({
        id: message.id,
        error: 'unsupported operation',
        message: 'webExtension.install is not supported',
      });
    });
    const client = createBidiClient(fake.connection, { timeoutMs: 50 });

    try {
      await client.installWebExtension('/project/dist/firefox');
    } catch (error) {
      expect(error).toBeInstanceOf(BidiError);
      expect((error as BidiError).method).toBe('webExtension.install');
      expect((error as Error).message).toContain('not supported');
      client.dispose();
      return;
    }

    throw new Error('Expected a BiDi error.');
  });
});

interface FakeConnection {
  connection: WebSocketConnection;
  sent: SentMessage[];
  respond: (payload: Record<string, unknown>) => void;
}

function createFakeConnection(
  onSend?: (message: SentMessage) => void,
): FakeConnection {
  let open = true;
  const textListeners = new Set<(text: string) => void>();
  const closeListeners = new Set<() => void>();
  const sent: SentMessage[] = [];

  const connection: WebSocketConnection = {
    get isOpen(): boolean {
      return open;
    },
    send(text: string): void {
      const message = JSON.parse(text) as SentMessage;
      sent.push(message);
      onSend?.(message);
    },
    close(): void {
      if (!open) {
        return;
      }

      open = false;

      for (const listener of [...closeListeners]) {
        listener();
      }
    },
    onText(listener: (text: string) => void): () => void {
      textListeners.add(listener);
      return () => {
        textListeners.delete(listener);
      };
    },
    onClose(listener: () => void): () => void {
      closeListeners.add(listener);
      return () => {
        closeListeners.delete(listener);
      };
    },
  };

  return {
    connection,
    sent,
    respond(payload): void {
      const text = JSON.stringify(payload);

      for (const listener of [...textListeners]) {
        listener(text);
      }
    },
  };
}
