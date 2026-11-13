import { defineConfig } from 'addonova';

export default defineConfig({
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/index.html',
  },
  browsers: ['chrome'],
  manifest: {
    name: '__PROJECT_TITLE__',
    version: '1.0.0',
    description: 'A browser extension built with Addonova.',
    permissions: ['storage'],
    background: {
      service_worker: 'background.js',
    },
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icons/icon.svg',
        '48': 'icons/icon.svg',
      },
    },
    icons: {
      '16': 'icons/icon.svg',
      '48': 'icons/icon.svg',
    },
    content_scripts: [
      {
        matches: ['https://example.com/*'],
        js: ['content.js'],
      },
    ],
  },
});
