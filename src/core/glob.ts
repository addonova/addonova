const GLOB_MAGIC = /[*?[\]{}]/;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export function matchesGlob(relativePath: string, pattern: string): boolean {
  const candidate = normalizePath(relativePath);
  const normalizedPattern = normalizePath(pattern);

  for (const expanded of expandBraces(normalizedPattern)) {
    if (expanded === '**' || expanded === '**/*') {
      return true;
    }

    if (globToRegex(expanded).test(candidate)) {
      return true;
    }

    if (!GLOB_MAGIC.test(expanded)) {
      if (candidate === expanded || candidate.startsWith(`${expanded}/`)) {
        return true;
      }
    }
  }

  return false;
}

export function matchesAny(
  relativePath: string,
  patterns: readonly string[],
): boolean {
  return patterns.some((pattern) => matchesGlob(relativePath, pattern));
}

export function filterPaths(
  relativePaths: readonly string[],
  include: readonly string[],
  exclude: readonly string[],
): readonly string[] {
  return relativePaths.filter(
    (relativePath) =>
      matchesAny(relativePath, include) &&
      !matchesAny(relativePath, exclude),
  );
}

export function matchesDirectory(
  relativePath: string,
  patterns: readonly string[],
): boolean {
  const candidate = normalizePath(relativePath);

  return patterns.some((pattern) =>
    expandBraces(normalizePath(pattern)).some((expanded) => {
      if (expanded.endsWith('/**')) {
        return matchesGlob(candidate, expanded.slice(0, -3));
      }

      return matchesGlob(candidate, expanded);
    }),
  );
}

export function expandBraces(pattern: string): readonly string[] {
  const open = pattern.indexOf('{');

  if (open === -1) {
    return [pattern];
  }

  const close = findClosingBrace(pattern, open);

  if (close === -1) {
    return [pattern];
  }

  const before = pattern.slice(0, open);
  const body = pattern.slice(open + 1, close);
  const after = pattern.slice(close + 1);
  const parts = splitTopLevel(body);

  if (parts.length < 2) {
    return [pattern];
  }

  return parts.flatMap((part) => expandBraces(`${before}${part}${after}`));
}

function findClosingBrace(pattern: string, open: number): number {
  let depth = 0;

  for (let index = open; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitTopLevel(body: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(body.slice(start));
  return parts;
}

function globToRegex(pattern: string): RegExp {
  let source = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === '*') {
      if (pattern[index + 1] === '*') {
        index += 1;

        if (pattern[index + 1] === '/') {
          index += 1;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else if (character === '[') {
      const end = pattern.indexOf(']', index + 1);

      if (end === -1) {
        source += '\\[';
      } else {
        let body = pattern.slice(index + 1, end);

        if (body.startsWith('!')) {
          body = `^${body.slice(1)}`;
        }

        source += `[${body.replaceAll('\\', '\\\\')}]`;
        index = end;
      }
    } else {
      source += (character ?? '').replace(REGEX_SPECIAL, '\\$&');
    }
  }

  source += '$';
  return new RegExp(source);
}

function normalizePath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}
