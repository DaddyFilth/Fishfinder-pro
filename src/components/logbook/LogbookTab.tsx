import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogbookManager } from '@/lib/logbook/manager';
import { Catch } from '@/lib/logbook/types';

export default function LogbookTab() {
  const [catches, setCatches] = useState<Catch[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const data = await LogbookManager.getAllCatches();
    setCatches(data);
    setStats(await LogbookManager.getStats());
  }

  async function handleAddQuickCatch() {
    const newCatch: Catch = {
      id: crypto.randomUUID(),
      speciesId: 'bass-large',
      speciesName: 'Largemouth Bass',
      weight: Math.floor(Math.random() * 5) + 1,
      length: Math.floor(Math.random() * 20) + 10,
      date: new Date().toISOString(),
      coordinates: { lat: 35.4676, lng: -97.5164 },
      lure: 'Rubber Worm',
      condition: 'Stable',
      notes: 'Demo catch'
    };
    await LogbookManager.addCatch(newCatch);
    await loadData();
  }

  return (
    <div style={{ padding: '20px', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ 
          background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
          borderRadius: '20px', padding: '20px', border: '1px solid #334155',
          marginBottom: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}
      >
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#22d3ee' }}>🎣 Angler's Logbook</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
          <div style={{ background: 'rgba(255,255,0.05)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Catches</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats?.totalCatches || 0}</div>
          </div>
          <div style={{ background: 'rgba(255,255,0.05)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Top Species</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>{stats?.topSpecies || 'None'}</div>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Recent Catches</h3>
        <button 
          onClick={handleAddQuickCatch}
          style={{ background: '#0891b2', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + Quick Log
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {catches.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>No catches logged yet. Time to hit the water!</div>
        ) : (
          catches.map(c => (
            <motion.div 
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ 
                background: 'rgba(255,255,0.03)', border: '1px solid #334155', 
                borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
              }}
            >
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{c.speciesName}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(c.date).toLocaleDateString()} • {c.lure}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: '#4ade80' }}>{c.weight} lbs</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.length}" length</div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
