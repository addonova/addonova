import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';

import { watch as chokidarWatch } from 'chokidar';
import type { FSWatcher } from 'chokidar';

import { guchhoAdapter } from '../bundler/guchho.ts';
import type {
  BundlerAdapter,
  BundlerBuildResult,
  BundlerContext,
  BundlerTransform,
} from '../bundler/adapter.ts';
import {
  copyPublicDirectory,
  getOutputDirectory,
  toBundlerBuildInput,
} from '../core/build.ts';
import { CONFIG_FILENAMES } from '../core/config.ts';
import type { ResolvedBrowser, ResolvedConfig } from '../core/config.ts';
import { AddonovaError, toDiagnostic } from '../core/errors.ts';
import { buildManifest, writeManifest } from '../browser/manifest.ts';
import {
  createPluginManager,
  mergePluginDiagnostics,
} from '../plugins/manager.ts';
import type { PluginManager } from '../plugins/manager.ts';
import type { CliIo } from '../cli/command.ts';
import { formatDiagnostic } from '../cli/format.ts';
import { formatDuration, getCliStyle, SYMBOLS } from '../cli/style.ts';
import type { CliStyle } from '../cli/style.ts';

export type ChangeKind =
  | 'config'
  | 'manifest'
  | 'entrypoint'
  | 'source'
  | 'asset'
  | 'unknown';

export interface DevWatcher {
  on(
    event: 'all',
    listener: (event: string, file: string) => void,
  ): void;
  close(): Promise<void>;
}

export interface DevWatcherOptions {
  ignored: (filePath: string) => boolean;
  onError?: (error: unknown) => void;
}

export type DevWatcherFactory = (
  paths: readonly string[],
  options: DevWatcherOptions,
) => Promise<DevWatcher> | DevWatcher;

export interface DevSessionOptions {
  config: ResolvedConfig;
  io: CliIo;
  adapter?: BundlerAdapter;
  transforms?: readonly BundlerTransform[];
  debounceMs?: number;
  watcherFactory?: DevWatcherFactory;
  reloadConfig?: () => Promise<ResolvedConfig>;
}

interface ActiveTarget {
  browser: ResolvedBrowser;
  outdir: string;
  staging: string;
  context: BundlerContext;
}

interface TargetSet {
  generation: number;
  root: string;
  targets: readonly ActiveTarget[];
}

const DEFAULT_DEBOUNCE_MS = 100;

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.css',
  '.html',
  '.htm',
  '.js',
  '.json',
  '.jsx',
  '.less',
  '.mjs',
  '.mts',
  '.sass',
  '.scss',
  '.ts',
  '.tsx',
]);

const ASSET_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.csv',
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.otf',
  '.pdf',
  '.png',
  '.svg',
  '.ttf',
  '.txt',
  '.wasm',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.xml',
]);

export function classifyChange(file: string, config: ResolvedConfig): ChangeKind {
  const resolved = path.resolve(file);
  const fileName = path.basename(resolved).toLowerCase();

  if (
    config.configPath !== null &&
    samePath(resolved, config.configPath)
  ) {
    return 'config';
  }

  if (
    (CONFIG_FILENAMES as readonly string[]).some(
      (candidate) => candidate.toLowerCase() === fileName,
    )
  ) {
    return 'config';
  }

  if (fileName === 'manifest.json') {
    return 'manifest';
  }

  if (
    config.entrypoints.some((entrypoint) => samePath(resolved, entrypoint.input))
  ) {
    return 'entrypoint';
  }

  if (isWithin(config.publicDir, resolved)) {
    return 'asset';
  }

  const extension = path.extname(fileName);

  if (ASSET_EXTENSIONS.has(extension)) {
    return 'asset';
  }

  if (SOURCE_EXTENSIONS.has(extension)) {
    return 'source';
  }

  return 'unknown';
}

export class DevSession {
  private config: ResolvedConfig;
  private readonly io: CliIo;
  private readonly style: CliStyle;
  private readonly adapter: BundlerAdapter;
  private readonly baseTransforms: readonly BundlerTransform[] | undefined;
  private pluginManager: PluginManager;
  private readonly debounceMs: number;
  private readonly watcherFactory: DevWatcherFactory;
  private readonly reloadConfig: () => Promise<ResolvedConfig>;
  private targetSet: TargetSet | null = null;
  private watcher: DevWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private rebuilding = false;
  private rebuildQueued = false;
  private configDirty = false;
  private closed = false;
  private generation = 0;
  private readonly idleWaiters: Array<() => void> = [];

  private constructor(options: DevSessionOptions) {
    this.config = options.config;
    this.io = options.io;
    this.style = getCliStyle(options.io);
    this.adapter = options.adapter ?? guchhoAdapter;
    this.baseTransforms = options.transforms;
    this.pluginManager = createPluginManager(options.config.plugins);
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.watcherFactory = options.watcherFactory ?? createChokidarWatcher;
    this.reloadConfig =
      options.reloadConfig ??
      (async () => options.config);

    if (this.adapter.createContext === undefined) {
      throw new AddonovaError({
        code: 'ADDONOVA_DEV_CONTEXT_UNSUPPORTED',
        severity: 'error',
        message: `Bundler adapter "${this.adapter.name}" does not support warm contexts.`,
        suggestion: 'Use an adapter that implements createContext() for dev mode.',
      });
    }
  }

  static async create(options: DevSessionOptions): Promise<DevSession> {
    const session = new DevSession(options);

    await session.start();

    return session;
  }

  get resolvedConfig(): ResolvedConfig {
    return this.config;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private async start(): Promise<void> {
    this.watcher = await this.watcherFactory(this.getWatchPaths(), {
      ignored: (filePath) => this.isIgnored(filePath),
      onError: (error) => this.printError(error),
    });
    this.watcher.on('all', (event, file) => {
      if (event === 'add' || event === 'change' || event === 'unlink') {
        this.handleFileChange(file);
      }
    });

    await this.runPluginHooks(async () => {
      this.targetSet = await this.createTargetSet(
        this.config,
        this.getTransforms(),
      );
      await this.rebuildTargets('initial');
    });

    this.io.stdout.write(
      `${this.style.cyan(SYMBOLS.info)} Watching ${this.style.cyan(
        this.config.root,
      )} for changes. Press Ctrl+C to stop.\n`,
    );
  }

  handleFileChange(file: string): void {
    if (this.closed) {
      return;
    }

    const kind = classifyChange(file, this.config);
    const relative = path.relative(this.config.root, path.resolve(file));

    this.io.stdout.write(
      `${this.style.cyan(SYMBOLS.info)} Change detected (${this.style.yellow(
        kind,
      )}): ${this.style.dim(relative.split(path.sep).join('/'))}\n`,
    );

    if (kind === 'config') {
      this.configDirty = true;
    }

    this.scheduleRebuild(this.debounceMs);
  }

  async waitForIdle(): Promise<void> {
    if (!this.isBusy()) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.configDirty = false;
    this.rebuildQueued = false;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const watcher = this.watcher;
    this.watcher = null;

    if (watcher !== null) {
      await watcher.close();
    }

    await this.waitForIdle();

    if (this.targetSet !== null) {
      await this.disposeTargetSet(this.targetSet);
      this.targetSet = null;
    }

    try {
      await this.adapter.dispose?.();
    } finally {
      this.resolveIdle();
    }
  }

  private isBusy(): boolean {
    return (
      this.timer !== null ||
      this.rebuilding ||
      this.rebuildQueued ||
      this.configDirty
    );
  }

  private scheduleRebuild(delay: number): void {
    if (this.closed) {
      return;
    }

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runRebuild();
    }, delay);
  }

  private async runRebuild(): Promise<void> {
    if (this.closed) {
      return;
    }

    if (this.rebuilding) {
      this.rebuildQueued = true;
      return;
    }

    this.rebuilding = true;

    try {
      const reloadRequested = this.configDirty;
      this.configDirty = false;

      if (reloadRequested) {
        const reloaded = await this.reloadAndRecreate();

        if (!reloaded) {
          return;
        }
      }

      try {
        await this.runPluginHooks(() => this.rebuildTargets('change'));
      } catch (error) {
        this.printError(error);
      }
    } finally {
      this.rebuilding = false;

      if (this.rebuildQueued && !this.closed) {
        this.rebuildQueued = false;
        this.scheduleRebuild(0);
      } else {
        this.resolveIdle();
      }
    }
  }

  private async reloadAndRecreate(): Promise<boolean> {
    let nextConfig: ResolvedConfig;

    try {
      nextConfig = await this.reloadConfig();
    } catch (error) {
      this.printError(error);
      return false;
    }

    let nextManager: PluginManager;
    let nextSet: TargetSet;

    try {
      nextManager = createPluginManager(nextConfig.plugins);
      nextSet = await this.createTargetSet(nextConfig, [
        ...nextManager.transforms,
        ...(this.baseTransforms ?? []),
      ]);
    } catch (error) {
      this.printError(error);
      return false;
    }

    const previousSet = this.targetSet;

    this.config = nextConfig;
    this.pluginManager = nextManager;
    this.targetSet = nextSet;

    if (previousSet !== null) {
      await this.disposeTargetSet(previousSet);
    }

    this.io.stdout.write(
      `${this.style.cyan(SYMBOLS.info)} Reloaded configuration ${this.style.dim(
        this.config.configPath ?? '(defaults)',
      )}\n`,
    );

    return true;
  }

  private getTransforms(): readonly BundlerTransform[] {
    return [...this.pluginManager.transforms, ...(this.baseTransforms ?? [])];
  }

  private async runPluginHooks(run: () => Promise<void>): Promise<void> {
    await this.pluginManager.buildStart();

    try {
      await run();
    } finally {
      await this.pluginManager.buildEnd();
    }
  }

  private async createTargetSet(
    config: ResolvedConfig,
    transforms: readonly BundlerTransform[],
  ): Promise<TargetSet> {
    if (this.adapter.createContext === undefined) {
      throw new AddonovaError({
        code: 'ADDONOVA_DEV_CONTEXT_UNSUPPORTED',
        severity: 'error',
        message: `Bundler adapter "${this.adapter.name}" does not support warm contexts.`,
        suggestion: 'Use an adapter that implements createContext() for dev mode.',
      });
    }

    const generation = this.generation + 1;
    const root = path.join(config.outdir, '.addonova', `gen-${generation}`);
    const targets: ActiveTarget[] = [];

    try {
      for (const browser of config.browsers) {
        const outdir = getOutputDirectory(config.outdir, browser, config.browsers);
        const key = path.relative(config.outdir, outdir) || browser.target;
        const staging = path.join(root, key);

        mkdirSync(staging, { recursive: true });

        const context = await this.adapter.createContext(
          toBundlerBuildInput(config, browser, staging, transforms),
        );

        targets.push({
          browser,
          outdir,
          staging,
          context,
        });
      }
    } catch (error) {
      for (const target of targets) {
        await target.context.dispose().catch(() => undefined);
      }

      rmSync(root, { recursive: true, force: true });
      throw error;
    }

    this.generation = generation;

    return { generation, root, targets };
  }

  private async rebuildTargets(reason: 'initial' | 'change'): Promise<void> {
    const targetSet = this.targetSet;

    if (targetSet === null || this.closed) {
      return;
    }

    for (const target of targetSet.targets) {
      await this.rebuildTarget(target, reason);
    }
  }

  private async rebuildTarget(
    target: ActiveTarget,
    reason: 'initial' | 'change',
  ): Promise<void> {
    const started = Date.now();
    let result: BundlerBuildResult;

    try {
      result = await target.context.rebuild();
    } catch (error) {
      this.printError(error);
      return;
    }

    result = mergePluginDiagnostics(
      result,
      this.pluginManager.takeDiagnostics(),
    );

    for (const warning of result.warnings) {
      this.io.stderr.write(`${formatDiagnostic(warning, this.style)}\n`);
    }

    if (!result.success) {
      for (const error of result.errors) {
        this.io.stderr.write(`${formatDiagnostic(error, this.style)}\n`);
      }

      this.io.stderr.write(
        `${this.style.red(SYMBOLS.error)} Dev build failed for ${this.style.cyan(
          target.browser.target,
        )} MV${target.browser.manifestVersion}; keeping the last successful output.\n`,
      );
      return;
    }

    try {
      const generated = new Set(
        result.outputs.map((output) =>
          relativeOutputPath(target.staging, output.path),
        ),
      );
      const publicCopy = copyPublicDirectory(
        this.config.publicDir,
        target.staging,
        { generatedPaths: generated },
      );

      for (const warning of publicCopy.warnings) {
        this.io.stderr.write(`${formatDiagnostic(warning, this.style)}\n`);
      }

      const availableFiles = new Set([
        ...generated,
        ...publicCopy.copied,
        'manifest.json',
      ]);
      const builtManifest = buildManifest(this.config.manifest, target.browser, {
        checkFiles: true,
        availableFiles,
      });

      for (const diagnostic of builtManifest.diagnostics) {
        this.io.stderr.write(`${formatDiagnostic(diagnostic, this.style)}\n`);
      }

      if (builtManifest.hasErrors) {
        this.io.stderr.write(
          `${this.style.red(SYMBOLS.error)} Dev build failed for ${this.style.cyan(
            target.browser.target,
          )} MV${target.browser.manifestVersion}; keeping the last successful output.\n`,
        );
        return;
      }

      writeManifest(target.staging, builtManifest.manifest);
      publishOutput(target.staging, target.outdir, availableFiles);

      const duration = Date.now() - started;
      const verb = reason === 'initial' ? 'Built' : 'Rebuilt';

      this.io.stdout.write(
        `${this.style.green(SYMBOLS.success)} ${verb} ${this.style.cyan(
          target.browser.target,
        )} MV${target.browser.manifestVersion} -> ${this.style.dim(
          target.outdir,
        )} (${formatDuration(duration)}, ${result.outputs.length} outputs)\n`,
      );
    } catch (error) {
      this.printError(error);
    }
  }

  private async disposeTargetSet(targetSet: TargetSet): Promise<void> {
    for (const target of targetSet.targets) {
      await target.context.dispose().catch((error: unknown) => {
        this.printError(error);
      });
    }

    rmSync(targetSet.root, { recursive: true, force: true });
  }

  private getWatchPaths(): readonly string[] {
    const paths = new Set<string>([this.config.root]);

    if (this.config.configPath !== null) {
      paths.add(this.config.configPath);
    }

    return [...paths];
  }

  private isIgnored(filePath: string): boolean {
    const resolved = path.resolve(filePath);

    if (isWithin(this.config.outdir, resolved)) {
      return true;
    }

    return ['node_modules', '.git', '.hg', '.svn'].some((directory) =>
      isWithin(path.join(this.config.root, directory), resolved),
    );
  }

  private resolveIdle(): void {
    if (this.isBusy()) {
      return;
    }

    for (const resolve of this.idleWaiters.splice(0)) {
      resolve();
    }
  }

  private printError(error: unknown): void {
    this.io.stderr.write(
      `${formatDiagnostic(toDiagnostic(error), this.style)}\n`,
    );
  }
}

export async function createDevSession(
  options: DevSessionOptions,
): Promise<DevSession> {
  return DevSession.create(options);
}

async function createChokidarWatcher(
  paths: readonly string[],
  options: DevWatcherOptions,
): Promise<DevWatcher> {
  const watcher: FSWatcher = chokidarWatch([...paths], {
    ignoreInitial: true,
    ignored: (candidate: string) => options.ignored(candidate),
    awaitWriteFinish: {
      stabilityThreshold: 50,
      pollInterval: 10,
    },
  });

  await new Promise<void>((resolve, reject) => {
    watcher.once('ready', resolve);
    watcher.once('error', reject);
  });

  watcher.on('error', (error) => {
    options.onError?.(error);
  });

  return {
    on(event, listener) {
      if (event === 'all') {
        watcher.on('all', (eventName, filePath) => {
          listener(String(eventName), String(filePath));
        });
      }
    },
    async close() {
      await watcher.close();
    },
  };
}

function relativeOutputPath(staging: string, outputPath: string): string {
  const absolute = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(staging, outputPath);

  return path.relative(staging, absolute).split(path.sep).join('/');
}

function publishOutput(
  staging: string,
  destination: string,
  relativeFiles: ReadonlySet<string>,
): void {
  const swap = `${destination}.addonova-swap`;
  const backup = `${destination}.addonova-backup`;

  rmSync(swap, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });

  try {
    for (const relativeFile of relativeFiles) {
      if (
        relativeFile === '' ||
        relativeFile.startsWith('../') ||
        path.isAbsolute(relativeFile)
      ) {
        continue;
      }

      const source = path.join(staging, relativeFile);
      const target = path.join(swap, relativeFile);

      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(source, target);
    }

    if (existsSync(destination)) {
      renameSync(destination, backup);
    }

    try {
      renameSync(swap, destination);
    } catch (error) {
      if (existsSync(backup)) {
        renameSync(backup, destination);
      }

      throw error;
    }

    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    rmSync(swap, { recursive: true, force: true });
    throw error;
  }
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);

  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));

  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}
