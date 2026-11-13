import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type { Diagnostic } from '../core/errors.ts';

export const DEV_RELOAD_CLIENT_MARKER = '/* addonova dev reload client */';
export const DEV_RELOAD_CLIENT_FILENAME = 'addonova-dev-reload.js';

export interface DevReloadClientOptions {
  url: string;
}

export interface InjectDevReloadClientOptions {
  manifest: Record<string, unknown>;
  staging: string;
  url: string;
}

export interface DevReloadClientInjection {
  files: readonly string[];
  warnings: readonly Diagnostic[];
}

export function createDevReloadClientSource(
  options: DevReloadClientOptions,
): string {
  return `${DEV_RELOAD_CLIENT_MARKER}
(() => {
  'use strict';

  const url = ${JSON.stringify(options.url)};
  const api = globalThis.browser ?? globalThis.chrome;

  if (!api || !api.runtime) {
    return;
  }

  let socket = null;
  let retry = 0;
  let timer = null;

  const reloadTabs = async () => {
    if (!api.tabs) {
      return;
    }

    let matches = [];

    try {
      const manifest = api.runtime.getManifest();
      matches = (manifest.content_scripts || []).flatMap((entry) => entry.matches || []);
    } catch (error) {
      matches = [];
    }

    if (matches.length === 0) {
      return;
    }

    try {
      const tabs = await api.tabs.query({ url: matches });

      await Promise.all(tabs.map((tab) => {
        if (typeof tab.id !== 'number') {
          return undefined;
        }

        try {
          return api.tabs.reload(tab.id);
        } catch (error) {
          return undefined;
        }
      }));
    } catch (error) {
      // Tabs that cannot be reloaded are skipped.
    }
  };

  const handleMessage = async (data) => {
    let message;

    try {
      message = JSON.parse(typeof data === 'string' ? data : '');
    } catch (error) {
      return;
    }

    if (!message || message.type !== 'reload') {
      return;
    }

    await reloadTabs();

    try {
      api.runtime.reload();
    } catch (error) {
      // The extension may already be reloading.
    }
  };

  const schedule = () => {
    if (timer !== null) {
      return;
    }

    const delay = Math.min(1000 * 2 ** retry, 10000);
    retry += 1;
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    try {
      socket = new WebSocket(url);
    } catch (error) {
      schedule();
      return;
    }

    socket.addEventListener('open', () => {
      retry = 0;
    });
    socket.addEventListener('message', (event) => {
      void handleMessage(event.data);
    });
    socket.addEventListener('close', () => {
      socket = null;
      schedule();
    });
    socket.addEventListener('error', () => {
      try {
        if (socket !== null) {
          socket.close();
        }
      } catch (error) {
        // The socket is already closing.
      }
    });
  };

  connect();
})();
`;
}

export function injectDevReloadClient(
  options: InjectDevReloadClientOptions,
): DevReloadClientInjection {
  const source = createDevReloadClientSource({ url: options.url });
  const background = asRecord(options.manifest.background);
  const warnings: Diagnostic[] = [];

  if (background !== null) {
    const serviceWorker = background.service_worker;

    if (typeof serviceWorker === 'string') {
      if (appendToScript(options.staging, serviceWorker, source)) {
        return { files: [serviceWorker], warnings };
      }

      warnings.push(
        unavailable(
          `The background service worker "${serviceWorker}" was not found, so the dev reload client could not be injected.`,
        ),
      );
      return { files: [], warnings };
    }

    const scripts = background.scripts;

    if (Array.isArray(scripts)) {
      for (const script of scripts) {
        if (
          typeof script === 'string' &&
          appendToScript(options.staging, script, source)
        ) {
          return { files: [script], warnings };
        }
      }

      if (scripts.length > 0) {
        warnings.push(
          unavailable(
            'None of the configured background scripts were found, so the dev reload client could not be injected.',
          ),
        );
        return { files: [], warnings };
      }
    }

    if (typeof background.page === 'string') {
      warnings.push(
        unavailable(
          'Background pages are not supported by the dev reload client. Add a background script or service worker to enable reloads.',
        ),
      );
      return { files: [], warnings };
    }
  }

  writeFileSync(
    path.join(options.staging, DEV_RELOAD_CLIENT_FILENAME),
    source,
    'utf8',
  );

  options.manifest.background =
    options.manifest.manifest_version === 2
      ? { scripts: [DEV_RELOAD_CLIENT_FILENAME] }
      : { service_worker: DEV_RELOAD_CLIENT_FILENAME };

  return { files: [DEV_RELOAD_CLIENT_FILENAME], warnings };
}

function appendToScript(
  staging: string,
  relativePath: string,
  source: string,
): boolean {
  const normalized = relativePath.split('/').join(path.sep);

  if (path.isAbsolute(normalized) || normalized.split(path.sep).includes('..')) {
    return false;
  }

  const filePath = path.join(staging, normalized);

  if (!existsSync(filePath)) {
    return false;
  }

  const current = readFileSync(filePath, 'utf8');

  if (!current.includes(DEV_RELOAD_CLIENT_MARKER)) {
    appendFileSync(filePath, `\n${source}`, 'utf8');
  }

  return true;
}

function unavailable(message: string): Diagnostic {
  return {
    code: 'ADDONOVA_DEV_RELOAD_CLIENT_UNAVAILABLE',
    severity: 'warning',
    message,
    suggestion:
      'Add a background entrypoint or a manifest background service worker to enable extension reloads.',
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
