import { createHash } from 'node:crypto';
import http from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

import type { ManifestVersion } from '../core/types.ts';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

export const DEV_MANIFEST_NAME_SUFFIX = ' (Development)';

export interface DevReloadMessage {
  type: 'reload';
}

export interface DevReloadServerOptions {
  host?: string;
  port?: number;
  onConnection?: (connections: number) => void;
  onError?: (error: unknown) => void;
}

export class DevReloadServer {
  private readonly host: string;
  private readonly requestedPort: number;
  private readonly onConnection: ((connections: number) => void) | undefined;
  private readonly onError: ((error: unknown) => void) | undefined;
  private server: http.Server | null = null;
  private readonly sockets = new Set<Socket>();
  private actualPort: number | null = null;

  constructor(options: DevReloadServerOptions = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.requestedPort = options.port ?? 0;
    this.onConnection = options.onConnection;
    this.onError = options.onError;
  }

  get url(): string | null {
    return this.actualPort === null
      ? null
      : `ws://${this.host}:${this.actualPort}/`;
  }

  get connections(): number {
    return this.sockets.size;
  }

  async start(): Promise<string> {
    if (this.server !== null && this.url !== null) {
      return this.url;
    }

    const server = http.createServer((_request, response) => {
      response.statusCode = 426;
      response.end('Upgrade Required');
    });

    server.on('upgrade', (request, socket) => {
      this.handleUpgrade(request, socket as Socket);
    });
    server.on('clientError', (error, socket) => {
      this.onError?.(error);
      socket.destroy();
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.requestedPort, this.host, () => {
        server.off('error', reject);
        resolve();
      });
    });

    this.server = server;
    const address = server.address();
    this.actualPort =
      typeof address === 'object' && address !== null
        ? address.port
        : this.requestedPort;

    return this.url ?? '';
  }

  reload(message: DevReloadMessage = { type: 'reload' }): number {
    const text = JSON.stringify(message);
    const payload = Buffer.from(text, 'utf8');
    let delivered = 0;

    for (const socket of [...this.sockets]) {
      try {
        writeFrame(socket, OPCODE_TEXT, payload);
        delivered += 1;
      } catch (error) {
        this.onError?.(error);
        this.remove(socket);
      }
    }

    return delivered;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.actualPort = null;

    for (const socket of [...this.sockets]) {
      this.remove(socket);
      socket.destroy();
    }

    if (server === null) {
      return;
    }

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
      server.closeAllConnections?.();
    });
  }

  private handleUpgrade(request: IncomingMessage, socket: Socket): void {
    const key = request.headers['sec-websocket-key'];

    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }

    const accept = createHash('sha1')
      .update(`${key}${WEBSOCKET_GUID}`)
      .digest('base64');

    socket.setNoDelay(true);
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

    this.sockets.add(socket);
    this.onConnection?.(this.sockets.size);

    let buffer: Buffer = Buffer.alloc(0);

    socket.on('data', (chunk: Buffer) => {
      buffer = this.consume(Buffer.concat([buffer, chunk]), socket);
    });
    socket.on('close', () => {
      this.remove(socket);
    });
    socket.on('error', (error) => {
      this.onError?.(error);
      this.remove(socket);
    });
  }

  private consume(buffer: Buffer, socket: Socket): Buffer {
    let offset = 0;

    while (buffer.length - offset >= 2) {
      const first = buffer.readUInt8(offset);
      const second = buffer.readUInt8(offset + 1);
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let headerSize = 2;

      if (length === 126) {
        if (buffer.length - offset < 4) {
          break;
        }

        length = buffer.readUInt16BE(offset + 2);
        headerSize = 4;
      } else if (length === 127) {
        if (buffer.length - offset < 10) {
          break;
        }

        length = Number(buffer.readBigUInt64BE(offset + 2));
        headerSize = 10;
      }

      const maskOffset = offset + headerSize;
      const payloadOffset = maskOffset + (masked ? 4 : 0);

      if (buffer.length - offset < payloadOffset - offset + length) {
        break;
      }

      const payload = Buffer.from(
        buffer.subarray(payloadOffset, payloadOffset + length),
      );

      if (masked) {
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] = payload.readUInt8(index) ^
            buffer.readUInt8(maskOffset + (index % 4));
        }
      }

      offset = payloadOffset + length;
      this.handleFrame(socket, opcode, payload);
    }

    return buffer.subarray(offset);
  }

  private handleFrame(socket: Socket, opcode: number, payload: Buffer): void {
    if (opcode === OPCODE_CLOSE) {
      try {
        writeFrame(socket, OPCODE_CLOSE, payload);
      } catch {
        // The peer may already be gone.
      }

      this.remove(socket);
      socket.end();
      return;
    }

    if (opcode === OPCODE_PING) {
      try {
        writeFrame(socket, OPCODE_PONG, payload);
      } catch (error) {
        this.onError?.(error);
        this.remove(socket);
      }
    }
  }

  private remove(socket: Socket): void {
    if (this.sockets.delete(socket)) {
      this.onConnection?.(this.sockets.size);
    }
  }
}

export interface ApplyDevManifestAdditionsOptions {
  manifestVersion: ManifestVersion;
}

export function applyDevManifestAdditions(
  manifest: Record<string, unknown>,
  options: ApplyDevManifestAdditionsOptions,
): void {
  const name = manifest.name;

  if (
    typeof name === 'string' &&
    name.length > 0 &&
    !name.endsWith(DEV_MANIFEST_NAME_SUFFIX)
  ) {
    manifest.name = `${name}${DEV_MANIFEST_NAME_SUFFIX}`;
  }

  const permissions: unknown[] = Array.isArray(manifest.permissions)
    ? [...manifest.permissions]
    : [];
  const additions =
    options.manifestVersion === 3 ? ['tabs', 'scripting'] : ['tabs'];

  for (const permission of additions) {
    if (!permissions.includes(permission)) {
      permissions.push(permission);
    }
  }

  manifest.permissions = permissions;
}

function writeFrame(socket: Socket, opcode: number, payload: Buffer): void {
  const length = payload.length;
  let header: Buffer;

  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}
