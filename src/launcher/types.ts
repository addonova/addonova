import type { BrowserTarget } from '../core/types.ts';

export interface WebExtConfig {
  disabled?: boolean;
  binaries?: Partial<Record<BrowserTarget, string>>;
  chromiumArgs?: readonly string[];
  firefoxArgs?: readonly string[];
  chromiumProfile?: string;
  firefoxProfile?: string;
  keepProfileChanges?: boolean;
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
