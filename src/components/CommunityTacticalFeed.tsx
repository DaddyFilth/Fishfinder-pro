import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CommunityManager } from '@/lib/community/manager';
import { CommunitySpot } from '@/lib/community/types';

/* eslint-disable react-hooks/set-state-in-effect -- initial async load hydrates external IndexedDB-backed state. */

export default function CommunityTacticalFeed() {
  const [spots, setSpots] = useState<CommunitySpot[]>([]);

  async function loadSpots() {
    const data = await CommunityManager.getActiveSpots();
    setSpots(data);
  }

  useEffect(() => {
    void loadSpots();
  }, []);

  async function reportSpot() {
    const newSpot: CommunitySpot = {
      id: crypto.randomUUID(),
      speciesId: 'bass-large',
      speciesName: 'Largemouth Bass',
      regionName: 'North Lake',
      viability: 85,
      reportedAt: new Date().toISOString(),
      isGhostSpot: true, // Privacy mode
    };
    await CommunityManager.reportSpot(newSpot);
    await loadSpots();
  }

  return (
    <div style={{ padding: '20px', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>🌐 Tactical Community Feed</h2>
        <button 
          onClick={reportSpot}
          style={{ background: '#0891b2', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Report Activity
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {spots.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>No community reports in your area yet.</div>
        ) : (
          spots.map(spot => (
            <motion.div 
              key={spot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ 
                background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', 
                borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
              }}
            >
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{spot.speciesName}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {spot.isGhostSpot ? '👻 Ghost Spot (Hidden)' : `📍 ${spot.regionName}`} • {new Date(spot.reportedAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#67e8f9', fontWeight: 'bold' }}>Viability: {spot.viability}%</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Active Now</div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
