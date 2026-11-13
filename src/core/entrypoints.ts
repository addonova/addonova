import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { AddonovaError } from './errors.ts';
import { BROWSER_TARGETS, isBrowserTarget } from './types.ts';
import type { BrowserTarget, EntrypointKind } from './types.ts';

export const ENTRYPOINT_TYPES = [
  'background',
  'content-script',
  'content-style',
  'popup',
  'options',
  'sidepanel',
  'devtools',
  'sandbox',
  'override',
  'page',
  'script',
  'style',
  'asset',
] as const;

export type EntrypointType = (typeof ENTRYPOINT_TYPES)[number];

export interface EntrypointManifestOptions {
  matches?: readonly string[];
  excludeMatches?: readonly string[];
  includeGlobs?: readonly string[];
  excludeGlobs?: readonly string[];
  allFrames?: boolean;
  runAt?: string;
  matchAboutBlank?: boolean;
  matchOriginAsFallback?: boolean;
  world?: string;
  cssInjectionMode?: string;
  registration?: string;
  type?: string;
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  meta?: Readonly<Record<string, string>>;
}

export interface EntrypointSelection {
  include?: readonly BrowserTarget[];
  exclude?: readonly BrowserTarget[];
  type?: EntrypointType;
}

export interface DiscoveredEntrypoint {
  name: string;
  input: string;
  kind: EntrypointKind;
  type: EntrypointType;
  manifestOptions: EntrypointManifestOptions;
  discovered?: true;
}

export interface DiscoverEntrypointsOptions {
  root: string;
  srcDir: string;
  entrypointsDir: string;
}

const SCRIPT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const STYLE_EXTENSIONS = new Set(['.css']);
const INDEX_FILENAMES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
  'index.cjs',
  'index.html',
  'index.htm',
  'index.css',
];

export function discoverEntrypoints(
  options: DiscoverEntrypointsOptions,
): DiscoveredEntrypoint[] {
  const directory = path.resolve(
    options.root,
    options.srcDir,
    options.entrypointsDir,
  );
  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const entrypoints: DiscoveredEntrypoint[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
      continue;
    }

    if (entry.isDirectory()) {
      const indexFile = findIndexFile(path.join(directory, entry.name));

      if (indexFile !== null) {
        addDiscoveredEntrypoint(
          entrypoints,
          describeEntrypoint(
            entry.name,
            indexFile,
            detectEntrypointKind(indexFile),
            { discovered: true },
          ),
        );
      }

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const kind = detectEntrypointKind(entry.name);

    if (kind === 'asset') {
      continue;
    }

    const input = path.join(directory, entry.name);
    const name = deriveEntrypointName(entry.name);

    addDiscoveredEntrypoint(
      entrypoints,
      describeEntrypoint(name, input, kind, { discovered: true }),
    );
  }

  return entrypoints;
}

function addDiscoveredEntrypoint(
  entrypoints: DiscoveredEntrypoint[],
  entrypoint: DiscoveredEntrypoint,
): void {
  if (entrypoint.kind === 'style') {
    const companion = entrypoints.some(
      (existing) =>
        existing.name === entrypoint.name && existing.kind !== 'style',
    );

    if (companion) {
      return;
    }
  } else {
    const styleIndex = entrypoints.findIndex(
      (existing) =>
        existing.name === entrypoint.name && existing.kind === 'style',
    );

    if (styleIndex !== -1) {
      entrypoints.splice(styleIndex, 1);
    }
  }

  entrypoints.push(entrypoint);
}

export function describeEntrypoint(
  name: string,
  input: string,
  kind: EntrypointKind,
  selection: EntrypointSelection & { discovered?: boolean } = {},
): DiscoveredEntrypoint {
  const absoluteInput = path.resolve(input);
  const metadata = readEntrypointMetadata(absoluteInput, kind);
  const include = mergeBrowserList(metadata.include, selection.include);
  const exclude = mergeBrowserList(metadata.exclude, selection.exclude);
  const type =
    selection.type ??
    (metadata.type !== undefined && isEntrypointType(metadata.type)
      ? metadata.type
      : inferEntrypointType(name, kind));

  const manifestOptions: EntrypointManifestOptions = { ...metadata };

  if (include !== undefined) {
    manifestOptions.include = include;
  } else {
    delete manifestOptions.include;
  }

  if (exclude !== undefined) {
    manifestOptions.exclude = exclude;
  } else {
    delete manifestOptions.exclude;
  }

  const entrypoint: DiscoveredEntrypoint = {
    name,
    input: absoluteInput,
    kind,
    type,
    manifestOptions,
  };

  if (selection.discovered === true) {
    entrypoint.discovered = true;
  }

  return entrypoint;
}

export interface ResolveEntrypointDefinitionOptions {
  root: string;
  name: string;
  input: string;
  selection?: EntrypointSelection;
  configPath?: string | null;
}

export function resolveEntrypointDefinition(
  options: ResolveEntrypointDefinitionOptions,
): DiscoveredEntrypoint {
  const configPath = options.configPath ?? null;

  if (
    options.name.trim() === '' ||
    options.name.includes('/') ||
    options.name.includes('\\')
  ) {
    throw entrypointError(
      'ADDONOVA_CONFIG_ENTRYPOINTS',
      `Invalid entrypoint name "${options.name}".`,
      'Use a simple name without path separators.',
      configPath,
    );
  }

  if (options.input.trim() === '') {
    throw entrypointError(
      'ADDONOVA_CONFIG_ENTRYPOINTS',
      `Entrypoint "${options.name}" must point to a non-empty file path.`,
      'Provide a path to a script, HTML file, stylesheet, or asset.',
      configPath,
    );
  }

  const selection = options.selection ?? {};

  assertEntrypointSelection(selection.include, `${options.name}.include`, configPath);
  assertEntrypointSelection(selection.exclude, `${options.name}.exclude`, configPath);

  if (selection.type !== undefined && !isEntrypointType(selection.type)) {
    throw entrypointError(
      'ADDONOVA_CONFIG_ENTRYPOINTS',
      `Entrypoint "${options.name}" has an unknown type "${String(selection.type)}".`,
      'Use a supported entrypoint type such as background, content-script, or popup.',
      configPath,
    );
  }

  const absoluteInput = path.resolve(options.root, options.input);
  const kind = detectEntrypointKind(options.input);

  if (!isFile(absoluteInput)) {
    throw entrypointError(
      'ADDONOVA_CONFIG_ENTRYPOINT_MISSING',
      `Entrypoint "${options.name}" was not found: ${absoluteInput}`,
      'Check the path and ensure the file exists.',
      configPath,
    );
  }

  return describeEntrypoint(options.name, absoluteInput, kind, selection);
}

export function inferEntrypointType(
  name: string,
  kind: EntrypointKind,
): EntrypointType {
  const lower = name.toLowerCase();
  const segment = lower.split('.')[0] ?? lower;

  if (kind === 'script') {
    if (segment === 'background') {
      return 'background';
    }

    if (segment === 'content' || lower.endsWith('.content')) {
      return 'content-script';
    }

    return 'script';
  }

  if (kind === 'html') {
    if (segment === 'popup') {
      return 'popup';
    }

    if (segment === 'options') {
      return 'options';
    }

    if (segment === 'sidepanel' || segment === 'side-panel') {
      return 'sidepanel';
    }

    if (segment === 'devtools') {
      return 'devtools';
    }

    if (segment === 'sandbox' || lower.endsWith('.sandbox')) {
      return 'sandbox';
    }

    if (
      segment === 'newtab' ||
      segment === 'bookmarks' ||
      segment === 'history'
    ) {
      return 'override';
    }

    return 'page';
  }

  if (kind === 'style') {
    if (segment === 'content' || lower.endsWith('.content')) {
      return 'content-style';
    }

    return 'style';
  }

  return 'asset';
}

export function isEntrypointForBrowser(
  entrypoint: { manifestOptions?: EntrypointManifestOptions },
  target: BrowserTarget,
): boolean {
  const { include, exclude } = entrypoint.manifestOptions ?? {};

  if (include !== undefined && !include.includes(target)) {
    return false;
  }

  if (exclude !== undefined && exclude.includes(target)) {
    return false;
  }

  return true;
}

export function isEntrypointType(value: unknown): value is EntrypointType {
  return (
    typeof value === 'string' &&
    (ENTRYPOINT_TYPES as readonly string[]).includes(value)
  );
}

export function deriveEntrypointName(input: string): string {
  const normalized = input.replaceAll('\\', '/');
  const parsed = path.posix.parse(normalized);

  if (parsed.name === 'index' && parsed.dir !== '') {
    return path.posix.basename(parsed.dir);
  }

  return parsed.name;
}

export function detectEntrypointKind(input: string): EntrypointKind {
  const extension = path.extname(input).toLowerCase();

  if (HTML_EXTENSIONS.has(extension)) {
    return 'html';
  }

  if (STYLE_EXTENSIONS.has(extension)) {
    return 'style';
  }

  if (SCRIPT_EXTENSIONS.has(extension)) {
    return 'script';
  }

  return 'asset';
}

function readEntrypointMetadata(
  input: string,
  kind: EntrypointKind,
): EntrypointManifestOptions {
  if (kind === 'script') {
    return readDefineOptions(input) ?? {};
  }

  if (kind === 'html') {
    return readHtmlManifestOptions(input);
  }

  return {};
}

function readDefineOptions(input: string): EntrypointManifestOptions | null {
  let source: string;

  try {
    source = readFileSync(input, 'utf8');
  } catch {
    return null;
  }

  const pattern = /\bdefine(?:Background|ContentScript|UnlistedScript|Page)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const prefix = source.slice(Math.max(0, match.index - 16), match.index);

    if (/\bfunction\s+$/.test(prefix)) {
      continue;
    }

    const start = skipWhitespace(source, match.index + match[0].length);

    if (source[start] !== '{') {
      continue;
    }

    const literal = readBalanced(source, start, '{', '}');

    if (literal === null) {
      continue;
    }

    let value: unknown;

    try {
      value = new Function(`"use strict"; return (${literal});`)();
    } catch {
      continue;
    }

    if (isRecord(value)) {
      return normalizeManifestOptions(value);
    }
  }

  return null;
}

function readHtmlManifestOptions(input: string): EntrypointManifestOptions {
  let source: string;

  try {
    source = readFileSync(input, 'utf8');
  } catch {
    return {};
  }

  const options: EntrypointManifestOptions = {};
  const meta: Record<string, string> = {};
  const metaPattern = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaPattern.exec(source)) !== null) {
    const attributes = match[0];
    const nameMatch = /\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(
      attributes,
    );

    if (nameMatch === null) {
      continue;
    }

    const name = (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3] ?? '').trim();

    if (!name.startsWith('manifest.')) {
      continue;
    }

    const contentMatch = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(
      attributes,
    );

    if (contentMatch === null) {
      continue;
    }

    const content = (
      contentMatch[1] ??
      contentMatch[2] ??
      contentMatch[3] ??
      ''
    ).trim();
    const key = name.slice('manifest.'.length);

    applyHtmlManifestOption(options, meta, key, content);
  }

  if (Object.keys(meta).length > 0) {
    options.meta = meta;
  }

  return options;
}

function applyHtmlManifestOption(
  options: EntrypointManifestOptions,
  meta: Record<string, string>,
  key: string,
  content: string,
): void {
  switch (key) {
    case 'include':
      options.include = parseStringList(content) as BrowserTarget[];
      return;
    case 'exclude':
      options.exclude = parseStringList(content) as BrowserTarget[];
      return;
    case 'matches':
      options.matches = parseStringList(content);
      return;
    case 'exclude_matches':
    case 'excludeMatches':
      options.excludeMatches = parseStringList(content);
      return;
    case 'include_globs':
    case 'includeGlobs':
      options.includeGlobs = parseStringList(content);
      return;
    case 'exclude_globs':
    case 'excludeGlobs':
      options.excludeGlobs = parseStringList(content);
      return;
    case 'all_frames':
    case 'allFrames':
      options.allFrames = content === 'true';
      return;
    case 'run_at':
    case 'runAt':
      options.runAt = content;
      return;
    case 'match_about_blank':
    case 'matchAboutBlank':
      options.matchAboutBlank = content === 'true';
      return;
    case 'match_origin_as_fallback':
    case 'matchOriginAsFallback':
      options.matchOriginAsFallback = content === 'true';
      return;
    case 'world':
      options.world = content;
      return;
    case 'css_injection_mode':
    case 'cssInjectionMode':
      options.cssInjectionMode = content;
      return;
    case 'registration':
      options.registration = content;
      return;
    case 'type':
      options.type = content;
      return;
    default:
      meta[key] = content;
  }
}

function normalizeManifestOptions(
  value: Record<string, unknown>,
): EntrypointManifestOptions {
  const options: EntrypointManifestOptions = {};

  assignStringList(options, 'matches', value.matches);
  assignStringList(options, 'excludeMatches', value.excludeMatches);
  assignStringList(options, 'includeGlobs', value.includeGlobs);
  assignStringList(options, 'excludeGlobs', value.excludeGlobs);
  assignStringList(options, 'include', value.include);
  assignStringList(options, 'exclude', value.exclude);
  assignBoolean(options, 'allFrames', value.allFrames);
  assignBoolean(options, 'matchAboutBlank', value.matchAboutBlank);
  assignBoolean(options, 'matchOriginAsFallback', value.matchOriginAsFallback);
  assignString(options, 'runAt', value.runAt);
  assignString(options, 'world', value.world);
  assignString(options, 'cssInjectionMode', value.cssInjectionMode);
  assignString(options, 'registration', value.registration);
  assignString(options, 'type', value.type);

  return options;
}

function assignStringList(
  options: EntrypointManifestOptions,
  key:
    | 'matches'
    | 'excludeMatches'
    | 'includeGlobs'
    | 'excludeGlobs'
    | 'include'
    | 'exclude',
  value: unknown,
): void {
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string')
  ) {
    if (key === 'include' || key === 'exclude') {
      options[key] = value as BrowserTarget[];
    } else {
      options[key] = value as string[];
    }
  }
}

function assignBoolean(
  options: EntrypointManifestOptions,
  key:
    | 'allFrames'
    | 'matchAboutBlank'
    | 'matchOriginAsFallback',
  value: unknown,
): void {
  if (typeof value === 'boolean') {
    options[key] = value;
  }
}

function assignString(
  options: EntrypointManifestOptions,
  key:
    | 'runAt'
    | 'world'
    | 'cssInjectionMode'
    | 'registration'
    | 'type',
  value: unknown,
): void {
  if (typeof value === 'string') {
    options[key] = value;
  }
}

function mergeBrowserList(
  first: readonly BrowserTarget[] | undefined,
  second: readonly BrowserTarget[] | undefined,
): readonly BrowserTarget[] | undefined {
  if (first === undefined) {
    return second;
  }

  if (second === undefined) {
    return first;
  }

  return second;
}

function findIndexFile(directory: string): string | null {
  for (const filename of INDEX_FILENAMES) {
    const candidate = path.join(directory, filename);

    if (isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseStringList(value: string): string[] {
  const trimmed = value.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = new Function(`"use strict"; return (${trimmed});`)();

      if (
        Array.isArray(parsed) &&
        parsed.every((entry) => typeof entry === 'string')
      ) {
        return parsed;
      }
    } catch {
      return [];
    }
  }

  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function skipWhitespace(source: string, start: number): number {
  let index = start;

  while (index < source.length && /\s/.test(source[index] ?? '')) {
    index += 1;
  }

  return index;
}

function readBalanced(
  source: string,
  start: number,
  open: string,
  close: string,
): string | null {
  let depth = 0;
  let index = start;

  while (index < source.length) {
    const character = source[index];

    if (character === '"' || character === "'" || character === '`') {
      index = skipString(source, index);
      continue;
    }

    if (character === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }

    if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (character === open) {
      depth += 1;
    } else if (character === close) {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }

    index += 1;
  }

  return null;
}

function skipString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const character = source[index];

    if (character === '\\') {
      index += 2;
      continue;
    }

    if (character === quote) {
      return index + 1;
    }

    index += 1;
  }

  return index;
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function assertEntrypointSelection(
  selection: readonly BrowserTarget[] | undefined,
  field: string,
  configPath: string | null,
): void {
  if (selection === undefined) {
    return;
  }

  if (!Array.isArray(selection)) {
    throw entrypointError(
      'ADDONOVA_CONFIG_ENTRYPOINTS',
      `Entrypoint "${field}" must be an array of browser targets.`,
      `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
      configPath,
    );
  }

  for (const target of selection) {
    if (!isBrowserTarget(target)) {
      throw entrypointError(
        'ADDONOVA_CONFIG_ENTRYPOINTS',
        `Entrypoint "${field}" contains an unknown browser target "${String(target)}".`,
        `Use one of: ${BROWSER_TARGETS.join(', ')}.`,
        configPath,
      );
    }
  }
}

function entrypointError(
  code: string,
  message: string,
  suggestion: string,
  configPath: string | null,
): AddonovaError {
  return new AddonovaError({
    code,
    severity: 'error',
    message,
    suggestion,
    ...(configPath === null ? {} : { location: { file: configPath } }),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
