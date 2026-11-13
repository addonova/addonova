const events = (
  (globalThis as { __addonovaExtensibilityEvents?: string[] })
    .__addonovaExtensibilityEvents ??= []
);

export default {
  name: 'fixture-module',
  setup(context: {
    addEntrypoint(name: string, input: string): void;
    addAlias(name: string, target: string): void;
    addFile(path: string, contents: string): void;
    hooks: {
      on(
        event: string,
        handler: (payload: { manifest: Record<string, unknown> }) => void,
      ): void;
    };
  }) {
    events.push('module:setup');
    context.addEntrypoint('module-script', 'src/module.ts');
    context.addAlias('@fixture', './src/shared.ts');
    context.addFile('generated/module.txt', 'from-module');
    context.hooks.on('build:manifestGenerated', ({ manifest }) => {
      manifest.author = 'fixture-module';
      events.push('module:manifestGenerated');
    });
    context.hooks.on('build:done', () => {
      events.push('module:build:done');
    });
  },
};
