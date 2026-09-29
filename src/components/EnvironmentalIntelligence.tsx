import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { EnvironmentManager } from '@/lib/environment/manager';
import { BarometricTrend, SolunarData } from '@/lib/environment/types';

export default function EnvironmentalIntelligence() {
  const [baro, setBaro] = useState<BarometricTrend | null>(null);
  const [solunar, setSolunar] = useState<SolunarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEnvData() {
      setLoading(true);
      try {
        // In a real app, this pressure comes from a weather API
        const currentPressure = 1012.5; 
        const trend = await EnvironmentManager.getBarometricTrend(currentPressure);
        const sol = await EnvironmentManager.getSolunarData(new Date().toISOString().split('T')[0]);
        
        setBaro(trend);
        setSolunar(sol);
      } catch (e) {
        console.error('Env Error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchEnvData();
  }, []);

  if (loading) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Analyzing Atmospheric Trends...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
      {/* Barometric Intelligence */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ 
          background: baro?.impact === 'positive' ? 'linear-gradient(135deg, #064e3b, #065f46)' : 
                  baro?.impact === 'negative' ? 'linear-gradient(135deg, #450a0a, #7f1d1d)' : 
                  'linear-gradient(135deg, #1e293b, #0f172a)', 
          borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)', color: 'white'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>📉 Pressure Analysis</div>
          <div style={{ 
            fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '999px', 
            background: baro?.impact === 'positive' ? '#10b981' : baro?.impact === 'negative' ? '#ef4444' : '#64748b'
          }}>
            {baro?.trend.toUpperCase()}
          </div>
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.5', opacity: 0.9 }}>
          {baro?.advice}
        </div>
      </motion.div>

      {/* Solunar Intelligence */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        style={{ 
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)', 
          borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)', color: 'white'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>🌙 Solunar Window</div>
          <div style={{ fontSize: '12px', color: '#a5b4fc' }}>{solunar?.moonPhase}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ fontSize: '10px', color: '#c7d2fe' }}>MAJOR PERIOD</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{solunar?.majorPeriod.start} - {solunar?.majorPeriod.end}</div>
          </div>
          <div style={{ background: 'rgba(255,255,0.1)', padding: '10px', borderRadius: '12px' }}>
            <div style={{ fontSize: '10px', color: '#c7d2fe' }}>MINOR PERIOD</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{solunar?.minorPeriod.start} - {solunar?.minorPeriod.end}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
