export default {
  entrypoints: {
    background: 'src/background.ts',
  },
  browsers: {
    chrome: {
      background: { service_worker: 'background.js' },
    },
    firefox: {
      background: { scripts: ['background.js'] },
      browser_specific_settings: {
        gecko: { id: 'browser-api@addonova.dev' },
      },
    },
  },
  browserApi: 'bundle',
  manifest: {
    name: 'Addonova Browser API Example',
    version: '1.0.0',
    description: 'Uses the bundled @addonova/browser runtime helper.',
    permissions: ['storage'],
    icons: {
      '48': 'icons/icon.svg',
    },
  },
};
