'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type DataSource = 'ONLINE' | 'OFFLINE';

export const LiveSpotsContext = createContext<{ dataSource: DataSource }>({
  dataSource: 'OFFLINE',
});

export const useLiveSpotsContext = () => useContext(LiveSpotsContext);

function resolveDataSource(): DataSource {
  return typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE';
}

export const LiveSpotsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dataSource, setDataSource] = useState<DataSource>(resolveDataSource);

  useEffect(() => {
    const update = () => setDataSource(resolveDataSource());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <LiveSpotsContext.Provider value={{ dataSource }}>
      {children}
    </LiveSpotsContext.Provider>
  );
};
