import { createHash } from 'node:crypto';
import net from 'node:net';
import { PassThrough } from 'node:stream';

import { describe, expect, it } from '@guchho/test';

import { CdpError } from '../../src/launcher/cdp.ts';
import { BidiError } from '../../src/launcher/bidi.ts';
import {
  installChromium,
  installFirefox,
} from '../../src/launcher/install.ts';
import type { ManagedProcess } from '../../src/launcher/process.ts';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

interface SentMessage {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

describe('browser extension install helpers', () => {
  it('loads a Chromium extension over the CDP pipe', async () => {
    const fake = createFakeChromium((message) => ({
      id: message.id,
      result: { id: 'ext-123' },
    }));

    const { cdp, extensionId } = await installChromium(fake.process, '/dist/chrome');

    expect(extensionId).toBe('ext-123');
    expect(fake.methods).toEqual(['Extensions.loadUnpacked']);
    expect(fake.params[0]).toEqual({ path: '/dist/chrome' });

    cdp.dispose();
  });

  it('propagates Chromium load failures', async () => {
    const fake = createFakeChromium((message) => ({
      id: message.id,
      error: { code: -32601, message: 'Method not found' },
    }));

    try {
      await installChromium(fake.process, '/dist/chrome');
    } catch (error) {
      expect(error).toBeInstanceOf(CdpError);
      expect((error as CdpError).method).toBe('Extensions.loadUnpacked');
      return;
    }

    throw new Error('Expected a CDP error.');
  });

  it('starts a BiDi session and installs a Firefox extension', async () => {
    let sessionEstablished = false;
    const server = createBidiServer((method) => {
      if (method === 'session.new') {
        return { result: {} };
      }

      return { result: { extension: 'ext-firefox' } };
    });
    const url = await listen(server);

    try {
      const { bidi, extensionId } = await installFirefox(
        url,
        '/dist/firefox',
        {
          timeoutMs: 1_000,
          onSessionEstablished: () => {
            sessionEstablished = true;
          },
        },
      );

      expect(extensionId).toBe('ext-firefox');
      expect(sessionEstablished).toBe(true);

      bidi.dispose();
    } finally {
      await closeServer(server);
    }
  }, 10_000);

  it('propagates Firefox install failures', async () => {
    const server = createBidiServer((method) => {
      if (method === 'session.new') {
        return { result: {} };
      }

      return { error: 'unsupported operation', message: 'not supported' };
    });
    const url = await listen(server);

    try {
      await installFirefox(url, '/dist/firefox', { timeoutMs: 1_000 });
    } catch (error) {
      expect(error).toBeInstanceOf(BidiError);
      expect((error as BidiError).method).toBe('webExtension.install');
      return;
    } finally {
      await closeServer(server);
    }

    throw new Error('Expected a BiDi error.');
  }, 10_000);
});

interface FakeChromium {
  process: ManagedProcess;
  methods: string[];
  params: Array<Record<string, unknown> | undefined>;
}

function createFakeChromium(
  respond: (message: SentMessage) => Record<string, unknown>,
): FakeChromium {
  const outgoing = new PassThrough();
  const incoming = new PassThrough();
  const methods: string[] = [];
  const params: Array<Record<string, unknown> | undefined> = [];
  let buffer = '';

  outgoing.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();

    let separatorIndex = buffer.indexOf('\0');

    while (separatorIndex !== -1) {
      const raw = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 1);

      if (raw.length > 0) {
        const message = JSON.parse(raw) as SentMessage;
        methods.push(message.method);
        params.push(message.params);
        incoming.write(`${JSON.stringify(respond(message))}\0`);
      }

      separatorIndex = buffer.indexOf('\0');
    }
  });

  const child = {
    stdio: [null, null, null, outgoing, incoming],
  };

  return {
    process: { child } as unknown as ManagedProcess,
    methods,
    params,
  };
}

function createBidiServer(
  handler: (
    method: string,
    params: Record<string, unknown> | undefined,
  ) => Record<string, unknown>,
): net.Server {
  return net.createServer((socket) => {
    let buffer: Buffer = Buffer.alloc(0);
    let upgraded = false;

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!upgraded) {
        const headerEnd = buffer.indexOf('\r\n\r\n');

        if (headerEnd === -1) {
          return;
        }

        const header = buffer.subarray(0, headerEnd).toString('latin1');
        buffer = buffer.subarray(headerEnd + 4);
        const key = header
          .split('\r\n')
          .find((line) => line.toLowerCase().startsWith('sec-websocket-key:'))
          ?.slice('sec-websocket-key:'.length)
          .trim();
        const accept = createHash('sha1')
          .update(`${key ?? ''}${WEBSOCKET_GUID}`)
          .digest('base64');

        socket.write(
          [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '',
            '',
          ].join('\r\n'),
        );
        upgraded = true;
      }

      let frame = decodeClientFrame(buffer);

      while (frame !== null) {
        buffer = frame.rest;
        const message = JSON.parse(frame.payload.toString('utf8')) as SentMessage;
        const response = handler(message.method, message.params);
        socket.write(
          encodeServerFrame(
            0x1,
            Buffer.from(JSON.stringify({ id: message.id, ...response })),
          ),
        );
        frame = decodeClientFrame(buffer);
      }
    });
  });
}

interface ClientFrame {
  opcode: number;
  payload: Buffer;
  rest: Buffer;
}

function decodeClientFrame(buffer: Buffer): ClientFrame | null {
  if (buffer.length < 2) {
    return null;
  }

  const first = buffer[0] ?? 0;
  const second = buffer[1] ?? 0;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) {
      return null;
    }

    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) {
      return null;
    }

    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!masked) {
    throw new Error('Expected a masked client frame.');
  }

  if (buffer.length < offset + 4 + length) {
    return null;
  }

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.alloc(length);

  for (let index = 0; index < length; index += 1) {
    const byte = buffer[offset + index] ?? 0;
    const maskByte = mask[index % 4] ?? 0;
    payload[index] = byte ^ maskByte;
  }

  return {
    opcode: first & 0x0f,
    payload,
    rest: buffer.subarray(offset + length),
  };
}

function encodeServerFrame(opcode: number, payload: Buffer): Buffer {
  if (payload.length >= 126) {
    throw new Error('The test helper only supports short frames.');
  }

  return Buffer.concat([
    Buffer.from([0x80 | opcode, payload.length]),
    payload,
  ]);
}

function listen(server: net.Server): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (address === null || typeof address === 'string') {
        reject(new Error('Expected a TCP server address.'));
        return;
      }

      resolve(`ws://127.0.0.1:${address.port}/bidi`);
    });
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}
