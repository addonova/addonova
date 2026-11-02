import { cleanProject } from '../../core/clean.ts';
import type { CommandContext } from '../command.ts';

export async function cleanCommand(context: CommandContext): Promise<number> {
  const result = await cleanProject(context.config);

  context.io.stdout.write(
    result.removed
      ? `Cleaned ${result.outdir}\n`
      : `Nothing to clean at ${result.outdir}\n`,
  );

  return 0;
}
