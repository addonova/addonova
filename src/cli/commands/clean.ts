import { cleanProject } from '../../core/clean.js';
import type { CommandContext } from '../command.js';

export async function cleanCommand(context: CommandContext): Promise<number> {
  const result = await cleanProject(context.config);

  context.io.stdout.write(
    result.removed
      ? `Cleaned ${result.outdir}\n`
      : `Nothing to clean at ${result.outdir}\n`,
  );

  return 0;
}
