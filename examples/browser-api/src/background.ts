import { runtime, storage } from '@addonova/browser';

runtime.onInstalled.addListener(() => {
  void storage.local.set({ installedAt: Date.now() });
});
