'use client';
/* eslint-disable @next/next/no-img-element -- user-selected catch photos may be data URLs and cannot use the image optimizer. */
import { useState, useRef } from 'react';

interface IDResult {
  species: string; scientific_name: string; confidence: number;
  size_estimate: string; weight_estimate: string;
  best_baits: string[]; fun_fact: string; legal_notes: string; is_fish: boolean;
}

export default function FishIdentifier() {
  const [result, setResult] = useState<IDResult | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const identify = async (b64: string) => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/ai/identify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (!data.is_fish) { setError('No fish detected. Try a clearer image.'); return; }
      setResult(data);
    } catch { setError('Identification failed'); }
    finally { setLoading(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const b = ev.target?.result as string; setPreview(b); identify(b); };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', color: 'white' }}>
      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>AI FISH IDENTIFIER</div>
      {!preview && (
        <button onClick={() => fileRef.current?.click()}
          style={{ width: '100%', background: 'linear-gradient(135deg,#0369a1,#7c3aed)', color: 'white', border: 'none', padding: '16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
          Take Photo or Upload
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      {preview && (
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <img src={preview} alt="catch" style={{ width: '100%', borderRadius: '8px', maxHeight: '140px', objectFit: 'cover' }} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#7dd3fc', fontSize: '12px' }}>AI identifying species...</span>
            </div>
          )}
        </div>
      )}
      {error && <p style={{ color: '#f87171', fontSize: '11px', textAlign: 'center' }}>{error}</p>}
      {result && (
        <div style={{ background: '#0f172a', borderRadius: '8px', padding: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22d3ee' }}>{result.species}</div>
          <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginBottom: '6px' }}>{result.scientific_name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
            {result.size_estimate && <div style={{ background: '#1e293b', borderRadius: '5px', padding: '5px' }}><div style={{ fontSize: '8px', color: '#64748b' }}>SIZE</div><div style={{ fontSize: '10px', color: '#e2e8f0' }}>{result.size_estimate}</div></div>}
            {result.weight_estimate && <div style={{ background: '#1e293b', borderRadius: '5px', padding: '5px' }}><div style={{ fontSize: '8px', color: '#64748b' }}>WEIGHT</div><div style={{ fontSize: '10px', color: '#e2e8f0' }}>{result.weight_estimate}</div></div>}
          </div>
          {result.best_baits?.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '3px' }}>BEST BAITS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {result.best_baits.map((b, i) => <span key={i} style={{ background: '#0f3460', color: '#93c5fd', fontSize: '9px', padding: '2px 6px', borderRadius: '10px' }}>{b}</span>)}
              </div>
            </div>
          )}
          {result.fun_fact && <p style={{ fontSize: '10px', color: '#7dd3fc', borderLeft: '3px solid #0ea5e9', paddingLeft: '6px', margin: '0 0 6px' }}>{result.fun_fact}</p>}
          {result.legal_notes && <p style={{ fontSize: '9px', color: '#64748b', margin: 0 }}>{result.legal_notes}</p>}
          <button onClick={() => { setPreview(''); setResult(null); fileRef.current?.click(); }}
            style={{ width: '100%', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '5px', borderRadius: '5px', fontSize: '10px', cursor: 'pointer', marginTop: '8px' }}>
            Identify Another Fish
          </button>
        </div>
      )}
    </div>
  );
}
