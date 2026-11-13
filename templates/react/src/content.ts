import { getBrowserInfo } from '@addonova/browser';

import { formatGreeting } from './shared';

const info = getBrowserInfo();

console.log(formatGreeting('content script'), `${info.name}/${info.engine}`);
