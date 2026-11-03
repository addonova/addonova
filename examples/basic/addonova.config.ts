export default {
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/popup.html',
  },
  manifest: {
    name: 'Addonova Basic Example',
    version: '1.0.0',
    description: 'A complete Addonova extension with popup, background, content script, and assets.',
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
};
