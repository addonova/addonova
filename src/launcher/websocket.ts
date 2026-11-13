import { createHash, randomBytes } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_BINARY = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

export interface WebSocketConnection {
  readonly isOpen: boolean;
  send(text: string): void;
  close(): void;
  onText(listener: (text: string) => void): () => void;
  onClose(listener: () => void): () => void;
}

export interface ConnectWebSocketOptions {
  timeoutMs?: number;
}

export async function connectWebSocket(
  url: string,
  options: ConnectWebSocketOptions = {},
): Promise<WebSocketConnection> {
  const parsed = new URL(url);

  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error(`Unsupported WebSocket protocol: ${parsed.protocol}`);
  }

  const secure = parsed.protocol === 'wss:';
  const host = parsed.hostname;
  const port =
    parsed.port.length > 0
      ? Number(parsed.port)
      : secure
        ? 443
        : 80;
  const requestPath = `${parsed.pathname}${parsed.search}`;
  const key = randomBytes(16).toString('base64');
  const expectedAccept = createHash('sha1')
    .update(`${key}${WEBSOCKET_GUID}`)
    .digest('base64');
  const timeoutMs = options.timeoutMs ?? 10_000;

  return new Promise<WebSocketConnection>((resolve, reject) => {
    const socket = secure
      ? tls.connect({
          host,
          port,
          servername: host,
        })
      : net.connect({
          host,
          port,
        });

    let settled = false;
    let headerBuffer = Buffer.alloc(0);
    let timer: NodeJS.Timeout;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      socket.off('data', handleHandshakeData);
      socket.destroy();
      reject(error);
    };

    timer = setTimeout(() => {
      fail(new Error(`Timed out connecting to the WebSocket after ${timeoutMs}ms.`));
    }, timeoutMs);

    const handleHandshakeData = (chunk: Buffer): void => {
      headerBuffer = Buffer.concat([headerBuffer, chunk]);
      const headerEnd = headerBuffer.indexOf('\r\n\r\n');

      if (headerEnd === -1) {
        return;
      }

      const header = headerBuffer
        .subarray(0, headerEnd)
        .toString('latin1');
      const leftover = headerBuffer.subarray(headerEnd + 4);
      headerBuffer = Buffer.alloc(0);

      if (!header.startsWith('HTTP/1.1 101')) {
        fail(
          new Error(
            `WebSocket upgrade failed: ${header.split('\r\n')[0] ?? 'unknown response'}`,
          ),
        );
        return;
      }

      const accept = header
        .split('\r\n')
        .find((line) => line.toLowerCase().startsWith('sec-websocket-accept:'))
        ?.slice('sec-websocket-accept:'.length)
        .trim();

      if (accept !== expectedAccept) {
        fail(new Error('WebSocket upgrade failed: invalid Sec-WebSocket-Accept.'));
        return;
      }

      settled = true;
      clearTimeout(timer);
      socket.off('data', handleHandshakeData);

      const connection = new WebSocketConnectionImpl(socket);

      if (leftover.length > 0) {
        connection.handleData(leftover);
      }

      resolve(connection);
    };

    socket.once('error', fail);
    socket.once('close', () => {
      fail(new Error('The WebSocket connection closed during the handshake.'));
    });
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      socket.off('error', fail);
      socket.on('error', (error) => {
        fail(error);
      });
      socket.on('data', handleHandshakeData);
      socket.write(
        [
          `GET ${requestPath} HTTP/1.1`,
          `Host: ${parsed.host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'),
      );
    });
  });
}

class WebSocketConnectionImpl implements WebSocketConnection {
  private readonly socket: net.Socket | tls.TLSSocket;
  private buffer: Buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private fragmentOpcode: number | null = null;
  private open = true;
  private closeEmitted = false;
  private readonly pendingTexts: string[] = [];
  private readonly textListeners = new Set<(text: string) => void>();
  private readonly closeListeners = new Set<() => void>();

  constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    this.socket.on('data', (chunk: Buffer) => {
      this.handleData(chunk);
    });
    this.socket.once('close', () => {
      this.emitClose();
    });
    this.socket.once('error', () => {
      this.emitClose();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  send(text: string): void {
    if (!this.open) {
      throw new Error('The WebSocket is closed.');
    }

    this.socket.write(createFrame(OPCODE_TEXT, Buffer.from(text, 'utf8')));
  }

  close(): void {
    if (!this.open) {
      return;
    }

    this.open = false;
    this.socket.end(createFrame(OPCODE_CLOSE, Buffer.alloc(0)));
  }

  onText(listener: (text: string) => void): () => void {
    this.textListeners.add(listener);

    for (const text of this.pendingTexts.splice(0)) {
      listener(text);
    }

    return () => {
      this.textListeners.delete(listener);
    };
  }

  onClose(listener: () => void): () => void {
    this.closeListeners.add(listener);

    if (!this.open) {
      listener();
    }

    return () => {
      this.closeListeners.delete(listener);
    };
  }

  handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.parseFrames();
  }

  private parseFrames(): void {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];

      if (first === undefined || second === undefined) {
        return;
      }

      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let payloadLength = second & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < 4) {
          return;
        }

        payloadLength = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) {
          return;
        }

        const largeLength = this.buffer.readBigUInt64BE(2);

        if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) {
          this.close();
          return;
        }

        payloadLength = Number(largeLength);
        offset = 10;
      }

      let mask: Buffer | null = null;

      if (masked) {
        if (this.buffer.length < offset + 4) {
          return;
        }

        mask = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (this.buffer.length < offset + payloadLength) {
        return;
      }

      let payload = this.buffer.subarray(offset, offset + payloadLength);

      if (mask !== null) {
        payload = unmask(payload, mask);
      }

      this.buffer = this.buffer.subarray(offset + payloadLength);
      this.handleFrame(fin, opcode, payload);
    }
  }

  private handleFrame(fin: boolean, opcode: number, payload: Buffer): void {
    if (opcode === OPCODE_CLOSE) {
      if (this.open) {
        this.socket.write(createFrame(OPCODE_CLOSE, Buffer.alloc(0)));
      }

      this.open = false;
      this.socket.end();
      this.emitClose();
      return;
    }

    if (opcode === OPCODE_PING) {
      if (this.open) {
        this.socket.write(createFrame(OPCODE_PONG, payload));
      }

      return;
    }

    if (opcode === OPCODE_PONG) {
      return;
    }

    if (opcode === OPCODE_TEXT || opcode === OPCODE_BINARY) {
      if (fin) {
        this.dispatchMessage(opcode, payload);
      } else {
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
      }

      return;
    }

    if (opcode === OPCODE_CONTINUATION && this.fragmentOpcode !== null) {
      this.fragments.push(payload);

      if (fin) {
        const combined = Buffer.concat(this.fragments);
        const originalOpcode = this.fragmentOpcode;
        this.fragments = [];
        this.fragmentOpcode = null;
        this.dispatchMessage(originalOpcode, combined);
      }
    }
  }

  private dispatchMessage(opcode: number, payload: Buffer): void {
    if (opcode !== OPCODE_TEXT) {
      return;
    }

    const text = payload.toString('utf8');

    if (this.textListeners.size === 0) {
      this.pendingTexts.push(text);

      if (this.pendingTexts.length > 100) {
        this.pendingTexts.shift();
      }

      return;
    }

    for (const listener of this.textListeners) {
      listener(text);
    }
  }

  private emitClose(): void {
    if (this.closeEmitted) {
      return;
    }

    this.closeEmitted = true;
    this.open = false;

    for (const listener of this.closeListeners) {
      listener();
    }
  }
}

function createFrame(opcode: number, payload: Buffer): Buffer {
  const mask = randomBytes(4);
  const length = payload.length;
  let header: Buffer;

  if (length < 126) {
    header = Buffer.alloc(6);
    header[1] = 0x80 | length;
  } else if (length < 65_536) {
    header = Buffer.alloc(8);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(14);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x80 | opcode;
  const maskOffset = header.length - 4;
  mask.copy(header, maskOffset);

  const maskedPayload = Buffer.alloc(length);

  for (let index = 0; index < length; index += 1) {
    const payloadByte = payload[index] ?? 0;
    const maskByte = mask[index % 4] ?? 0;
    maskedPayload[index] = payloadByte ^ maskByte;
  }

  return Buffer.concat([header, maskedPayload]);
}

function unmask(payload: Buffer, mask: Buffer): Buffer {
  const result = Buffer.alloc(payload.length);

  for (let index = 0; index < payload.length; index += 1) {
    const payloadByte = payload[index] ?? 0;
    const maskByte = mask[index % 4] ?? 0;
    result[index] = payloadByte ^ maskByte;
  }

  return result;
}
