'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';

interface FishIdentifierResult {
  is_fish?: boolean;
  species?: string;
  scientific_name?: string;
  confidence?: number;
  size_estimate?: string;
  weight_estimate?: string;
  best_baits?: string[];
  distinguishing_features?: string[];
  fun_fact?: string;
}

interface CatchAutofillData {
  species?: string;
  weight_lbs?: string;
  length_in?: string;
  bait?: string;
  notes?: string;
}

interface FishIdentifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToCatch?: (data: CatchAutofillData) => void;
}

export default function FishIdentifierModal({ isOpen, onClose, onApplyToCatch }: FishIdentifierModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FishIdentifierResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null);
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent<FileReader>) => {
      const b64 = evt.target?.result as string;
      setImagePreview(b64);
      analyze(b64);
    };
    reader.readAsDataURL(file);
  };

  const analyze = async (b64: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/ai/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: b64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to identify fish');
      if (data.is_fish === false) {
        setError('No fish detected in this photo. Try another angle.');
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to AI model');
    } finally {
      setLoading(false);
    }
  };

  const applyCatch = () => {
    if (!result || !onApplyToCatch) return;
    onApplyToCatch({
      species: result.species || 'Largemouth Bass',
      weight_lbs: result.weight_estimate?.match(/[0-9.]+/)?.[0] || '',
      length_in:  result.size_estimate?.match(/[0-9.]+/)?.[0] || '',
      bait:       result.best_baits?.[0] || '',
      notes: `AI ID: ${result.species} (${Math.round((result.confidence || 0.9) * 100)}%). ${result.fun_fact || ''}`.trim(),
    });
    onClose();
  };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px' }}>
      <div style={{ background:'#0f172a',border:'1px solid #334155',borderRadius:'12px',width:'100%',maxWidth:'440px',maxHeight:'85vh',overflowY:'auto',padding:'16px',color:'white' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px' }}>
          <span style={{ fontWeight:'bold',fontSize:'15px' }}>AI Fish Species Scanner</span>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:'#94a3b8',fontSize:'18px',cursor:'pointer' }}>✕</button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleImage} />

        {!imagePreview && (
          <div onClick={() => fileInputRef.current?.click()} style={{ border:'2px dashed #38bdf8',borderRadius:'8px',padding:'24px 16px',textAlign:'center',cursor:'pointer',background:'#0b1329',marginBottom:'12px' }}>
            <div style={{ fontSize:'32px',marginBottom:'8px' }}>📷</div>
            <div style={{ fontWeight:'bold',color:'#38bdf8' }}>Take Photo or Upload Fish</div>
            <div style={{ fontSize:'11px',color:'#64748b',marginTop:'4px' }}>Instant species ID, weight, & bait advice</div>
          </div>
        )}

        {imagePreview && (
          <img src={imagePreview} alt="preview" style={{ width:'100%',borderRadius:'8px',maxHeight:'180px',objectFit:'cover',marginBottom:'12px' }} />
        )}

        {loading && <div style={{ textAlign:'center',padding:'20px 0',color:'#38bdf8',fontWeight:'bold' }}>⚡ Analyzing fish markings & shape...</div>}
        {error && <div style={{ background:'#450a0a',color:'#fca5a5',padding:'8px 12px',borderRadius:'6px',fontSize:'12px',marginBottom:'12px' }}>{error}</div>}

        {result && (
          <div style={{ background:'#1e293b',borderRadius:'8px',padding:'12px',border:'1px solid #334155' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px' }}>
              <img src={getSpeciesImage(result.species || '')} alt="species" style={{ width:'48px',height:'48px',borderRadius:'8px',objectFit:'cover' }} />
              <div>
                <div style={{ fontWeight:'bold',fontSize:'16px',color:'#38bdf8' }}>{result.species}</div>
                <div style={{ fontSize:'11px',color:'#94a3b8',fontStyle:'italic' }}>{result.scientific_name}</div>
                <div style={{ fontSize:'11px',color:'#64748b' }}>{result.size_estimate} · {result.weight_estimate}</div>
              </div>
            </div>
            {(result.distinguishing_features?.length ?? 0) > 0 && (
              <div style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'3px' }}>FEATURES</div>
                {result.distinguishing_features?.map((f: string, i: number) => (
                  <p key={i} style={{ fontSize:'10px',color:'#94a3b8',margin:'1px 0' }}>• {f}</p>
                ))}
              </div>
            )}
            {(result.best_baits?.length ?? 0) > 0 && (
              <div style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'3px' }}>TOP BAITS</div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:'3px' }}>
                  {result.best_baits?.map((b: string, i: number) => (
                    <span key={i} style={{ background:'#0f3460',color:'#93c5fd',fontSize:'9px',padding:'2px 6px',borderRadius:'10px' }}>{b}</span>
                  ))}
                </div>
              </div>
            )}
            {result.fun_fact && <p style={{ fontSize:'10px',color:'#fbbf24',margin:'0 0 8px',lineHeight:1.4 }}>💡 {result.fun_fact}</p>}
            {onApplyToCatch && (
              <button onClick={applyCatch} style={{ width:'100%',marginTop:'4px',background:'#16a34a',color:'white',border:'none',borderRadius:'6px',padding:'8px',fontWeight:'bold',cursor:'pointer' }}>
                ＋ Auto-Fill Into Catch Logbook
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
