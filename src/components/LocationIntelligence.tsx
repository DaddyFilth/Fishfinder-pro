'use client';

import { useMemo, useState } from 'react';
import { fetchSpotConditions } from '@/lib/conditionsClient';
import type { Spot } from '@/lib/mapFilters';

type Scope = 'area' | 'spot';
type Tool = 'weather' | 'bite' | 'species' | 'trip' | 'top' | 'settings';

type Props = {
  coordinates?: { latitude: number; longitude: number } | null;
  selectedSpot?: Spot | null;
  activeTool?: Tool;
  onToolSelect?: (tool: Tool) => void;
  compact?: boolean;
};

const tools: Array<{ id: Tool; label: string; icon: string }> = [
  { id: 'weather', label: 'Weather', icon: '☁' },
  { id: 'bite', label: 'Bite time', icon: '◒' },
  { id: 'species', label: 'Species', icon: '◉' },
  { id: 'trip', label: 'AI trip', icon: '✦' },
  { id: 'top', label: 'Top spots', icon: '★' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function LocationIntelligence({ coordinates, selectedSpot, activeTool, onToolSelect, compact = false }: Props) {
  const [scope, setScope] = useState<Scope>(selectedSpot ? 'spot' : 'area');
  const [analysis, setAnalysis] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'unavailable'>('idle');
  const areaSpot = useMemo(() => coordinates ? {
    id: 'device-area-25mi', name: 'Current location · 25 mile area', lat: coordinates.latitude, lng: coordinates.longitude,
    water_type: 'freshwater', spot_type: 'general area',
  } as Spot : null, [coordinates]);
  const contextSpot = scope === 'spot' ? selectedSpot : areaSpot;

  const runAnalysis = async () => {
    if (!contextSpot) return;
    setStatus('loading');
    setAnalysis('');
    try {
      const result = await fetchSpotConditions({ id: contextSpot.id, lat: contextSpot.lat, lng: contextSpot.lng, water_type: contextSpot.water_type });
      if (!result.ok) throw new Error(result.message);
      const response = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope, radius_miles: scope === 'area' ? 25 : 0,
          spot: { id: contextSpot.id, name: contextSpot.name, lat: contextSpot.lat, lng: contextSpot.lng, water_type: contextSpot.water_type },
          conditions: { ...result.data, scope, radius_miles: scope === 'area' ? 25 : 0 },
        }),
      });
      const payload = await response.json() as { summary?: string; error?: string };
      if (!response.ok || !payload.summary) throw new Error(payload.error || 'AI analysis unavailable');
      setAnalysis(payload.summary);
      setStatus('idle');
    } catch {
      setStatus('unavailable');
    }
  };

  if (!contextSpot) {
    return <div style={{ color: '#94a3b8', fontSize: 12, padding: compact ? 8 : 14 }}>Enable device location or choose a spot to load a private 25-mile intelligence view.</div>;
  }

  return (
    <section aria-label={scope === 'area' ? 'Current area intelligence' : `Intelligence for ${contextSpot.name}`} style={{ background: '#0a1724', border: '1px solid #234458', borderRadius: 14, padding: compact ? 10 : 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ color: '#67e8f9', fontSize: 12, fontWeight: 800 }}>{scope === 'area' ? 'CURRENT LOCATION AREA' : 'SELECTED SPOT DASHBOARD'}</div>
          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>{contextSpot.name}</div>
          <div style={{ color: '#78909c', fontSize: 10 }}>{scope === 'area' ? 'Private 25-mile radius · no individual spot data mixed in' : 'Private spot scope · no neighboring spot data mixed in'}</div>
        </div>
        {selectedSpot && <div role="group" aria-label="Intelligence scope" style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => setScope('area')} aria-pressed={scope === 'area'} style={{ ...buttonStyle, background: scope === 'area' ? '#075985' : '#102536' }}>Area</button>
          <button type="button" onClick={() => setScope('spot')} aria-pressed={scope === 'spot'} style={{ ...buttonStyle, background: scope === 'spot' ? '#075985' : '#102536' }}>Spot</button>
        </div>}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0 2px' }}>
        {tools.map((tool) => <button key={tool.id} type="button" onClick={() => onToolSelect?.(tool.id)} aria-label={`${tool.label} for ${scope === 'area' ? 'current area' : contextSpot.name}`} aria-pressed={activeTool === tool.id} style={{ ...miniButtonStyle, borderColor: activeTool === tool.id ? '#22d3ee' : '#244356' }}><span aria-hidden="true">{tool.icon}</span><span>{tool.label}</span></button>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        <div style={{ color: '#94a3b8', fontSize: 10 }}>{analysis || 'AI uses only this scope for weather, bite time, and environmental analysis.'}</div>
        <button type="button" onClick={() => void runAnalysis()} disabled={status === 'loading'} style={{ ...buttonStyle, color: '#cffafe', borderColor: '#0e7490', whiteSpace: 'nowrap' }}>{status === 'loading' ? 'Analyzing…' : 'Run AI'}</button>
      </div>
      {status === 'unavailable' && <div role="alert" style={{ color: '#fbbf24', fontSize: 10, marginTop: 6 }}>AI analysis is unavailable right now; provider data remains separate and unchanged.</div>}
    </section>
  );
}

const buttonStyle: React.CSSProperties = { border: '1px solid #245064', borderRadius: 8, color: '#cbd5e1', background: '#102536', padding: '6px 8px', fontSize: 10, cursor: 'pointer' };
const miniButtonStyle: React.CSSProperties = { ...buttonStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 64, flexShrink: 0, background: '#0d2030' };

 
