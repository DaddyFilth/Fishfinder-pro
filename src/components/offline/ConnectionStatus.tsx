'use client';

import { useEffect, useState } from 'react';

export default function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role='status'
      style={{
        background: '#78350f',
        borderBottom: '1px solid #f59e0b',
        color: '#fef3c7',
        padding: '7px 12px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        fontWeight: 700,
        lineHeight: 1.35,
      }}
    >
      📡 Offline mode — saved trips, photos, and cached information are still
      available. Live conditions and AI refreshes need a connection.
    </div>
  );
}
