import type { BrowserTarget } from '../../core/types.ts';
import { chromiumAdapter } from './chromium.ts';
import { firefoxAdapter } from './firefox.ts';
import type { BrowserAdapter } from './types.ts';

export function getBrowserAdapter(target: BrowserTarget): BrowserAdapter {
  return target === 'firefox' ? firefoxAdapter : chromiumAdapter;
}

export { chromiumAdapter, firefoxAdapter };
export type {
  BrowserAdapter,
  LaunchBrowserOptions,
} from './types.ts';
