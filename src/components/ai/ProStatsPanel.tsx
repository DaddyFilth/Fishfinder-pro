'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ProStatsProps {
  userId: string;
}

export default function ProStatsPanel({ userId }: ProStatsProps) {
  const [stats, setStats] = useState<{ xp: number; level: number; lifeListCount: number } | null>(null);
  const [activeAlert, setActiveAlert] = useState<any>(null);

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('xp, level, life_list')
        .eq('id', userId)
        .single();

      if (profile) {
        setStats({
          xp: profile.xp || 0,
          level: profile.level || 1,
          lifeListCount: profile.life_list?.length || 0,
        });
      }
    }
    loadStats();

    async function checkAlerts() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: alerts } = await supabase
        .from('realtime_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (alerts && alerts.length > 0) {
        setActiveAlert(alerts[0]);
      }
    }
    checkAlerts();
  }, [userId]);

  if (!stats) return null;

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
      borderRadius: '12px', 
      padding: '12px', 
      border: '1px solid #334155',
      color: 'white',
      marginBottom: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#22d3ee', letterSpacing: '1px' }}>PRO STATUS</span>
        <span style={{ fontSize: '10px', background: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>LVL {stats.level}</span>
      </div>

      {/* XP Progress Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', marginBottom: '4px' }}>
          <span>Experience Points</span>
          <span>{stats.xp} XP</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${(stats.xp % 1000) / 10}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
            transition: 'width 0.5s ease-out'
          }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div style={{ background: '#1e293b', padding: '8px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.lifeListCount}</div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>Species Found</div>
        </div>
        <div style={{ background: '#1e293b', padding: '8px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.level * 100}</div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>Pro Score</div>
        </div>
      </div>

      {/* Real-time Intelligence Alert */}
      {activeAlert && (
        <div style={{ 
          background: '#450a0a', 
          borderLeft: '4px solid #ef4444', 
          padding: '8px', 
          borderRadius: '4px', 
          fontSize: '10px', 
          color: '#fca5a5' 
        }}>
          <strong>⚠️ ALERT:</strong> {activeAlert.message}
        </div>
      )}
    </div>
  );
}
