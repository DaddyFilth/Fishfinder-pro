'use client';

import React from 'react';
import { LiveSpotsProvider } from '../contexts/LiveSpotsContext';
import { DataSourceBadge } from '../components/DataSourceBadge';
import PermissionStatusCard from '@/components/permissions/PermissionStatusCard';

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
        }}
      >
        <span>FishFinder</span>
        <DataSourceBadge />
      </div>
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <PermissionStatusCard />
      </div>
      {children}
    </div>
  </LiveSpotsProvider>
);

export default Phase1LiveWrapper;
