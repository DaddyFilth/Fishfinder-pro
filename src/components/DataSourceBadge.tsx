'use client';

import React from 'react';
import { DataSource, useLiveSpotsContext } from '../contexts/LiveSpotsContext';

const badgeColor = (ds: DataSource) =>
  ds === 'LIVE' ? '#16a34a' : ds === 'CACHE' ? '#f59e0b' : '#6b7280';

export const DataSourceBadge: React.FC = () => {
  const { dataSource } = useLiveSpotsContext();
  const color = badgeColor(dataSource);
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    background: color,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style} aria-label={`data-source-${dataSource}`}>
      {dataSource}
    </span>
  );
};

export default DataSourceBadge;
