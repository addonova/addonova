import type { CommandName } from '../args.ts';
import type { CommandHandler } from '../command.ts';
import { buildCommand } from './build.ts';
import { cleanCommand } from './clean.ts';
import { devCommand } from './dev.ts';
import { infoCommand } from './info.ts';
import { packCommand } from './pack.ts';
import { validateCommand } from './validate.ts';

export const commandHandlers: Readonly<Record<CommandName, CommandHandler>> = {
  build: buildCommand,
  dev: devCommand,
  clean: cleanCommand,
  info: infoCommand,
  validate: validateCommand,
  pack: packCommand,
};
