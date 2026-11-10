import type { ResolvedConfig } from '../core/config.ts';
import type { CliOptions } from './args.ts';

export interface CliWriter {
  write(chunk: string): unknown;
  readonly isTTY?: boolean;
}

export interface CliIo {
  cwd: string;
  stdout: CliWriter;
  stderr: CliWriter;
  env?: NodeJS.ProcessEnv;
  color?: boolean;
}

export interface CommandContext {
  cwd: string;
  options: CliOptions;
  config: ResolvedConfig;
  io: CliIo;
  signal?: AbortSignal;
  reloadConfig?: () => Promise<ResolvedConfig>;
}

export type CommandHandler = (context: CommandContext) => Promise<number> | number;
