'use client';
import { useState } from 'react';
import { calculateSolunar, hourlyActivityForecast } from '@/lib/scoring/solunar';
import { getSpeciesAdvice, AVAILABLE_SPECIES, getSpeciesImage } from '@/lib/scoring/speciesAdvisor';

interface Conditions {
  water_temp_c: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
  dissolved_oxygen_mgl: number | null;
  is_daytime?: boolean;
}

interface Props { lat: number; lng: number; conditions: Conditions; }

interface AIWindow {
  start: string; end: string; quality: string;
  score: number; reason: string; recommended_bait: string; depth: string;
}

interface AIBitePrediction {
  overall_rating: string; overall_score: number;
  summary: string; windows: AIWindow[];
  avoid_times: string; pro_tip: string;
}

const AC = (s: number) => s >= 75 ? '#22c55e' : s >= 50 ? '#eab308' : s >= 30 ? '#f97316' : '#4b5563';
const QC = (q: string) => q === 'Peak' ? '#22c55e' : q === 'Good' ? '#eab308' : '#f97316';

function moonEmoji(phase: string): string {
  const map: Record<string, string> = {
    'New Moon':'🌑','Waxing Crescent':'🌒','First Quarter':'🌓',
    'Waxing Gibbous':'🌔','Full Moon':'🌕','Waning Gibbous':'🌖',
    'Last Quarter':'🌗','Waning Crescent':'🌘',
  };
  return map[phase] ?? '🌙';
}

function PressureCard({ pressure_hpa }: { pressure_hpa: number | null }) {
  const p = pressure_hpa;
  const trend = p === null ? null : p >= 1018 ? 'Rising' : p >= 1008 ? 'Stable' : 'Falling';
  const tColor = trend === 'Rising' ? '#22c55e' : trend === 'Stable' ? '#eab308' : '#ef4444';
  const tip = trend === 'Rising'
    ? 'Pressure rising — fish moving shallow, top-water bite window open'
    : trend === 'Stable'
    ? 'Stable pressure — consistent mid-depth bite, standard presentation'
    : trend === 'Falling'
    ? 'Pressure falling — fish going deep & inactive, slow bottom rigs best'
    : null;
  const pct = p !== null ? Math.min(Math.max(((p - 980) / 60) * 100, 0), 100) : 0;
  return (
    <div style={{ background:'#0f172a',border:`1px solid ${tColor}`,borderRadius:'8px',padding:'10px',marginBottom:'10px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px' }}>
        <span style={{ fontSize:'10px',color:'#64748b',fontWeight:'bold' }}>🔵 BAROMETRIC PRESSURE</span>
        {trend && <span style={{ fontSize:'10px',fontWeight:'bold',color:tColor }}>{trend==='Rising'?'▲':trend==='Falling'?'▼':'▬'} {trend}</span>}
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px' }}>
        <div style={{ flex:1,background:'#1f2937',borderRadius:'4px',height:'8px',overflow:'hidden' }}>
          <div style={{ width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,#2563eb,${tColor})`,borderRadius:'4px',transition:'width .4s' }}/>
        </div>
        <span style={{ fontSize:'12px',fontWeight:'bold',color:tColor,minWidth:'52px',textAlign:'right' }}>
          {p !== null ? `${p.toFixed(0)} hPa` : 'N/A'}
        </span>
      </div>
      <div style={{ display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#475569',marginBottom:'6px' }}>
        <span>980</span><span>1000</span><span>1013</span><span>1030</span><span>1040</span>
      </div>
      {tip && <p style={{ fontSize:'10px',color:'#94a3b8',margin:0,lineHeight:1.4 }}>💡 {tip}</p>}
    </div>
  );
}

export default function BiteTimePanel({ lat, lng, conditions }: Props) {
  const [selectedSpecies, setSelectedSpecies] = useState('Largemouth Bass');
  const [aiPrediction, setAIPrediction] = useState<AIBitePrediction | null>(null);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);

  const now     = new Date();
  const solunar = calculateSolunar(now, lat);
  const hourly  = hourlyActivityForecast(solunar);
  const advice  = getSpeciesAdvice(selectedSpecies, {
    ...conditions,
    solunar_score: solunar.solunarScore,
    is_daytime: conditions.is_daytime ?? (now.getHours() > 6 && now.getHours() < 20),
  });

  const fetchAIPrediction = async (species: string) => {
    setAILoading(true);
    setAIError(null);
    setAIPrediction(null);
    try {
      const res = await fetch('/api/ai/bite-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species, lat, lng,
          water_temp_c: conditions.water_temp_c,
          pressure_hpa: conditions.pressure_hpa,
          wind_speed_ms: conditions.wind_speed_ms,
          dissolved_oxygen_mgl: conditions.dissolved_oxygen_mgl,
          solunar_score: solunar.solunarScore,
          moon_phase: solunar.moonPhaseName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prediction failed');
      setAIPrediction(data);
    } catch (e: unknown) {
      setAIError(e instanceof Error ? e.message : 'AI unavailable');
    } finally {
      setAILoading(false);
    }
  };

  const handleSpeciesChange = (species: string) => {
    setSelectedSpecies(species);
    setAIPrediction(null);
    setAIError(null);
  };

  return (
    <div style={{ background:'#0f172a',borderRadius:'10px',padding:'12px',color:'white',fontFamily:'system-ui,sans-serif' }}>

      {/* Moon + Solunar header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px' }}>
        <div>
          <span style={{ fontSize:'20px' }}>{moonEmoji(solunar.moonPhaseName)}</span>
          <span style={{ fontSize:'12px',color:'#94a3b8',marginLeft:'6px' }}>{solunar.moonPhaseName}</span>
          <span style={{ fontSize:'11px',color:'#64748b',marginLeft:'4px' }}>{solunar.moonIllumination}% lit</span>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'13px',fontWeight:'bold',color:AC(solunar.solunarScore) }}>{solunar.peakActivityLabel}</div>
          <div style={{ fontSize:'10px',color:'#64748b' }}>Solunar Score: {solunar.solunarScore}</div>
        </div>
      </div>

      {/* Major/Minor periods */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'10px' }}>
        {solunar.majorPeriods.map((p, i) => (
          <div key={i} style={{ background:'#1e3a5f',borderRadius:'6px',padding:'6px',borderLeft:'3px solid #0ea5e9' }}>
            <div style={{ fontSize:'9px',color:'#7dd3fc',fontWeight:'bold' }}>MAJOR {i+1}</div>
            <div style={{ fontSize:'11px',color:'white' }}>{p.start} – {p.end}</div>
          </div>
        ))}
        {solunar.minorPeriods.map((p, i) => (
          <div key={i} style={{ background:'#1c2333',borderRadius:'6px',padding:'6px',borderLeft:'3px solid #475569' }}>
            <div style={{ fontSize:'9px',color:'#94a3b8',fontWeight:'bold' }}>MINOR {i+1}</div>
            <div style={{ fontSize:'11px',color:'#cbd5e1' }}>{p.start} – {p.end}</div>
          </div>
        ))}
      </div>

      {/* 24hr activity chart */}
      <div style={{ marginBottom:'10px' }}>
        <div style={{ fontSize:'10px',color:'#64748b',marginBottom:'4px' }}>HOURLY BITE FORECAST</div>
        <div style={{ display:'flex',alignItems:'flex-end',gap:'2px',height:'40px' }}>
          {hourly.map(h => {
            const isCurrent = h.hour === now.getHours();
            return (
              <div key={h.hour} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center' }}>
                <div style={{
                  width:'100%',height:`${Math.max(4,(h.score/100)*36)}px`,
                  background:isCurrent?'#f59e0b':AC(h.score),
                  borderRadius:'2px 2px 0 0',
                  border:isCurrent?'1px solid #fbbf24':'none',
                }} title={`${h.hour}:00 — ${h.label} (${h.score})`} />
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#475569',marginTop:'2px' }}>
          <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
        </div>
      </div>

      {/* Pressure Card */}
      <PressureCard pressure_hpa={conditions.pressure_hpa} />

      {/* Species selector */}
      <div style={{ marginBottom:'8px' }}>
        <div style={{ fontSize:'10px',color:'#64748b',marginBottom:'4px' }}>TARGET SPECIES</div>
        <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
          <img src={getSpeciesImage(selectedSpecies)} alt={selectedSpecies}
            style={{ width:'40px',height:'40px',borderRadius:'6px',objectFit:'cover',border:'1px solid #334155',flexShrink:0 }} />
          <select value={selectedSpecies} onChange={e => handleSpeciesChange(e.target.value)}
            style={{ flex:1,background:'#1e293b',color:'white',border:'1px solid #334155',borderRadius:'6px',padding:'7px 8px',fontSize:'12px' }}>
            {AVAILABLE_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Solunar species advice */}
        <div style={{ background:'#1e293b',borderRadius:'8px',padding:'10px',marginTop:'8px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px' }}>
            <span style={{ fontSize:'12px',fontWeight:'bold',color:'#e2e8f0' }}>{selectedSpecies}</span>
            <span style={{ fontSize:'11px',fontWeight:'bold',color:AC(advice.activityScore) }}>
              {advice.activityLevel.toUpperCase()} ACTIVITY
            </span>
          </div>
          <div style={{ marginBottom:'6px' }}>
            <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'2px' }}>🎣 TOP BAITS</div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:'3px' }}>
              {advice.topBaits.map((b,i) => (
                <span key={i} style={{ background:'#0f3460',color:'#93c5fd',fontSize:'9px',padding:'2px 6px',borderRadius:'10px' }}>{b}</span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:'6px' }}>
            <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'2px' }}>🎯 TECHNIQUE</div>
            <p style={{ fontSize:'10px',color:'#cbd5e1',margin:0,lineHeight:1.4 }}>{advice.technique}</p>
          </div>
          <div style={{ marginBottom:'6px' }}>
            <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'2px' }}>📏 TARGET DEPTH</div>
            <p style={{ fontSize:'10px',color:'#7dd3fc',margin:0 }}>{advice.depthAdvice}</p>
          </div>
          <div>
            <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'2px' }}>📋 WHY</div>
            {advice.reasoning.map((r,i) => (
              <p key={i} style={{ fontSize:'9px',color:'#94a3b8',margin:'1px 0' }}>• {r}</p>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI BITE TIME PREDICTION ── */}
      <div style={{ marginTop:'10px' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px' }}>
          <span style={{ fontSize:'10px',color:'#64748b',fontWeight:'bold' }}>🤖 AI BITE TIME PREDICTION</span>
          {!aiLoading && (
            <button onClick={() => fetchAIPrediction(selectedSpecies)}
              style={{ background:'linear-gradient(135deg,#0369a1,#7c3aed)',color:'white',border:'none',
                padding:'4px 10px',borderRadius:'12px',fontSize:'10px',fontWeight:'bold',cursor:'pointer' }}>
              {aiPrediction ? '↻ Refresh' : '⚡ Predict'}
            </button>
          )}
        </div>

        {aiLoading && (
          <div style={{ background:'#0f172a',borderRadius:'8px',padding:'14px',textAlign:'center' }}>
            <div style={{ fontSize:'18px',marginBottom:'4px' }}>🧠</div>
            <p style={{ color:'#38bdf8',fontSize:'11px',margin:0,fontWeight:'bold' }}>
              AI analyzing {selectedSpecies} bite patterns...
            </p>
          </div>
        )}

        {aiError && !aiLoading && (
          <div style={{ background:'#450a0a',borderRadius:'8px',padding:'10px' }}>
            <p style={{ color:'#fca5a5',fontSize:'10px',margin:0 }}>⚠ {aiError}</p>
          </div>
        )}

        {aiPrediction && !aiLoading && (
          <div style={{ background:'#0f172a',border:'1px solid #1e3a5f',borderRadius:'8px',padding:'10px' }}>

            {/* Overall rating */}
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',
              background:'#1e293b',borderRadius:'6px',padding:'8px' }}>
              <div>
                <div style={{ fontSize:'13px',fontWeight:'bold',color:AC(aiPrediction.overall_score) }}>
                  {aiPrediction.overall_rating}
                </div>
                <div style={{ fontSize:'9px',color:'#64748b' }}>Overall bite forecast</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'22px',fontWeight:'bold',color:AC(aiPrediction.overall_score) }}>
                  {aiPrediction.overall_score}
                </div>
                <div style={{ fontSize:'8px',color:'#475569' }}>AI SCORE</div>
              </div>
            </div>

            <p style={{ fontSize:'10px',color:'#94a3b8',margin:'0 0 8px',lineHeight:1.4 }}>{aiPrediction.summary}</p>

            {/* Bite windows */}
            <div style={{ fontSize:'9px',color:'#64748b',marginBottom:'4px',fontWeight:'bold' }}>📅 TODAY&apos;S BEST WINDOWS</div>
            {aiPrediction.windows?.map((w, i) => (
              <div key={i} style={{ background:'#1e293b',borderRadius:'6px',padding:'8px',marginBottom:'6px',
                borderLeft:`3px solid ${QC(w.quality)}` }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px' }}>
                  <span style={{ fontSize:'12px',fontWeight:'bold',color:'white' }}>⏰ {w.start} – {w.end}</span>
                  <span style={{ fontSize:'10px',fontWeight:'bold',color:QC(w.quality),
                    background:'rgba(0,0,0,0.3)',padding:'2px 6px',borderRadius:'8px' }}>
                    {w.quality} · {w.score}
                  </span>
                </div>
                <p style={{ fontSize:'10px',color:'#94a3b8',margin:'0 0 4px',lineHeight:1.4 }}>{w.reason}</p>
                <div style={{ display:'flex',gap:'8px',flexWrap:'wrap' }}>
                  <span style={{ fontSize:'9px',color:'#4ade80' }}>🎣 {w.recommended_bait}</span>
                  <span style={{ fontSize:'9px',color:'#7dd3fc' }}>📏 {w.depth}</span>
                </div>
              </div>
            ))}

            {/* Avoid times */}
            {aiPrediction.avoid_times && (
              <div style={{ background:'#1c0a0a',borderRadius:'6px',padding:'7px',marginBottom:'6px',
                borderLeft:'3px solid #ef4444' }}>
                <div style={{ fontSize:'9px',color:'#f87171',fontWeight:'bold',marginBottom:'2px' }}>🚫 AVOID</div>
                <p style={{ fontSize:'10px',color:'#fca5a5',margin:0,lineHeight:1.4 }}>{aiPrediction.avoid_times}</p>
              </div>
            )}

            {/* Pro tip */}
            {aiPrediction.pro_tip && (
              <div style={{ background:'#0c2a1a',borderRadius:'6px',padding:'7px',
                borderLeft:'3px solid #22c55e' }}>
                <div style={{ fontSize:'9px',color:'#4ade80',fontWeight:'bold',marginBottom:'2px' }}>💡 PRO TIP</div>
                <p style={{ fontSize:'10px',color:'#86efac',margin:0,lineHeight:1.4 }}>{aiPrediction.pro_tip}</p>
              </div>
            )}
          </div>
        )}

        {!aiPrediction && !aiLoading && !aiError && (
          <div style={{ background:'#0c1929',borderRadius:'8px',padding:'12px',textAlign:'center',border:'1px dashed #1e3a5f' }}>
            <div style={{ fontSize:'20px',marginBottom:'4px' }}>🤖</div>
            <p style={{ color:'#475569',fontSize:'10px',margin:0 }}>
              Tap ⚡ Predict for AI-generated bite windows for {selectedSpecies} based on today&apos;s live conditions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}