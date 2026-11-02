import type { ResolvedConfig } from '../core/config.js';
import type { CliOptions } from './args.js';

export interface CliWriter {
  write(chunk: string): unknown;
}

export interface CliIo {
  cwd: string;
  stdout: CliWriter;
  stderr: CliWriter;
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
