import type { BrowserTarget } from '../../core/types.ts';
import type { Diagnostic } from '../../core/errors.ts';
import type { SpawnFunction } from '../process.ts';
import type {
  BrowserProfilePlan,
  ResolvedWebExtConfig,
  RunningBrowser,
} from '../types.ts';

export interface LaunchBrowserOptions {
  target: BrowserTarget;
  binary: string;
  extensionDir: string;
  profile: BrowserProfilePlan;
  config: ResolvedWebExtConfig;
  projectRoot: string;
  env: NodeJS.ProcessEnv;
  spawn?: SpawnFunction;
  launchTimeoutMs?: number;
  protocolTimeoutMs?: number;
  onWarning?: (diagnostic: Diagnostic) => void;
}

export interface BrowserAdapter {
  readonly family: 'chromium' | 'firefox';
  launch(options: LaunchBrowserOptions): Promise<RunningBrowser>;
}
