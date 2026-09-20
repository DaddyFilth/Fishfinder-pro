'use client';

import React, { createContext, useContext, useMemo } from 'react';

export type DataSource = 'LIVE' | 'CACHE' | 'OFFLINE';

export const LiveSpotsContext = createContext<{ dataSource: DataSource }>({
  dataSource: 'OFFLINE',
});

export const useLiveSpotsContext = () => useContext(LiveSpotsContext);

function resolveDataSource(): DataSource {
  if (typeof window !== 'undefined') {
    const qa = localStorage.getItem('fishfinder.liveSpotsQA.enabled');
    if (qa) {
      const v = qa.toUpperCase();
      if (v === 'LIVE' || v === 'ON' || v === 'TRUE') return 'LIVE';
      if (v === 'CACHE') return 'CACHE';
      if (v === 'OFFLINE' || v === 'OFF') return 'OFFLINE';
    }
  }
  const env = process.env.NEXT_PUBLIC_LIVE_SPOTS_ENABLED;
  if (env === 'true' || env === '1') return 'LIVE';
  return 'OFFLINE';
}

export const LiveSpotsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dataSource = useMemo(() => resolveDataSource(), []);
  return (
    <LiveSpotsContext.Provider value={{ dataSource }}>
      {children}
    </LiveSpotsContext.Provider>
  );
};
