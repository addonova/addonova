import { PassThrough } from 'node:stream';

import { describe, expect, it } from '@guchho/test';

import {
  CdpError,
  createCdpClient,
  isMethodNotFoundError,
} from '../../src/launcher/cdp.ts';

describe('CDP pipe client', () => {
  it('matches responses by request id and loads unpacked extensions', async () => {
    const requests = new PassThrough();
    const responses = new PassThrough();
    const client = createCdpClient({
      stdin: requests,
      stdout: responses,
      timeoutMs: 1_000,
    });
    const methods: string[] = [];

    requests.on('data', (chunk: Buffer) => {
      for (const message of chunk.toString().split('\0')) {
        if (message.length === 0) {
          continue;
        }

        const parsed = JSON.parse(message) as {
          id: number;
          method: string;
        };
        methods.push(parsed.method);

        if (parsed.method === 'Extensions.loadUnpacked') {
          responses.write(
            `${JSON.stringify({ id: parsed.id, result: { id: 'extension-id' } })}\0`,
          );
        }
      }
    });

    const extensionId = await client.loadUnpacked('/project/dist/chrome');

    expect(extensionId).toBe('extension-id');
    expect(methods).toEqual(['Extensions.loadUnpacked']);

    client.dispose();
  });

  it('handles partial and combined response chunks', async () => {
    const requests = new PassThrough();
    const responses = new PassThrough();
    const client = createCdpClient({
      stdin: requests,
      stdout: responses,
      timeoutMs: 1_000,
    });

    let secondResponse = '';

    requests.on('data', (chunk: Buffer) => {
      const messages = chunk
        .toString()
        .split('\0')
        .filter((message) => message.length > 0);

      for (const message of messages) {
        const parsed = JSON.parse(message) as { id: number; method: string };
        const response = `${JSON.stringify({
          id: parsed.id,
          result: { method: parsed.method },
        })}\0`;

        if (parsed.method === 'First') {
          responses.write(response.slice(0, 8));
          setTimeout(() => {
            responses.write(`${response.slice(8)}${secondResponse}`);
          }, 5);
        } else {
          secondResponse = response;
        }
      }
    });

    const first = client.call<{ method: string }>('First');
    const second = client.call<{ method: string }>('Second');

    expect(await first).toEqual({ method: 'First' });
    expect(await second).toEqual({ method: 'Second' });

    client.dispose();
  });

  it('surfaces CDP command errors', async () => {
    const requests = new PassThrough();
    const responses = new PassThrough();
    const client = createCdpClient({
      stdin: requests,
      stdout: responses,
      timeoutMs: 1_000,
    });

    requests.on('data', (chunk: Buffer) => {
      const parsed = JSON.parse(
        chunk.toString().replace(/\0$/, ''),
      ) as { id: number };

      responses.write(
        `${JSON.stringify({
          id: parsed.id,
          error: { code: -32601, message: 'Method not found' },
        })}\0`,
      );
    });

    try {
      await client.uninstall('extension-id');
    } catch (error) {
      expect(error).toBeInstanceOf(CdpError);
      expect((error as CdpError).method).toBe('Extensions.uninstall');
      expect(isMethodNotFoundError(error)).toBe(true);
      client.dispose();
      return;
    }

    throw new Error('Expected a CDP error.');
  });
});
