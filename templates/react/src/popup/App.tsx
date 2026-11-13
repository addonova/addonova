import React, { useState } from 'react';

export default function App(): React.JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <main className="popup">
      <h1>__PROJECT_TITLE__</h1>
      <p>A React extension built with Addonova.</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Count: {count}
      </button>
    </main>
  );
}
