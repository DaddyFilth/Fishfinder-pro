'use client';
import { useState, useRef } from 'react';
import { AVAILABLE_SPECIES } from '@/lib/scoring/speciesAdvisor';

interface CatchEntry {
  id: string;
  species: string;
  weight_lbs: number | null;
  length_in: number | null;
  bait: string;
  notes: string;
  spot_id: string;
  spot_name: string;
  lat: number;
  lng: number;
  caught_at: string;
  photo_url?: string;
}

interface Props { spotId: string; spotName: string; lat: number; lng: number; }

export default function CatchLogger({ spotId, spotName, lat, lng }: Props) {
  const [catches, setCatches]   = useState<CatchEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    species: 'Largemouth Bass', weight_lbs: '', length_in: '',
    bait: '', notes: '', photo_url: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    const entry: CatchEntry = {
      id: crypto.randomUUID(),
      species: form.species,
      weight_lbs: form.weight_lbs ? parseFloat(form.weight_lbs) : null,
      length_in:  form.length_in  ? parseFloat(form.length_in)  : null,
      bait: form.bait,
      notes: form.notes,
      spot_id: spotId,
      spot_name: spotName,
      lat, lng,
      caught_at: new Date().toISOString(),
      photo_url: form.photo_url || undefined,
    };
    try {
      await fetch('/api/catches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      setCatches(p => [entry, ...p]);
      setShowForm(false);
      setForm({ species:'Largemouth Bass', weight_lbs:'', length_in:'', bait:'', notes:'', photo_url:'' });
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, photo_url: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', color:'white' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
        <span style={{ fontSize:'11px', color:'#64748b', fontWeight:'bold' }}>🎣 CATCH LOGBOOK</span>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background:'#0369a1', color:'white', border:'none', padding:'4px 10px', borderRadius:'6px', fontSize:'11px', cursor:'pointer', fontWeight:'bold' }}>
          {showForm ? '✕ Cancel' : '+ Log Catch'}
        </button>
      </div>

      {showForm && (
        <div style={{ background:'#0f172a', borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'6px' }}>
            <div>
              <label style={{ fontSize:'9px', color:'#64748b' }}>SPECIES</label>
              <select value={form.species} onChange={e=>setForm(p=>({...p,species:e.target.value}))}
                style={{ width:'100%', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px', fontSize:'11px' }}>
                {AVAILABLE_SPECIES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'9px', color:'#64748b' }}>BAIT USED</label>
              <input value={form.bait} onChange={e=>setForm(p=>({...p,bait:e.target.value}))} placeholder="e.g. Spinnerbait"
                style={{ width:'100%', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px', fontSize:'11px', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:'9px', color:'#64748b' }}>WEIGHT (lbs)</label>
              <input type="number" value={form.weight_lbs} onChange={e=>setForm(p=>({...p,weight_lbs:e.target.value}))} placeholder="e.g. 4.2"
                style={{ width:'100%', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px', fontSize:'11px', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:'9px', color:'#64748b' }}>LENGTH (in)</label>
              <input type="number" value={form.length_in} onChange={e=>setForm(p=>({...p,length_in:e.target.value}))} placeholder="e.g. 18"
                style={{ width:'100%', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px', fontSize:'11px', boxSizing:'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom:'6px' }}>
            <label style={{ fontSize:'9px', color:'#64748b' }}>NOTES</label>
            <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Depth, structure, weather notes..."
              style={{ width:'100%', background:'#1e293b', color:'white', border:'1px solid #334155', borderRadius:'4px', padding:'4px', fontSize:'11px', resize:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'8px' }}>
            <button onClick={()=>fileRef.current?.click()}
              style={{ background:'#1e293b', color:'#94a3b8', border:'1px solid #334155', padding:'4px 8px', borderRadius:'4px', fontSize:'10px', cursor:'pointer' }}>
              📷 Add Photo
            </button>
            {form.photo_url && <span style={{ fontSize:'9px', color:'#4ade80' }}>✓ Photo added</span>}
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:'none' }} />
          </div>
          {form.photo_url && (
            <img src={form.photo_url} alt="catch" style={{ width:'100%', borderRadius:'6px', maxHeight:'100px', objectFit:'cover', marginBottom:'6px' }} />
          )}
          <button onClick={save} disabled={saving}
            style={{ width:'100%', background: saving?'#1e3a5f':'#0369a1', color:'white', border:'none', padding:'7px', borderRadius:'6px', fontSize:'12px', fontWeight:'bold', cursor: saving?'default':'pointer' }}>
            {saving ? '⏳ Saving...' : '✅ Log This Catch'}
          </button>
        </div>
      )}

      {catches.length === 0 && !showForm && (
        <p style={{ color:'#374151', fontSize:'10px', textAlign:'center', padding:'8px 0' }}>No catches logged yet for this spot</p>
      )}

      {catches.map(c => (
        <div key={c.id} style={{ background:'#0f172a', borderRadius:'6px', padding:'8px', marginBottom:'6px' }}>
          {c.photo_url && <img src={c.photo_url} alt="catch" style={{ width:'100%', borderRadius:'4px', maxHeight:'80px', objectFit:'cover', marginBottom:'6px' }} />}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:'12px', fontWeight:'bold', color:'#22d3ee' }}>{c.species}</div>
              <div style={{ fontSize:'10px', color:'#94a3b8' }}>
                {c.weight_lbs && `${c.weight_lbs} lbs`}{c.length_in && ` · ${c.length_in}"`}{c.bait && ` · ${c.bait}`}
              </div>
              {c.notes && <div style={{ fontSize:'9px', color:'#64748b', marginTop:'2px' }}>{c.notes}</div>}
            </div>
            <div style={{ fontSize:'9px', color:'#374151', textAlign:'right' }}>
              {new Date(c.caught_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
