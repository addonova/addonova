import { ADDONOVA_VERSION } from '../../core/version.js';
import { BROWSER_TARGETS } from '../../core/types.js';
import type { SourcemapOption } from '../../core/types.js';
import type { CommandContext } from '../command.js';

export function infoCommand(context: CommandContext): number {
  const { config } = context;
  const manifestName = config.manifest.name;
  const manifestVersion = config.manifest.version;
  const lines = [
    `Addonova ${ADDONOVA_VERSION}`,
    `Node ${process.version}`,
    `Config ${config.configPath ?? 'none (using defaults)'}`,
    `Project root ${config.root}`,
    `Mode ${config.mode}`,
    `Outdir ${config.outdir}`,
    `Public dir ${config.publicDir}`,
    `Minify ${config.minify ? 'yes' : 'no'}`,
    `Sourcemap ${formatSourcemap(config.sourcemap)}`,
    `Entrypoints ${config.entrypoints.length}`,
    ...config.entrypoints.map(
      (entrypoint) => `  ${entrypoint.name} (${entrypoint.kind}) -> ${entrypoint.input}`,
    ),
    `Browsers ${config.browsers
      .map((browser) => `${browser.target} (MV${browser.manifestVersion})`)
      .join(', ')}`,
    `Available targets ${BROWSER_TARGETS.join(', ')}`,
    `Manifest ${
      typeof manifestName === 'string' ? manifestName : 'unnamed'
    }${typeof manifestVersion === 'string' ? ` ${manifestVersion}` : ''}`,
  ];

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
