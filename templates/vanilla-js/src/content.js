import { getBrowserInfo } from '@addonova/browser';

import { formatGreeting } from './shared.js';

const info = getBrowserInfo();

console.log(formatGreeting('content script'), `${info.name}/${info.engine}`);
