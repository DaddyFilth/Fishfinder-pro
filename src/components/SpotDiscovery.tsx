'use client';

import { useState } from 'react';
import { saveCustomSpot } from '@/lib/spots/customSpots';
import type { Coordinates } from '@/lib/region';

type Candidate = { name: string; lat: number; lng: number; water_type: 'freshwater' | 'saltwater'; spot_type: string; notes: string; source_url: string; source_title: string; distance_miles: number };

export default function SpotDiscovery({ coordinates, onAccepted }: { coordinates: Coordinates | null; onAccepted?: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const search = async () => {
    if (!coordinates) { setMessage('Enable location access to search nearby public spots.'); return; }
    setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/spots/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: coordinates.latitude, lng: coordinates.longitude, radiusMiles: 35 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCandidates(data.candidates ?? []);
      setMessage(data.candidates?.length ? 'Review each source before adding it.' : 'No public spots found nearby.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Search unavailable.'); }
    finally { setLoading(false); }
  };
  const accept = (candidate: Candidate) => {
    saveCustomSpot({ name: candidate.name, lat: candidate.lat, lng: candidate.lng, target_species: '', notes: `${candidate.notes} Source: ${candidate.source_url}`, });
    setCandidates((items) => items.filter((item) => item.name !== candidate.name));
    onAccepted?.();
  };
  return <section style={{ background:'#0a0f1e', border:'1px solid #1e293b', borderRadius:'10px', padding:'14px', marginBottom:'12px' }}>
    <div style={{ display:'flex', justifyContent:'space-between', gap:'10px', alignItems:'flex-start' }}><div><div style={{ color:'#e2e8f0', fontSize:'13px', fontWeight:700 }}>Find local spots</div><div style={{ color:'#64748b', fontSize:'10px', marginTop:'4px' }}>Searches public web sources near your current location.</div></div><button onClick={search} disabled={loading} style={{ background:'#0369a1', border:'1px solid #38bdf8', borderRadius:'7px', color:'#e0f2fe', padding:'7px 10px', cursor:'pointer', fontSize:'11px' }}>{loading ? 'Searching…' : 'Search nearby'}</button></div>
    {message && <div style={{ color:'#94a3b8', fontSize:'11px', marginTop:'10px' }}>{message}</div>}
    <div style={{ display:'grid', gap:'8px', marginTop:'10px' }}>{candidates.map((candidate) => <article key={`${candidate.name}-${candidate.lat}`} style={{ borderTop:'1px solid #1e293b', paddingTop:'9px' }}><div style={{ display:'flex', justifyContent:'space-between', gap:'8px' }}><div><div style={{ color:'#e2e8f0', fontSize:'12px', fontWeight:600 }}>{candidate.name}</div><div style={{ color:'#64748b', fontSize:'10px', marginTop:'3px' }}>{candidate.distance_miles} mi · {candidate.water_type} · {candidate.spot_type}</div></div><button onClick={() => accept(candidate)} style={{ background:'#14532d', border:'1px solid #22c55e', borderRadius:'6px', color:'#bbf7d0', padding:'5px 8px', cursor:'pointer', fontSize:'10px' }}>Add</button></div><div style={{ color:'#94a3b8', fontSize:'10px', lineHeight:1.45, marginTop:'5px' }}>{candidate.notes}</div><a href={candidate.source_url} target='_blank' rel='noreferrer' style={{ color:'#38bdf8', fontSize:'10px' }}>{candidate.source_title}</a></article>)}</div>
  </section>;
}
