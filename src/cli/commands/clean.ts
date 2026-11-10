import { cleanProject } from '../../core/clean.ts';
import type { CommandContext } from '../command.ts';
import { getCliStyle, SYMBOLS } from '../style.ts';

export async function cleanCommand(context: CommandContext): Promise<number> {
  const style = getCliStyle(context.io);
  const result = await cleanProject(context.config);

  context.io.stdout.write(
    result.removed
      ? `${style.green(SYMBOLS.success)} Cleaned ${style.cyan(result.outdir)}\n`
      : `${style.cyan(SYMBOLS.info)} Nothing to clean at ${style.dim(
          result.outdir,
        )}\n`,
  );

  return 0;
}
