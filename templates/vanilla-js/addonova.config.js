import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome'],
  browserApi: 'bundle',
  manifest: {
    name: '__PROJECT_TITLE__',
    version: '1.0.0',
    description: 'A browser extension built with Addonova.',
    permissions: ['storage'],
    action: {
      default_icon: {
        '16': 'icons/icon.svg',
        '48': 'icons/icon.svg',
      },
    },
    icons: {
      '16': 'icons/icon.svg',
      '48': 'icons/icon.svg',
    },
  },
});
