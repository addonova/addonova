import type { CommandName } from '../args.ts';
import type { CommandHandler } from '../command.ts';
import { analyzeCommand } from './analyze.ts';
import { buildCommand } from './build.ts';
import { cleanCommand } from './clean.ts';
import { devCommand } from './dev.ts';
import { infoCommand } from './info.ts';
import { packCommand } from './pack.ts';
import { validateCommand } from './validate.ts';
import { zipCommand } from './zip.ts';

export type ConfigCommandName = Exclude<CommandName, 'init'>;

export const commandHandlers: Readonly<
  Record<ConfigCommandName, CommandHandler>
> = {
  build: buildCommand,
  dev: devCommand,
  clean: cleanCommand,
  info: infoCommand,
  validate: validateCommand,
  pack: packCommand,
  zip: zipCommand,
  analyze: analyzeCommand,
};

export { initCommand } from './init.ts';
export type { InitCommandContext } from './init.ts';
