import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

import { guchhoAdapter } from '../bundler/guchho.ts';
import type { BundlerAdapter } from '../bundler/adapter.ts';
import type { ResolvedConfig } from './config.ts';
import { AddonovaError } from './errors.ts';

export interface CleanProjectOptions {
  adapter?: BundlerAdapter;
}

export interface CleanProjectResult {
  outdir: string;
  removed: boolean;
}

export async function cleanProject(
  config: ResolvedConfig,
  options: CleanProjectOptions = {},
): Promise<CleanProjectResult> {
  assertSafeOutputDirectory(config);

  const adapter = options.adapter ?? guchhoAdapter;

  await adapter.dispose?.();

  if (!existsSync(config.outdir)) {
    return { outdir: config.outdir, removed: false };
  }

  rmSync(config.outdir, { recursive: true, force: true });

  return { outdir: config.outdir, removed: true };
}

export function assertSafeOutputDirectory(config: ResolvedConfig): void {
  const outdir = path.resolve(config.outdir);
  const root = path.resolve(config.root);
  const parsed = path.parse(outdir);

  if (
    outdir === parsed.root ||
    outdir === root ||
    root.startsWith(`${outdir}${path.sep}`)
  ) {
    throw unsafeOutputDirectory(
      config,
      `Refusing to clean "${outdir}" because it contains the project root.`,
    );
  }

  for (const entrypoint of config.entrypoints) {
    if (isInside(entrypoint.input, outdir)) {
      throw unsafeOutputDirectory(
        config,
        `Refusing to clean "${outdir}" because entrypoint "${entrypoint.name}" is inside it.`,
      );
    }
  }

  if (isInside(config.publicDir, outdir)) {
    throw unsafeOutputDirectory(
      config,
      `Refusing to clean "${outdir}" because the public directory is inside it.`,
    );
  }

  if (config.configPath !== null && isInside(config.configPath, outdir)) {
    throw unsafeOutputDirectory(
      config,
      `Refusing to clean "${outdir}" because the configuration file is inside it.`,
    );
  }
}

function isInside(target: string, directory: string): boolean {
  const relative = path.relative(directory, target);

  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function unsafeOutputDirectory(
  config: ResolvedConfig,
  message: string,
): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_CLEAN_UNSAFE_OUTDIR',
    severity: 'error',
    message,
    suggestion:
      'Set outdir to a dedicated build directory such as "dist" before running clean.',
    ...(config.configPath === null
      ? {}
      : { location: { file: config.configPath } }),
  });
}
