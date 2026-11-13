import type { CommandName } from '../args.ts';
import type { CommandHandler } from '../command.ts';
import { buildCommand } from './build.ts';
import { cleanCommand } from './clean.ts';
import { devCommand } from './dev.ts';
import { infoCommand } from './info.ts';
import { packCommand } from './pack.ts';
import { validateCommand } from './validate.ts';

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
};

export { initCommand } from './init.ts';
export type { InitCommandContext } from './init.ts';
