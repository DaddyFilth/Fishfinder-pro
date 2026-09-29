import React, { useState, useEffect } from 'react';
import { useBitePredictions, type Prediction } from '@/hooks/useBitePredictions';
import { Coordinates } from '@/lib/region';

interface PredictiveAlertsProps {
  coordinates: Coordinates | null;
  onSpeciesSelect: (speciesId: string) => void;
}

export default function PredictiveAlerts({ coordinates, onSpeciesSelect }: PredictiveAlertsProps) {
  const { predictions, isLoading } = useBitePredictions(coordinates);

  if (isLoading) return null; // Avoid layout shift during initial scan
  if (predictions.length === 0) return null; // Only show if there are active fish

  return (
    <div style={{ 
      background: 'rgba(15, 23, 42, 0.8)', 
      backdropFilter: 'blur(12px)', 
      border: '1px solid #1e293b', 
      borderRadius: '16px', 
      padding: '12px', 
      marginBottom: '16px',
      borderLeft: '4px solid #22d3ee'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '16px' }}>🔔</span>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Smart Alerts
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {predictions.slice(0, 2).map(p => (
          <div 
            key={p.speciesId}
            onClick={() => onSpeciesSelect(p.speciesId)}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '8px 12px', background: 'rgba(255,255,255,0.05)', 
              borderRadius: '10px', cursor: 'pointer', transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '8px', height: '8px', borderRadius: '50%', 
                background: p.isPrime ? '#4ade80' : '#fbbf24' 
              }} />
              <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{p.name}</span>
            </div>
            <div style={{ 
              fontSize: '11px', fontWeight: 'bold', 
              color: p.isPrime ? '#4ade80' : '#fbbf24',
              background: p.isPrime ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
              padding: '2px 6px', borderRadius: '4px'
            }}>
              {p.reason}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
