import { createHash } from 'node:crypto';
import net from 'node:net';

import { describe, expect, it } from '@guchho/test';

import { connectWebSocket } from '../../src/launcher/websocket.ts';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

describe('minimal WebSocket client', () => {
  it('upgrades, masks client messages, and receives text frames', async () => {
    const received = new Set<string>();
    const server = net.createServer((socket) => {
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
          setTimeout(() => {
            socket.write(encodeServerFrame(0x1, Buffer.from('hello')));
          }, 10);
        }

        const frame = decodeClientFrame(buffer);

        if (frame === null) {
          return;
        }

        buffer = frame.rest;
        received.add(frame.payload.toString('utf8'));
      });
    });
    const url = await listen(server);
    const connection = await connectWebSocket(url);
    const messages: string[] = [];

    connection.onText((message) => {
      messages.push(message);
    });

    await waitFor(() => messages.includes('hello'));
    connection.send('world');
    await waitFor(() => received.has('world'));
    connection.close();
    await waitFor(() => !connection.isOpen);
    await closeServer(server);

    expect(messages).toEqual(['hello']);
    expect(received.has('world')).toBe(true);
  }, 10_000);
});

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
