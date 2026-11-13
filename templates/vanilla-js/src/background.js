import { action, runtime, storage } from '@addonova/browser';

import { formatGreeting } from './shared.js';

runtime.onInstalled.addListener((details) => {
  void storage.local.set({ installedAt: Date.now() });
  void action.setBadgeText({ text: details.reason === 'install' ? 'NEW' : '' });
  console.log(formatGreeting('background'), details.reason);
});
