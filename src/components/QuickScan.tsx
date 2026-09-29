import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speciesForCoordinates, type Coordinates } from '@/lib/region';
import { SPECIES, biteRateFor, type Species } from '@/lib/speciesCatalog';

interface QuickScanProps {
  coordinates: Coordinates | null;
  onSpeciesSelect: (species: Species) => void;
}

export default function QuickScan({ coordinates, onSpeciesSelect }: QuickScanProps) {
  const [condition, setCondition] = useState<'stable'>('stable'); // Default condition
  const [isScanning, setIsScanning] = useState(false);

  const hotList = useMemo(() => {
    if (!coordinates) return [];
    
    const localSpecies = speciesForCoordinates(SPECIES, coordinates);
    return localSpecies
      .map(s => ({
        ...s,
        currentBiteRate: biteRateFor(s, condition)
      }))
      .sort((a, b) => b.currentBiteRate - a.currentBiteRate)
      .slice(0, 3);
  }, [coordinates, condition]);

  if (!coordinates) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #0f172a, #1e293b)', 
        border: '1px solid #334155', borderRadius: '16px', padding: '16px', 
        textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginBottom: '16px' 
      }}>
        📡 Enable GPS to see the local Hot-List
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #082f49, #0a0f1e)', 
      border: '1px solid #0891b2', borderRadius: '16px', padding: '16px', 
      marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🎯</span>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Local Hot-List</div>
        </div>
        <div style={{ fontSize: '10px', color: '#67e8f9', background: 'rgba(8,145,178,0.2)', padding: '2px 8px', borderRadius: '999px', border: '1px solid #0891b2' }}>
          LIVE SCAN
        </div>
      </div>

      {hotList.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '10px 0' }}>
          No active species found for this region.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hotList.map(species => (
            <button 
              key={species.id}
              onClick={() => onSpeciesSelect(species)}
              style={{ 
                background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b', 
                borderRadius: '12px', padding: '10px', display: 'flex', 
                alignItems: 'center', justifyContent: 'space-between', 
                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={species.image} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>{species.name}</div>
              </div>
              <div style={{ 
                fontSize: '12px', fontWeight: 'bold', 
                color: species.currentBiteRate >= 70 ? '#4ade80' : species.currentBiteRate >= 40 ? '#fbbf24' : '#f87171',
                background: species.currentBiteRate >= 70 ? 'rgba(74,222,128,0.1)' : species.currentBiteRate >= 40 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
                padding: '2px 8px', borderRadius: '8px', border: `1px solid ${species.currentBiteRate >= 70 ? '#4ade80' : species.currentBiteRate >= 40 ? '#fbbf24' : '#f87171'}`
              }}>
                {species.currentBiteRate}/100
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
