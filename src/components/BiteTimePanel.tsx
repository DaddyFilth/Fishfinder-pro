'use client';
import { useState } from 'react';
import { calculateSolunar, hourlyActivityForecast } from '@/lib/scoring/solunar';
import { getSpeciesAdvice, AVAILABLE_SPECIES } from '@/lib/scoring/speciesAdvisor';

interface Conditions {
  water_temp_c: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
  dissolved_oxygen_mgl: number | null;
  is_daytime?: boolean;
}

interface Props {
  lat: number;
  lng: number;
  conditions: Conditions;
}

function activityColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 30) return '#f97316';
  return '#4b5563';
}

function moonEmoji(phase: string): string {
  const map: Record<string, string> = {
    'New Moon': '🌑', 'Waxing Crescent': '🌒', 'First Quarter': '🌓',
    'Waxing Gibbous': '🌔', 'Full Moon': '🌕', 'Waning Gibbous': '🌖',
    'Last Quarter': '🌗', 'Waning Crescent': '🌘',
  };
  return map[phase] ?? '🌙';
}

export default function BiteTimePanel({ lat, conditions }: Props) {
  const [selectedSpecies, setSelectedSpecies] = useState('Largemouth Bass');
  const now     = new Date();
  const solunar = calculateSolunar(now, lat);
  const hourly  = hourlyActivityForecast(solunar);
  const advice  = getSpeciesAdvice(selectedSpecies, {
    ...conditions,
    solunar_score: solunar.solunarScore,
    is_daytime: conditions.is_daytime ?? (now.getHours() > 6 && now.getHours() < 20),
  });

  return (
    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '12px', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

      {/* Moon + Solunar header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '20px' }}>{moonEmoji(solunar.moonPhaseName)}</span>
          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>{solunar.moonPhaseName}</span>
          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{solunar.moonIllumination}% lit</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: activityColor(solunar.solunarScore) }}>{solunar.peakActivityLabel}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Solunar Score: {solunar.solunarScore}</div>
        </div>
      </div>

      {/* Major/Minor periods */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        {solunar.majorPeriods.map((p, i) => (
          <div key={i} style={{ background: '#1e3a5f', borderRadius: '6px', padding: '6px', borderLeft: '3px solid #0ea5e9' }}>
            <div style={{ fontSize: '9px', color: '#7dd3fc', fontWeight: 'bold' }}>MAJOR {i + 1}</div>
            <div style={{ fontSize: '11px', color: 'white' }}>{p.start} – {p.end}</div>
          </div>
        ))}
        {solunar.minorPeriods.map((p, i) => (
          <div key={i} style={{ background: '#1c2333', borderRadius: '6px', padding: '6px', borderLeft: '3px solid #475569' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold' }}>MINOR {i + 1}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{p.start} – {p.end}</div>
          </div>
        ))}
      </div>

      {/* 24hr activity chart */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>HOURLY BITE FORECAST</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
          {hourly.map(h => {
            const isCurrent = h.hour === now.getHours();
            return (
              <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%', height: `${Math.max(4, (h.score / 100) * 36)}px`,
                  background: isCurrent ? '#f59e0b' : activityColor(h.score),
                  borderRadius: '2px 2px 0 0',
                  border: isCurrent ? '1px solid #fbbf24' : 'none',
                  transition: 'height 0.3s ease',
                }} title={`${h.hour}:00 — ${h.label} (${h.score})`} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#475569', marginTop: '2px' }}>
          <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
        </div>
      </div>

      {/* Species selector */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>TARGET SPECIES</div>
        <select
          value={selectedSpecies}
          onChange={e => setSelectedSpecies(e.target.value)}
          style={{ width: '100%', background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '6px', padding: '5px 8px', fontSize: '12px' }}
        >
          {AVAILABLE_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Species advice */}
      <div style={{ background: '#1e293b', borderRadius: '8px', padding: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#e2e8f0' }}>{selectedSpecies}</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: activityColor(advice.activityScore) }}>
            {advice.activityLevel.toUpperCase()} ACTIVITY
          </span>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>🎣 TOP BAITS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {advice.topBaits.map((b, i) => (
              <span key={i} style={{ background: '#0f3460', color: '#93c5fd', fontSize: '9px', padding: '2px 6px', borderRadius: '10px' }}>{b}</span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>🎯 TECHNIQUE</div>
          <p style={{ fontSize: '10px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>{advice.technique}</p>
        </div>

        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>📏 TARGET DEPTH</div>
          <p style={{ fontSize: '10px', color: '#7dd3fc', margin: 0 }}>{advice.depthAdvice}</p>
        </div>

        <div>
          <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>📋 WHY</div>
          {advice.reasoning.map((r, i) => (
            <p key={i} style={{ fontSize: '9px', color: '#94a3b8', margin: '1px 0' }}>• {r}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
