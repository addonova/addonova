import React, { useState } from 'react';

import { storage } from '@addonova/browser';

export default function App(): React.JSX.Element {
  const [count, setCount] = useState(0);

  const increment = async (): Promise<void> => {
    const next = count + 1;

    setCount(next);
    await storage.local.set({ count: next });
  };

  return (
    <main className="popup">
      <h1>__PROJECT_TITLE__</h1>
      <p>A React extension built with Addonova.</p>
      <button type="button" onClick={() => void increment()}>
        Count: {count}
      </button>
    </main>
  );
}
