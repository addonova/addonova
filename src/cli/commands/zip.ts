import { packProject } from '../../core/pack.ts';
import type { CommandContext } from '../command.ts';
import { writePackResults } from './pack.ts';

export async function zipCommand(context: CommandContext): Promise<number> {
  const results = await packProject(context.config, {
    format: 'zip',
    ...(context.options.include.length === 0
      ? {}
      : { include: context.options.include }),
    ...(context.options.exclude.length === 0
      ? {}
      : { exclude: context.options.exclude }),
    ...(context.options.sources === undefined
      ? {}
      : { sources: context.options.sources }),
  });

  writePackResults(context, results);
  return 0;
}
