import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import type { CliIo } from './command.ts';
import { formatBytes, formatDuration, SYMBOLS } from './style.ts';
import type { CliStyle } from './style.ts';

export interface BuildSummaryOptions {
  label: string;
  duration: number;
  outdir: string;
  cwd: string;
}

interface OutputFile {
  path: string;
  size: number;
}

const DEFAULT_SORT_WEIGHT = 100;
const SORT_WEIGHTS: readonly (readonly [string, number])[] = [
  ['manifest.json', 0],
  ['.html', 1],
  ['.js.map', 2],
  ['.js', 2],
  ['.css', 3],
];

export function writeBuildSummary(
  io: CliIo,
  style: CliStyle,
  options: BuildSummaryOptions,
): void {
  const files = collectFiles(options.outdir);
  const header = `${style.green(SYMBOLS.success)} ${options.label} in ${style.dim(
    formatDuration(options.duration),
  )}`;

  if (files.length === 0) {
    io.stdout.write(`${header}\n`);
    return;
  }

  const displayRoot = formatDisplayRoot(options.cwd, options.outdir);
  const pathWidth = Math.max(
    ...files.map((file) => file.path.length),
  );
  const lines = files.map((file, index) => {
    const prefix =
      index === files.length - 1
        ? `  ${SYMBOLS.lastBranch}`
        : `  ${SYMBOLS.branch}`;
    const padding = ' '.repeat(pathWidth - file.path.length);

    return `${style.gray(prefix)} ${style.dim(displayRoot)}${paintFile(
      style,
      file.path,
    )}${padding} ${style.dim(formatBytes(file.size))}`;
  });
  const total = files.reduce((sum, file) => sum + file.size, 0);

  lines.push(
    `${style.cyan(`${SYMBOLS.total} Total size:`)} ${formatBytes(total)}`,
  );
  io.stdout.write(`${header}\n${lines.join('\n')}\n`);
}

function collectFiles(root: string): OutputFile[] {
  const files: OutputFile[] = [];

  walk('');

  return files.sort((left, right) => {
    const weight =
      getSortWeight(left.path) - getSortWeight(right.path);

    return weight === 0
      ? left.path.localeCompare(right.path)
      : weight;
  });

  function walk(relativeDirectory: string): void {
    let entries;

    try {
      entries = readdirSync(path.join(root, relativeDirectory), {
        withFileTypes: true,
      });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);

      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      try {
        const size = statSync(path.join(root, relativePath)).size;

        files.push({
          path: relativePath.split(path.sep).join('/'),
          size,
        });
      } catch {
        continue;
      }
    }
  }
}

function getSortWeight(filename: string): number {
  return (
    SORT_WEIGHTS.find(([extension]) => filename.endsWith(extension))?.[1] ??
    DEFAULT_SORT_WEIGHT
  );
}

function paintFile(style: CliStyle, filename: string): string {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) {
    return style.green(filename);
  }

  if (filename.endsWith('.css')) {
    return style.magenta(filename);
  }

  if (
    filename.endsWith('.js') ||
    filename.endsWith('.cjs') ||
    filename.endsWith('.mjs')
  ) {
    return style.cyan(filename);
  }

  if (filename.endsWith('.map')) {
    return style.gray(filename);
  }

  if (filename.endsWith('.zip')) {
    return style.yellow(filename);
  }

  return style.blue(filename);
}

function formatDisplayRoot(cwd: string, outdir: string): string {
  const relative = path.relative(cwd, outdir);
  const display = (relative === '' ? '.' : relative)
    .split(path.sep)
    .join('/');

  return display.endsWith('/') ? display : `${display}/`;
}
