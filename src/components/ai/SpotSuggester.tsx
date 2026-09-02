'use client';
/* eslint-disable @next/next/no-img-element -- spot cards use local catalog image assets */
import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';
import { useState, useCallback } from 'react';

interface Spot { id: string; name: string; lat: number; lng: number; water_type: string; spot_type: string; }
interface RankedSpot { spot_name: string; fishing_score: number; miles_away: number | null; primary_species: string[]; best_technique: string; best_time_today: string; reason: string; rating: string; spot_id: string | null; spot_lat: number | null; spot_lng: number | null; }
interface Props { spots: Spot[]; }

const RC = (r: string) => r === 'Hot' ? '#22c55e' : r === 'Good' ? '#eab308' : '#f97316';
const SC = (s: number) => s >= 75 ? '#22c55e' : s >= 50 ? '#eab308' : s >= 30 ? '#f97316' : '#6b7280';

export default function SpotSuggester({ spots }: Props) {
  const [results, setResults] = useState<RankedSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalNearby, setTotalNearby] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const runSuggestion = useCallback(async (lat?: number, lng?: number) => {
    setLoading(true); setError(null); setResults([]);
    try {
      const res = await fetch('/api/ai/suggest-spots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spots, userLat: lat, userLng: lng }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResults(data.results ?? []); setTotalNearby(data.total_nearby ?? null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'AI unavailable'); }
    finally { setLoading(false); }
  }, [spots]);

  const handleFind = () => {
    setLocating(true);
    if (!navigator.geolocation) { setLocating(false); runSuggestion(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setUserLocation(loc); setLocating(false); runSuggestion(loc.lat, loc.lng); },
      () => { setLocating(false); runSuggestion(); },
      { timeout: 6000, maximumAge: 60000 }
    );
  };

  return (
    <div style={{ padding:'16px',color:'white',fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:'16px' }}>
        <div style={{ fontSize:'16px',fontWeight:'bold',color:'#22d3ee',marginBottom:'4px' }}>🎯 AI Spot Finder</div>
        <p style={{ fontSize:'11px',color:'#64748b',margin:0 }}>AI ranks the best fishing spots within 25 miles of you right now</p>
      </div>

      {userLocation && (
        <div style={{ background:'#0c2a1a',border:'1px solid #166534',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px',fontSize:'10px',color:'#4ade80' }}>
          📍 Using your location · {userLocation.lat.toFixed(3)}, {userLocation.lng.toFixed(3)}{totalNearby !== null && ` · ${totalNearby} spots within 25 mi`}
        </div>
      )}

      {!loading && (
        <button onClick={handleFind} disabled={locating}
          style={{ width:'100%',background:'linear-gradient(135deg,#0369a1,#7c3aed)',color:'white',border:'none',padding:'14px',borderRadius:'12px',fontSize:'14px',fontWeight:'bold',cursor:locating?'default':'pointer',marginBottom:'16px',opacity:locating?0.7:1 }}>
          {locating ? '📡 Getting your location...' : results.length > 0 ? '↻ Find Again' : '🎯 Find Best Spots Near Me'}
        </button>
      )}

      {loading && (
        <div style={{ background:'#0f172a',borderRadius:'12px',padding:'24px',textAlign:'center',marginBottom:'16px' }}>
          <div style={{ fontSize:'32px',marginBottom:'8px' }}>🧠</div>
          <p style={{ color:'#38bdf8',fontWeight:'bold',fontSize:'13px',margin:'0 0 4px' }}>AI analyzing nearby spots...</p>
          <p style={{ color:'#475569',fontSize:'11px',margin:0 }}>Checking season, time of day & water type</p>
        </div>
      )}

      {error && !loading && (
        <div style={{ background:'#450a0a',border:'1px solid #7f1d1d',borderRadius:'8px',padding:'12px',marginBottom:'12px' }}>
          <p style={{ color:'#fca5a5',fontSize:'12px',margin:0 }}>⚠ {error}</p>
        </div>
      )}

      {results.length > 0 && !loading && results.map((r, i) => (
        <div key={i} style={{ background:'#0a0f1e',border:`1px solid ${RC(r.rating)}33`,borderRadius:'12px',padding:'12px',marginBottom:'10px',borderLeft:`4px solid ${RC(r.rating)}` }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
              <div style={{ background:RC(r.rating),color:'black',fontWeight:'bold',fontSize:'13px',width:'26px',height:'26px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{i+1}</div>
              <div>
                <div style={{ fontSize:'13px',fontWeight:'bold',color:'#e2e8f0' }}>{r.spot_name}</div>
                {r.miles_away !== null && <div style={{ fontSize:'10px',color:'#64748b' }}>📍 {r.miles_away} miles away</div>}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'20px',fontWeight:'bold',color:SC(r.fishing_score) }}>{r.fishing_score}</div>
              <div style={{ fontSize:'8px',color:RC(r.rating),fontWeight:'bold' }}>{r.rating.toUpperCase()}</div>
            </div>
          </div>
          <p style={{ fontSize:'11px',color:'#94a3b8',margin:'0 0 8px',lineHeight:1.4 }}>{r.reason}</p>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px' }}>
            <div style={{ background:'#0f172a',borderRadius:'6px',padding:'6px' }}>
              <div style={{ fontSize:'8px',color:'#475569',marginBottom:'2px' }}>⏰ BEST WINDOW</div>
              <div style={{ fontSize:'10px',color:'#fbbf24',fontWeight:'bold' }}>{r.best_time_today}</div>
            </div>
            <div style={{ background:'#0f172a',borderRadius:'6px',padding:'6px' }}>
              <div style={{ fontSize:'8px',color:'#475569',marginBottom:'2px' }}>🎣 TECHNIQUE</div>
              <div style={{ fontSize:'9px',color:'#cbd5e1' }}>{r.best_technique}</div>
            </div>
          </div>
          {r.primary_species?.length > 0 && (
            <div style={{ display:'flex',flexWrap:'wrap',gap:'4px' }}>
              {r.primary_species.map((sp, j) => (
                <span key={j} style={{ background:'#0f3460',color:'#93c5fd',fontSize:'9px',padding:'2px 7px',borderRadius:'10px',display:'inline-flex',alignItems:'center',gap:'4px' }}><img src={getSpeciesImage(sp)} alt={sp} style={{width:'14px',height:'14px',objectFit:'cover',borderRadius:'50%'}} /> {sp}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      {results.length === 0 && !loading && !error && (
        <div style={{ background:'#0a0f1e',border:'1px dashed #1e293b',borderRadius:'12px',padding:'24px',textAlign:'center' }}>
          <div style={{ fontSize:'36px',marginBottom:'8px' }}>🗺️</div>
          <p style={{ color:'#475569',fontSize:'12px',margin:0 }}>Tap the button above to find the top fishing spots within 25 miles — ranked by AI using season, time of day, and water type</p>
        </div>
      )}
    </div>
  );
}
