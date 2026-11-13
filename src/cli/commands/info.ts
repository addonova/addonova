import { resolveManifestObject } from '../../browser/manifest.ts';
import { BROWSER_TARGETS } from '../../core/types.ts';
import type { SourcemapOption } from '../../core/types.ts';
import type { CommandContext } from '../command.ts';
import { getCliStyle } from '../style.ts';

export function infoCommand(context: CommandContext): number {
  const { config } = context;
  const style = getCliStyle(context.io);
  const firstBrowser = config.browsers[0];
  const manifest =
    firstBrowser === undefined
      ? {}
      : resolveManifestObject(config.manifest, firstBrowser, {
          mode: config.mode,
          command: 'info',
          defaults: config.manifestDefaults,
        });
  const manifestName = manifest.name;
  const manifestVersion = manifest.version;
  const entries: Array<[string, string]> = [
    ['Config', config.configPath ?? 'none (using defaults)'],
    ['Project root', config.root],
    ['Mode', config.mode],
    ['Outdir', config.outdir],
    ['Public dir', config.publicDir],
    ['Minify', config.minify ? 'yes' : 'no'],
    ['Sourcemap', formatSourcemap(config.sourcemap)],
    [
      'Browser API',
      `${config.browserApi.mode} (${config.browserApi.packageName})`,
    ],
    ['Entrypoints', String(config.entrypoints.length)],
    ...config.entrypoints.map(
      (entrypoint): [string, string] => [
        `  ${entrypoint.name}`,
        `(${entrypoint.kind}) -> ${entrypoint.input}`,
      ],
    ),
    [
      'Browsers',
      config.browsers
        .map((browser) => `${browser.target} (MV${browser.manifestVersion})`)
        .join(', '),
    ],
    ['Available targets', BROWSER_TARGETS.join(', ')],
    [
      'Manifest',
      `${
        typeof manifestName === 'string' ? manifestName : 'unnamed'
      }${typeof manifestVersion === 'string' ? ` ${manifestVersion}` : ''}`,
    ],
  ];
  const width = Math.max(...entries.map(([label]) => label.length));
  const lines = entries.map(
    ([label, value]) => `${style.dim(label.padEnd(width))} ${value}`,
  );

  context.io.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

function formatSourcemap(sourcemap: SourcemapOption): string {
  if (sourcemap === false) {
    return 'off';
  }

  if (sourcemap === true) {
    return 'on';
  }

  return sourcemap;
}
