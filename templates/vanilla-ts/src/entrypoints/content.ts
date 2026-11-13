import { getBrowserInfo } from '@addonova/browser';
import { defineContentScript } from 'addonova/defines';

import { formatGreeting } from '../shared';

export default defineContentScript({
  matches: ['https://example.com/*'],
  main() {
    const info = getBrowserInfo();

    console.log(formatGreeting('content script'), `${info.name}/${info.engine}`);
  },
});
