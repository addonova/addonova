const events: string[] = [];
(
  globalThis as { __addonovaExtensibilityEvents?: string[] }
).__addonovaExtensibilityEvents = events;

export default {
  entrypoints: {
    background: 'src/background.ts',
  },
  minify: false,
  hooks: {
    'config:resolved': () => {
      events.push('config:resolved');
    },
    'entrypoints:found': ({ entrypoints }) => {
      events.push(`entrypoints:found:${entrypoints.length}`);
    },
    'entrypoints:resolved': ({ addEntrypoint }) => {
      addEntrypoint('hooked', 'src/hooked.ts');
      events.push('entrypoints:resolved');
    },
    'build:publicAssets': ({ assets }) => {
      assets.push({ path: 'generated/config.txt', contents: 'from-config' });
      events.push('build:publicAssets');
    },
    'build:manifestGenerated': ({ manifest }) => {
      manifest.description = 'from-config-hook';
      events.push('build:manifestGenerated');
    },
    'build:done': () => {
      events.push('build:done');
    },
  },
};
