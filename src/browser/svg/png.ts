import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = createCrcTable();

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export function encodePng(image: RgbaImage): Buffer {
  const { width, height, data } = image;

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`Invalid PNG width: ${width}`);
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid PNG height: ${height}`);
  }

  if (data.length !== width * height * 4) {
    throw new Error(
      `PNG buffer length ${data.length} does not match ${width}x${height} RGBA data.`,
    );
  }

  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }

  const chunks: Buffer[] = [
    Buffer.from(PNG_SIGNATURE),
    createChunk('IHDR', createIhdr(width, height)),
    createChunk('IDAT', deflateSync(raw, { level: 9 })),
    createChunk('IEND', new Uint8Array(0)),
  ];

  return Buffer.concat(chunks);
}

function createIhdr(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);

  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return header;
}

function createChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);

  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crc = crc32(chunk.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);

  return chunk;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}
