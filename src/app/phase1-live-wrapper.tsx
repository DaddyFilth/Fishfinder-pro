'use client';

import React from 'react';
import { LiveSpotsProvider } from '../contexts/LiveSpotsContext';
import { DataSourceBadge } from '../components/DataSourceBadge';

export const Phase1LiveWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <LiveSpotsProvider>
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 700 }}>FishFinder</span>
        <DataSourceBadge />
      </div>
      {children}
    </div>
  </LiveSpotsProvider>
);

export default Phase1LiveWrapper;
