#!/usr/bin/env node

import { runCli } from './run.js';

const argv = process.argv.slice(2);
const watchesUntilStopped = argv.includes('dev');
const controller = new AbortController();
const stop = (): void => controller.abort();

if (watchesUntilStopped) {
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

const exitCode = await runCli(
  argv,
  undefined,
  watchesUntilStopped ? { signal: controller.signal } : {},
);

if (watchesUntilStopped) {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}

process.exitCode = exitCode;
