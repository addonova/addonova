import type { BrowserTarget } from '../core/types.ts';

export const LAUNCHER_TARGETS = [
  'chrome',
  'chromium',
  'edge',
  'firefox',
  'brave',
  'arc',
  'dia',
  'chrome-beta',
  'chrome-canary',
  'chrome-dev',
  'edge-beta',
  'edge-canary',
  'edge-dev',
  'firefox-nightly',
  'firefox-developer-edition',
  'zen',
] as const;

export type LauncherTarget = (typeof LAUNCHER_TARGETS)[number];

export function isLauncherTarget(value: unknown): value is LauncherTarget {
  return (
    typeof value === 'string' &&
    (LAUNCHER_TARGETS as readonly string[]).includes(value)
  );
}

export const BROWSER_FAMILY: Readonly<
  Record<LauncherTarget, 'chromium' | 'firefox'>
> = {
  chrome: 'chromium',
  chromium: 'chromium',
  edge: 'chromium',
  brave: 'chromium',
  arc: 'chromium',
  dia: 'chromium',
  'chrome-beta': 'chromium',
  'chrome-canary': 'chromium',
  'chrome-dev': 'chromium',
  'edge-beta': 'chromium',
  'edge-canary': 'chromium',
  'edge-dev': 'chromium',
  firefox: 'firefox',
  'firefox-nightly': 'firefox',
  'firefox-developer-edition': 'firefox',
  zen: 'firefox',
};

export const DATA_PERSISTENCE_MODES = ['none', 'project', 'user'] as const;

export type DataPersistence = (typeof DATA_PERSISTENCE_MODES)[number];

export interface WebExtConfig {
  disabled?: boolean;
  binaries?: Partial<Record<LauncherTarget, string>>;
  chromiumArgs?: readonly string[];
  firefoxArgs?: readonly string[];
  chromiumProfile?: string;
  firefoxProfile?: string;
  keepProfileChanges?: boolean;
  dataPersistence?: DataPersistence;
  projectDataDir?: string;
  startUrls?: readonly string[];
}

export interface ResolvedWebExtConfig {
  disabled: boolean;
  binaries: Readonly<Record<string, string>>;
  chromiumArgs: readonly string[];
  firefoxArgs: readonly string[];
  chromiumProfile: string | null;
  firefoxProfile: string | null;
  keepProfileChanges: boolean;
  dataPersistence: DataPersistence;
  projectDataDir: string | null;
  startUrls: readonly string[];
}

export interface BrowserProfilePlan {
  path: string;
  persistent: boolean;
}

export interface RunningBrowser {
  readonly extensionId: string;
  readonly isRunning: boolean;
  reload(): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserLauncher extends RunningBrowser {
  readonly target: BrowserTarget;
  launch(): Promise<void>;
}
