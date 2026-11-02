export default {
  entrypoints: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup/index.html',
  },
  publicDir: 'public',
  manifest: {
    name: 'Target Fixture',
    version: '1.0.0',
    permissions: ['storage'],
    icons: { '48': 'icons/icon.svg' },
  },
  browsers: {
    chrome: {
      manifest_version: 3,
      background: { service_worker: 'background.js' },
      action: {
        default_popup: 'popup.html',
        default_icon: 'icons/icon.svg',
      },
      content_scripts: [
        { matches: ['https://example.com/*'], js: ['content.js'] },
      ],
    },
  },
  minify: false,
};
