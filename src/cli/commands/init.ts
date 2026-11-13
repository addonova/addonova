import path from 'node:path';

import { initProject } from '../../core/init.ts';
import type { PackageManager } from '../../core/init.ts';
import type { CliOptions } from '../args.ts';
import type { CliIo } from '../command.ts';
import { getCliStyle, SYMBOLS } from '../style.ts';

export interface InitCommandContext {
  cwd: string;
  options: CliOptions;
  io: CliIo;
}

export async function initCommand(context: InitCommandContext): Promise<number> {
  const style = getCliStyle(context.io);
  const result = await initProject({
    cwd: context.cwd,
    ...(context.options.directory === undefined
      ? {}
      : { directory: context.options.directory }),
    ...(context.options.template === undefined
      ? {}
      : { template: context.options.template }),
    ...(context.options.packageManager === undefined
      ? {}
      : { packageManager: context.options.packageManager }),
    ...(context.options.git === undefined ? {} : { git: context.options.git }),
    ...(context.options.force === undefined
      ? {}
      : { force: context.options.force }),
    ...(context.options.offline === undefined
      ? {}
      : { offline: context.options.offline }),
    ...(context.io.env === undefined ? {} : { env: context.io.env }),
  });

  const relativeRoot = path.relative(context.cwd, result.root) || '.';
  const lines = [
    `${style.green(SYMBOLS.success)} Scaffolded ${style.bold(result.label)} in ${style.cyan(
      relativeRoot,
    )}`,
    `  Template  ${result.template}`,
    `  Files     ${result.files.length}`,
    `  Package   ${result.packageManager}`,
    `  Git       ${result.gitInitialized ? 'initialized' : 'skipped'}`,
  ];

  for (const warning of result.warnings) {
    lines.push(`  ${style.yellow(SYMBOLS.warning)} ${warning}`);
  }

  lines.push('', style.bold('Next steps:'));

  if (relativeRoot !== '.') {
    lines.push(`  cd ${relativeRoot}`);
  }

  lines.push(
    `  ${result.packageManager} install`,
    `  ${runScriptCommand(result.packageManager, 'dev')}`,
  );

  context.io.stdout.write(`${lines.join('\n')}\n`);

  return 0;
}

function runScriptCommand(manager: PackageManager, script: string): string {
  return manager === 'npm' ? `npm run ${script}` : `${manager} ${script}`;
}
