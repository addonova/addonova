import { defineConfig } from 'addonova';

export default defineConfig({
  browsers: ['chrome'],
  browserApi: 'bundle',
  manifest: {
    name: '__MSG_app_name__',
    version: '1.0.0',
    description: '__MSG_app_description__',
    default_locale: 'en',
    permissions: ['storage'],
    action: {
      default_title: '__MSG_app_name__',
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
