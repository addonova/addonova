import { createDevSession } from '../../dev/watcher.ts';
import { AddonovaError } from '../../core/errors.ts';
import type { CommandContext } from '../command.ts';

export async function devCommand(context: CommandContext): Promise<number> {
  if (context.config.entrypoints.length === 0) {
    throw new AddonovaError({
      code: 'ADDONOVA_BUILD_NO_ENTRYPOINTS',
      severity: 'error',
      message: 'No entrypoints are configured.',
      suggestion: 'Add an entrypoints object to addonova.config.ts.',
      ...(context.config.configPath === null
        ? {}
        : { location: { file: context.config.configPath } }),
    });
  }

  const session = await createDevSession({
    config: context.config,
    io: context.io,
    debug: context.options.debug,
    ...(context.reloadConfig === undefined
      ? {}
      : { reloadConfig: context.reloadConfig }),
  });
  const signal = context.signal;

  if (signal === undefined || signal.aborted) {
    await session.close();
    return 0;
  }

  await new Promise<void>((resolve) => {
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort);
      void session.close().then(resolve, resolve);
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });

  return 0;
}
