import { spawn } from 'node:child_process';
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AddonovaError } from './errors.ts';
import { ADDONOVA_VERSION } from './version.ts';

export const BUILTIN_TEMPLATES = ['vanilla-ts', 'vanilla-js', 'react'] as const;

export type BuiltinTemplate = (typeof BUILTIN_TEMPLATES)[number];

export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const TEMPLATE_LABELS: Readonly<Record<BuiltinTemplate, string>> = {
  'vanilla-ts': 'Vanilla TypeScript',
  'vanilla-js': 'Vanilla JavaScript',
  react: 'React + TypeScript',
};

export const DEFAULT_TEMPLATE: BuiltinTemplate = 'vanilla-ts';

const TEMPLATE_ALIASES: Readonly<Record<string, BuiltinTemplate>> = {
  vanilla: 'vanilla-ts',
};

const TEMPLATES_DIR = fileURLToPath(new URL('../../templates/', import.meta.url));

const TEXT_EXTENSIONS = new Set([
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.html',
  '.htm',
  '.css',
  '.i18n',
  '.md',
  '.txt',
  '.svg',
  '.yml',
  '.yaml',
]);

const REMOTE_TEMPLATE_PATTERN =
  /^(?:gh:|github:)[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.\-/]+)?(?:#[A-Za-z0-9_.\-/]+)?$/;

const GITHUB_URL_PREFIX = 'https://github.com/';

export interface TemplateDownloader {
  download(source: string, dir: string): Promise<void>;
}

export interface InitProjectOptions {
  cwd: string;
  directory?: string;
  template?: string;
  packageManager?: PackageManager;
  git?: boolean;
  force?: boolean;
  offline?: boolean;
  env?: NodeJS.ProcessEnv;
  downloader?: TemplateDownloader;
  gitInit?: (root: string) => Promise<boolean>;
}

export interface InitProjectResult {
  root: string;
  template: string;
  label: string;
  packageManager: PackageManager;
  gitInitialized: boolean;
  files: readonly string[];
  warnings: readonly string[];
}

export async function initProject(
  options: InitProjectOptions,
): Promise<InitProjectResult> {
  const templateInput =
    options.template === undefined || options.template.trim() === ''
      ? DEFAULT_TEMPLATE
      : options.template.trim();
  const builtin = resolveBuiltinTemplate(templateInput);
  const remoteSource =
    builtin === null ? normalizeRemoteTemplate(templateInput) : null;
  const root = path.resolve(options.cwd, options.directory ?? '.');
  const warnings: string[] = [];

  await assertTargetDirectory(root, options.force === true);
  await mkdir(root, { recursive: true });

  const downloader = options.downloader ?? defaultDownloader;

  if (builtin !== null) {
    const bundled = path.join(TEMPLATES_DIR, builtin);

    if (await isDirectory(bundled)) {
      await copyDirectory(bundled, root);
    } else if (options.offline === true) {
      throw missingTemplatesError(builtin);
    } else {
      await downloadRemote(
        `gh:addonova/addonova/templates/${builtin}`,
        root,
        downloader,
      );
    }
  } else {
    if (options.offline === true) {
      throw offlineError(templateInput);
    }

    await downloadRemote(remoteSource ?? templateInput, root, downloader);
  }

  await finalizeTemplate(root);

  const gitInitialized =
    options.git === false
      ? false
      : await initializeGit(root, options.gitInit, warnings);
  const files = await listFiles(root);
  const packageManager = await detectPackageManager({
    cwd: options.cwd,
    ...(options.packageManager === undefined
      ? {}
      : { explicit: options.packageManager }),
    ...(options.env === undefined ? {} : { env: options.env }),
  });

  return {
    root,
    template: builtin ?? remoteSource ?? templateInput,
    label:
      builtin === null
        ? (remoteSource ?? templateInput)
        : TEMPLATE_LABELS[builtin],
    packageManager,
    gitInitialized,
    files,
    warnings,
  };
}

export function isBuiltinTemplate(value: unknown): value is BuiltinTemplate {
  return (
    typeof value === 'string' &&
    (BUILTIN_TEMPLATES as readonly string[]).includes(value)
  );
}

export function resolveBuiltinTemplate(value: string): BuiltinTemplate | null {
  const normalized = value.trim().toLowerCase();

  if (isBuiltinTemplate(normalized)) {
    return normalized;
  }

  return TEMPLATE_ALIASES[normalized] ?? null;
}

export function isPackageManager(value: unknown): value is PackageManager {
  return (
    typeof value === 'string' &&
    (PACKAGE_MANAGERS as readonly string[]).includes(value)
  );
}

export async function detectPackageManager(options: {
  cwd: string;
  explicit?: PackageManager;
  env?: NodeJS.ProcessEnv;
}): Promise<PackageManager> {
  if (options.explicit !== undefined) {
    return options.explicit;
  }

  const env = options.env ?? process.env;
  const agent = env.npm_config_user_agent ?? '';
  const match = /^(npm|pnpm|yarn|bun)\//.exec(agent);

  if (match !== null && isPackageManager(match[1])) {
    return match[1];
  }

  const lockfiles: ReadonlyArray<readonly [string, PackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ];

  for (const [file, manager] of lockfiles) {
    if (await isFile(path.join(options.cwd, file))) {
      return manager;
    }
  }

  return 'npm';
}

function normalizeRemoteTemplate(value: string): string {
  const trimmed = value.trim();
  const source = toGigetSource(trimmed);

  if (hasTraversal(source)) {
    throw new AddonovaError({
      code: 'ADDONOVA_INIT_TEMPLATE_INVALID',
      severity: 'error',
      message: `Invalid template source "${trimmed}".`,
      suggestion: 'Template paths cannot contain "." or ".." segments.',
    });
  }

  if (!REMOTE_TEMPLATE_PATTERN.test(source)) {
    if (!trimmed.includes('/') && !trimmed.startsWith(GITHUB_URL_PREFIX)) {
      throw new AddonovaError({
        code: 'ADDONOVA_INIT_TEMPLATE_UNKNOWN',
        severity: 'error',
        message: `Unknown template "${trimmed}".`,
        suggestion: `Use one of: ${BUILTIN_TEMPLATES.join(
          ', ',
        )}, or a GitHub source such as gh:owner/repo.`,
      });
    }

    throw new AddonovaError({
      code: 'ADDONOVA_INIT_TEMPLATE_INVALID',
      severity: 'error',
      message: `Invalid template source "${trimmed}".`,
      suggestion:
        'Use gh:owner/repo, gh:owner/repo/path#ref, owner/repo, or a GitHub URL.',
    });
  }

  return source;
}

function hasTraversal(source: string): boolean {
  const [withoutRef = ''] = source.split('#');

  return withoutRef
    .replace(/^(?:gh:|github:)/, '')
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
}

function toGigetSource(value: string): string {
  if (value.startsWith(GITHUB_URL_PREFIX)) {
    const parts = value.slice(GITHUB_URL_PREFIX.length).split('/');
    const owner = parts[0];
    const repo = parts[1];

    if (owner === undefined || repo === undefined || repo === '') {
      return value;
    }

    const mode = parts[2];
    const ref = parts[3];

    if (mode === 'tree' && ref !== undefined && ref !== '') {
      const subpath = parts.slice(4).join('/');

      return `gh:${owner}/${repo}${subpath === '' ? '' : `/${subpath}`}#${ref}`;
    }

    return `gh:${owner}/${repo}`;
  }

  if (value.startsWith('gh:') || value.startsWith('github:')) {
    return value;
  }

  return `gh:${value}`;
}

async function assertTargetDirectory(
  root: string,
  force: boolean,
): Promise<void> {
  let info;

  try {
    info = await stat(root);
  } catch {
    return;
  }

  if (!info.isDirectory()) {
    throw new AddonovaError({
      code: 'ADDONOVA_INIT_DIRECTORY_INVALID',
      severity: 'error',
      message: `Cannot create a project at "${root}" because it is not a directory.`,
      suggestion: 'Pass a directory path that does not point to a file.',
    });
  }

  if (force) {
    return;
  }

  const entries = (await readdir(root)).filter((entry) => entry !== '.git');

  if (entries.length > 0) {
    throw new AddonovaError({
      code: 'ADDONOVA_INIT_DIRECTORY_NOT_EMPTY',
      severity: 'error',
      message: `The directory "${root}" is not empty.`,
      suggestion: 'Choose an empty directory or pass --force to scaffold into it.',
    });
  }
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(from, to);
    } else {
      await cp(from, to, { force: true });
    }
  }
}

async function finalizeTemplate(root: string): Promise<void> {
  const gitignore = path.join(root, '_gitignore');

  if (await isFile(gitignore)) {
    const target = path.join(root, '.gitignore');

    if (await exists(target)) {
      await rm(gitignore, { force: true });
    } else {
      await rename(gitignore, target);
    }
  }

  const projectName = projectNameFromDirectory(root);
  const projectTitle = projectTitleFromName(projectName);

  for (const relativePath of await listFiles(root)) {
    if (!TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
      continue;
    }

    const absolutePath = path.join(root, relativePath);
    const contents = await readFile(absolutePath, 'utf8');

    if (!contents.includes('__')) {
      continue;
    }

    const next = contents
      .replaceAll('__PROJECT_NAME__', projectName)
      .replaceAll('__PROJECT_TITLE__', projectTitle)
      .replaceAll('__ADDONOVA_VERSION__', ADDONOVA_VERSION);

    if (next !== contents) {
      await writeFile(absolutePath, next);
    }
  }
}

async function initializeGit(
  root: string,
  gitInit: ((root: string) => Promise<boolean>) | undefined,
  warnings: string[],
): Promise<boolean> {
  if (await exists(path.join(root, '.git'))) {
    return false;
  }

  try {
    return await (gitInit ?? defaultGitInit)(root);
  } catch (error) {
    warnings.push(
      `git init failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    return false;
  }
}

function defaultGitInit(root: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const child = spawn('git', ['init'], {
      cwd: root,
      stdio: 'ignore',
      shell: true,
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`git init exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

async function downloadRemote(
  source: string,
  root: string,
  downloader: TemplateDownloader,
): Promise<void> {
  try {
    await downloader.download(source, root);
  } catch (error) {
    throw new AddonovaError({
      code: 'ADDONOVA_INIT_DOWNLOAD_FAILED',
      severity: 'error',
      message: `Failed to download template "${source}".`,
      suggestion:
        'Check the template name and network connection, or use a bundled template with --offline.',
      cause: error,
    });
  }
}

const defaultDownloader: TemplateDownloader = {
  async download(source: string, dir: string): Promise<void> {
    const { downloadTemplate } = await import('giget');

    await downloadTemplate(source, { dir, force: true });
  },
};

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  await walk('');

  return files.sort();

  async function walk(relativeDirectory: string): Promise<void> {
    const directory =
      relativeDirectory === ''
        ? root
        : path.join(root, relativeDirectory);
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }

      const relativePath =
        relativeDirectory === ''
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;

      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
}

function projectNameFromDirectory(root: string): string {
  const base = path.basename(root);
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  if (normalized === '') {
    return 'addonova-extension';
  }

  if (normalized.startsWith('.') || normalized.startsWith('_')) {
    return `addonova-${normalized.slice(1)}`;
  }

  return normalized;
}

function projectTitleFromName(name: string): string {
  const words = name
    .split(/[-_.\s]+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length === 0 ? 'Addonova Extension' : words.join(' ');
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);

    return true;
  } catch {
    return false;
  }
}

function offlineError(template: string): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_INIT_OFFLINE',
    severity: 'error',
    message: `Template "${template}" is not bundled and cannot be downloaded in offline mode.`,
    suggestion: `Use a bundled template (${BUILTIN_TEMPLATES.join(
      ', ',
    )}) or remove --offline.`,
  });
}

function missingTemplatesError(template: string): AddonovaError {
  return new AddonovaError({
    code: 'ADDONOVA_INIT_TEMPLATES_MISSING',
    severity: 'error',
    message: `The bundled "${template}" template could not be found.`,
    suggestion:
      'Reinstall addonova, or remove --offline to download the template.',
  });
}
