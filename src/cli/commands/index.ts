import type { CommandName } from '../args.js';
import type { CommandHandler } from '../command.js';
import { buildCommand } from './build.js';
import { cleanCommand } from './clean.js';
import { devCommand } from './dev.js';
import { infoCommand } from './info.js';
import { packCommand } from './pack.js';
import { validateCommand } from './validate.js';

export const commandHandlers: Readonly<Record<CommandName, CommandHandler>> = {
  build: buildCommand,
  dev: devCommand,
  clean: cleanCommand,
  info: infoCommand,
  validate: validateCommand,
  pack: packCommand,
};
