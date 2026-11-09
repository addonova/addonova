const badge = document.createElement('div');

badge.textContent = 'Addonova content script loaded.';
badge.style.position = 'fixed';
badge.style.right = '16px';
badge.style.bottom = '16px';
badge.style.padding = '8px 12px';
badge.style.background = '#111827';
badge.style.color = '#ffffff';
badge.style.borderRadius = '6px';
badge.style.zIndex = '2147483647';

document.body.append(badge);
