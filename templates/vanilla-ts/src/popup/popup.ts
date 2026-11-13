import { storage } from '@addonova/browser';

const button = document.querySelector<HTMLButtonElement>('#ping');

button?.addEventListener('click', async () => {
  const values = await storage.local.get('pings');
  const pings = Number(values.pings ?? 0) + 1;

  await storage.local.set({ pings });
  console.log('ping count:', pings);
});
