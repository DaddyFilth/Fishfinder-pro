'use client';
<<<<<<< HEAD
import { getSpeciesImage, AVAILABLE_SPECIES } from '@/lib/scoring/speciesAdvisor';
import { useState, useEffect } from 'react';

interface Spot { id: string; name: string; lat: number; lng: number; water_type: string; spot_type: string; }

interface Catch {
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

export default function CatchesTab({ spots }: { spots: Spot[] }) {
  const [catches, setCatches] = useState<Catch[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [logging, setLogging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    species: 'Largemouth Bass', weight_lbs: '', length_in: '',
    bait: '', notes: '', spot_id: '',
  });

    const loadCatches = () => {
    (async () => {
      setLoadState('loading');
      setErrorMsg('');
      try {
        const res = await fetch('/api/catches', { cache: 'no-store' });
        if (res.status === 503) throw new Error('Database is not configured');
        if (!res.ok) throw new Error(`Failed to load catches (${res.status})`);
        const data = await res.json();
        setCatches(Array.isArray(data) ? data : []);
        setLoadState('ready');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load catches');
        setLoadState('error');
      }
    })();
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState('loading');
      setErrorMsg('');
      try {
        const res = await fetch('/api/catches', { cache: 'no-store' });
        if (res.status === 503) throw new Error('Database is not configured');
        if (!res.ok) throw new Error(`Failed to load catches (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setCatches(Array.isArray(data) ? data : []);
          setLoadState('ready');
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : 'Failed to load catches');
          setLoadState('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);
  async function logCatch() {
    const selectedSpot = spots.find(s => s.id === form.spot_id);
    if (!selectedSpot) { setSaveError('Select a spot'); return; }
    if (!form.weight_lbs) { setSaveError('Enter a weight'); return; }

    setSaving(true);
    setSaveError('');
    const entry: Catch = {
      id: crypto.randomUUID(),
      species: form.species,
      weight_lbs: parseFloat(form.weight_lbs),
      length_in: form.length_in ? parseFloat(form.length_in) : null,
      bait: form.bait,
      notes: form.notes,
      spot_id: selectedSpot.id,
      spot_name: selectedSpot.name,
      lat: selectedSpot.lat,
      lng: selectedSpot.lng,
      caught_at: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/catches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.toString?.() || `Failed to save catch (${res.status})`);
      }
      const saved = await res.json();
      setCatches(prev => [saved, ...prev]);
      setForm({ species: 'Largemouth Bass', weight_lbs: '', length_in: '', bait: '', notes: '', spot_id: '' });
      setLogging(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save catch');
    } finally {
      setSaving(false);
    }
  }

  const totalWeight = catches.reduce((s, c) => s + (c.weight_lbs || 0), 0).toFixed(1);

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#060d1a',position:'relative'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #1e293b'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
          <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee'}}>Catch Log</div>
          <button onClick={()=>{ setSaveError(''); setLogging(true); }} disabled={spots.length===0}
            style={{background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',padding:'6px 14px',borderRadius:'16px',fontSize:'11px',fontWeight:'bold',cursor: spots.length===0?'default':'pointer',opacity: spots.length===0?0.5:1}}>
            + Log Catch
          </button>
=======
/* eslint-disable @next/next/no-img-element -- catch cards use local catalog image assets. */
import { useState } from 'react';
import { SPECIES_BY_NAME, SPECIES_NAMES, type SpeciesName } from '@/lib/speciesCatalog';

interface Catch {
  id: string;
  species: SpeciesName;
  weight: string;
  length: string;
  spot: string;
  date: string;
  notes: string;
}

const DEFAULT_SPECIES: SpeciesName = 'Largemouth Bass';

const SAMPLE: readonly Catch[] = [
  { id: '1', species: 'Largemouth Bass', weight: '4.2', length: '18', spot: 'Lake Fork North', date: '2026-08-25', notes: 'Topwater frog at dawn' },
  { id: '2', species: 'Red Drum', weight: '7.8', length: '24', spot: 'Galveston Bay Flats', date: '2026-08-22', notes: 'Live shrimp on incoming tide' },
  { id: '3', species: 'Black Crappie', weight: '1.1', length: '11', spot: 'Toledo Bend Pier', date: '2026-08-20', notes: 'Small jig under bridge' },
];

interface CatchForm {
  species: SpeciesName;
  weight: string;
  length: string;
  spot: string;
  notes: string;
}

const EMPTY_FORM: CatchForm = { species: DEFAULT_SPECIES, weight: '', length: '', spot: '', notes: '' };

export default function CatchesTab() {
  const [catches, setCatches] = useState<Catch[]>([...SAMPLE]);
  const [logging, setLogging] = useState(false);
  const [form, setForm] = useState<CatchForm>(EMPTY_FORM);

  function logCatch() {
    if (!form.weight || !form.spot) return;

    setCatches((previous) => [{
      id: Date.now().toString(),
      species: form.species,
      weight: form.weight,
      length: form.length,
      spot: form.spot,
      date: new Date().toISOString().split('T')[0],
      notes: form.notes,
    }, ...previous]);
    setForm(EMPTY_FORM);
    setLogging(false);
  }

  const totalWeight = catches.reduce((sum, catchEntry) => sum + parseFloat(catchEntry.weight || '0'), 0).toFixed(1);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#060d1a', position: 'relative' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee' }}>Catch Log</div>
          <button onClick={() => setLogging(true)} style={{ background: 'linear-gradient(135deg,#0369a1,#0ea5e9)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>+ Log Catch</button>
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[{ label: 'CATCHES', value: catches.length }, { label: 'TOTAL LBS', value: totalWeight }, { label: 'SPECIES', value: new Set(catches.map((catchEntry) => catchEntry.species)).size }].map((stat) => (
            <div key={stat.label} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee' }}>{stat.value}</div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
<<<<<<< HEAD

      {logging&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'20px 20px 0 0',padding:'20px',width:'100%',boxSizing:'border-box',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{fontSize:'14px',fontWeight:'bold',color:'#22d3ee',marginBottom:'16px'}}>Log a Catch</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <select value={form.species} onChange={e=>setForm(f=>({...f,species:e.target.value}))} style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'13px'}}>
                {AVAILABLE_SPECIES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.spot_id} onChange={e=>setForm(f=>({...f,spot_id:e.target.value}))} style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color: form.spot_id? '#e2e8f0':'#64748b',fontSize:'13px'}}>
                <option value="">Select a spot...</option>
                {spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <input value={form.weight_lbs} onChange={e=>setForm(f=>({...f,weight_lbs:e.target.value}))} placeholder="Weight (lbs)" type="number" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
                <input value={form.length_in} onChange={e=>setForm(f=>({...f,length_in:e.target.value}))} placeholder="Length (in)" type="number" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
              </div>
              <input value={form.bait} onChange={e=>setForm(f=>({...f,bait:e.target.value}))} placeholder="Bait used" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes (optional)" style={{background:'#0f172a',border:'1px solid #334155',borderRadius:'8px',padding:'10px',color:'#e2e8f0',fontSize:'12px'}}/>
              {saveError&&<div style={{color:'#f87171',fontSize:'11px'}}>{'\u26A0'} {saveError}</div>}
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={logCatch} disabled={saving} style={{flex:1,background:'linear-gradient(135deg,#0369a1,#0ea5e9)',color:'white',border:'none',padding:'12px',borderRadius:'10px',fontSize:'13px',fontWeight:'bold',cursor: saving?'default':'pointer',opacity: saving?0.6:1}}>
                  {saving?'Saving...':'Save Catch'}
                </button>
                <button onClick={()=>setLogging(false)} disabled={saving} style={{flex:1,background:'#0f172a',border:'1px solid #334155',color:'#94a3b8',padding:'12px',borderRadius:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
=======
      {logging && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '16px' }}>Log a Catch</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select aria-label="Catch species" value={form.species} onChange={(event) => setForm((current) => ({ ...current, species: event.target.value as SpeciesName }))} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#e2e8f0', fontSize: '13px' }}>
                {SPECIES_NAMES.map((species) => <option key={species} value={species}>{species}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} placeholder="Weight (lbs)" type="number" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#e2e8f0', fontSize: '12px' }} />
                <input value={form.length} onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))} placeholder="Length (in)" type="number" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#e2e8f0', fontSize: '12px' }} />
              </div>
              <input value={form.spot} onChange={(event) => setForm((current) => ({ ...current, spot: event.target.value }))} placeholder="Spot name" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#e2e8f0', fontSize: '12px' }} />
              <input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes (optional)" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#e2e8f0', fontSize: '12px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={logCatch} style={{ flex: 1, background: 'linear-gradient(135deg,#0369a1,#0ea5e9)', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Save Catch</button>
                <button onClick={() => setLogging(false)} style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: '12px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
              </div>
            </div>
          </div>
        </div>
      )}
<<<<<<< HEAD

      <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        {loadState==='loading'&&(
          <div style={{textAlign:'center',color:'#64748b',fontSize:'12px',padding:'40px 0'}}>Loading catches...</div>
        )}
        {loadState==='error'&&(
          <div style={{textAlign:'center',padding:'40px 0'}}>
            <div style={{color:'#f87171',fontSize:'12px',marginBottom:'10px'}}>{'\u26A0'} {errorMsg}</div>
            <button onClick={loadCatches} style={{background:'#7f1d1d',color:'white',border:'none',padding:'6px 14px',borderRadius:'8px',fontSize:'11px',cursor:'pointer'}}>Retry</button>
          </div>
        )}
        {loadState==='ready'&&catches.length===0&&(
          <div style={{textAlign:'center',color:'#475569',fontSize:'12px',padding:'40px 0'}}>No catches logged yet. Tap + Log Catch to add one.</div>
        )}
        {loadState==='ready'&&catches.map(c=>(
          <div key={c.id} style={{background:'#0a0f1e',border:'1px solid #1e293b',borderRadius:'12px',padding:'12px',display:'flex',gap:'12px',alignItems:'center'}}>
            <img src={getSpeciesImage(c.species)} alt={c.species} style={{width:'40px',height:'40px',objectFit:'cover',borderRadius:'8px'}} />
            <div style={{flex:1}}>
              <div style={{fontSize:'13px',fontWeight:'bold',color:'#e2e8f0'}}>{c.species}</div>
              <div style={{fontSize:'10px',color:'#64748b',marginBottom:'4px'}}>{c.spot_name} {'\u00B7'} {new Date(c.caught_at).toLocaleDateString()}</div>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {c.weight_lbs!==null&&<span style={{background:'#0c4a6e',color:'#7dd3fc',fontSize:'10px',padding:'2px 7px',borderRadius:'8px'}}>{c.weight_lbs} lbs</span>}
                {c.length_in!==null&&<span style={{background:'#1e1b4b',color:'#a5b4fc',fontSize:'10px',padding:'2px 7px',borderRadius:'8px'}}>{c.length_in}&quot;</span>}
                {c.bait&&<span style={{background:'#14532d',color:'#86efac',fontSize:'10px',padding:'2px 7px',borderRadius:'8px'}}>{c.bait}</span>}
=======
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {catches.map((catchEntry) => {
          const species = SPECIES_BY_NAME[catchEntry.species];
          return (
            <div key={catchEntry.id} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '12px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <img src={species.image} alt={species.imageAlt} width={72} height={56} style={{ width: '72px', height: '56px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #1e4080' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>{catchEntry.species}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>{catchEntry.spot} · {catchEntry.date}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ background: '#0c4a6e', color: '#7dd3fc', fontSize: '10px', padding: '2px 7px', borderRadius: '8px' }}>{catchEntry.weight} lbs</span>
                  {catchEntry.length && <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '10px', padding: '2px 7px', borderRadius: '8px' }}>{catchEntry.length}&quot;</span>}
                </div>
                {catchEntry.notes && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>&quot;{catchEntry.notes}&quot;</div>}
>>>>>>> a110a9328e5d62d1fa726120585ff89bc9f61fcd
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
