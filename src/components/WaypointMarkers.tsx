'use client';
import { useState, useCallback } from 'react';
import { useMapEvents, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: 'hotspot' | 'structure' | 'hazard' | 'marina' | 'launch' | 'custom';
  notes: string;
  created_at: string;
}

const WP_ICONS: Record<string, string> = {
  hotspot: '🔥', structure: '🪨', hazard: '⚠️', marina: '⚓', launch: '🚤', custom: '📍',
};
const WP_COLORS: Record<string, string> = {
  hotspot: '#f59e0b', structure: '#8b5cf6', hazard: '#ef4444', marina: '#0ea5e9', launch: '#22c55e', custom: '#94a3b8',
};

function WaypointIcon(type: string) {
  const color = WP_COLORS[type] ?? '#94a3b8';
  const emoji = WP_ICONS[type] ?? '📍';
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:14px">${emoji}</span></div>`,
    iconSize: [32, 32], iconAnchor: [16, 32],
  });
}

export default function WaypointMarkers() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [pending, setPending]     = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm]           = useState({ label: '', type: 'hotspot' as Waypoint['type'], notes: '' });

  useMapEvents({
    dblclick(e) {
      setPending({ lat: e.latlng.lat, lng: e.latlng.lng });
      setForm({ label: '', type: 'hotspot', notes: '' });
    },
  });

  const save = useCallback(() => {
    if (!pending) return;
    const wp: Waypoint = {
      id: crypto.randomUUID(),
      ...pending,
      label: form.label || `Waypoint ${waypoints.length + 1}`,
      type: form.type,
      notes: form.notes,
      created_at: new Date().toISOString(),
    };
    setWaypoints(p => [...p, wp]);
    setPending(null);
  }, [pending, form, waypoints.length]);

  const remove = (id: string) => setWaypoints(p => p.filter(w => w.id !== id));

  return (
    <>
      {/* Double-click placement preview */}
      {pending && (
        <Marker position={[pending.lat, pending.lng]} icon={WaypointIcon(form.type)}>
          <Popup>
            <div style={{ background:'#111827', padding:'10px', borderRadius:'8px', color:'white', fontFamily:'system-ui', minWidth:'200px' }}>
              <strong style={{ color:'#22d3ee', fontSize:'12px' }}>📍 New Waypoint</strong>
              <div style={{ marginTop:'8px', display:'flex', flexDirection:'column', gap:'5px' }}>
                <input value={form.label} onChange={e=>setForm(p=>({...p,label:e.target.value}))} placeholder="Label (e.g. Honey Hole)"
                  style={{ background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px 6px', fontSize:'11px', width:'100%', boxSizing:'border-box' }} />
                <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value as Waypoint['type']}))}
                  style={{ background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px 6px', fontSize:'11px' }}>
                  {Object.keys(WP_ICONS).map(t=><option key={t} value={t}>{WP_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notes..." rows={2}
                  style={{ background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px 6px', fontSize:'11px', resize:'none', boxSizing:'border-box', width:'100%' }} />
                <div style={{ display:'flex', gap:'4px' }}>
                  <button onClick={save} style={{ flex:1, background:'#0369a1', color:'white', border:'none', padding:'5px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight:'bold' }}>✅ Save</button>
                  <button onClick={()=>setPending(null)} style={{ background:'#374151', color:'white', border:'none', padding:'5px 8px', borderRadius:'4px', fontSize:'11px', cursor:'pointer' }}>✕</button>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Saved waypoints */}
      {waypoints.map(wp => (
        <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={WaypointIcon(wp.type)}>
          <Popup>
            <div style={{ background:'#111827', padding:'10px', borderRadius:'8px', color:'white', fontFamily:'system-ui', minWidth:'180px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                <strong style={{ color: WP_COLORS[wp.type], fontSize:'13px' }}>{WP_ICONS[wp.type]} {wp.label}</strong>
                <button onClick={()=>remove(wp.id)} style={{ background:'#7f1d1d', color:'white', border:'none', padding:'2px 6px', borderRadius:'3px', fontSize:'10px', cursor:'pointer' }}>✕</button>
              </div>
              <p style={{ fontSize:'10px', color:'#94a3b8', margin:'0 0 2px', textTransform:'capitalize' }}>{wp.type}</p>
              {wp.notes && <p style={{ fontSize:'10px', color:'#cbd5e1', margin:'4px 0 0' }}>{wp.notes}</p>}
              <p style={{ fontSize:'9px', color:'#374151', margin:'6px 0 0' }}>
                {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}<br />
                {new Date(wp.created_at).toLocaleDateString()}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
