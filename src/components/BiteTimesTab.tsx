'use client';

import { calculateSolunar, hourlyActivityForecast } from '@/lib/scoring/solunar';

type Props = { lat?: number; locationLabel?: string };

function formatHour(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}${suffix}`;
}

function moonEmoji(phase: string) {
  const icons: Record<string, string> = {
    'New Moon': '🌑', 'Waxing Crescent': '🌒', 'First Quarter': '🌓',
    'Waxing Gibbous': '🌔', 'Full Moon': '🌕', 'Waning Gibbous': '🌖',
    'Last Quarter': '🌗', 'Waning Crescent': '🌘',
  };
  return icons[phase] ?? '🌙';
}

function scoreColor(score: number) {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#f97316';
  return '#334155';
}

export default function BiteTimesTab({ lat, locationLabel }: Props) {
  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    return <p style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Select a spot or enable location to calculate solunar periods.</p>;
  }

  const now = new Date();
  const solunar = calculateSolunar(now, lat);
  const hourly = hourlyActivityForecast(solunar);
  const current = hourly[now.getHours()];
  const best = [...hourly].sort((a, b) => b.score - a.score).slice(0, 4);
  const major = best.slice(0, 2);
  const minor = best.slice(2, 4);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#060d1a', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#22d3ee', marginBottom: 4 }}>Bite Times</div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Calculated solunar estimate{locationLabel ? ` · ${locationLabel}` : ''}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 14 }}>Mathematical estimate, not a live reading, catch report, or AI result.</div>

      <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 36 }}>{moonEmoji(solunar.moonPhaseName)}</div><div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>Moon phase</div></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700, marginBottom: 6 }}>Current calculated activity</div>
          <div style={{ background: '#0f172a', borderRadius: 6, height: 8, marginBottom: 4 }}><div style={{ background: '#0ea5e9', height: '100%', borderRadius: 6, width: `${current.score}%` }} /></div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Calculated score: <span style={{ color: '#22d3ee', fontWeight: 700 }}>{current.score}/100</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#0a0f1e', border: '1px solid #22c55e33', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, marginBottom: 8 }}>MAJOR PERIODS</div>
          {major.map((period) => <div key={period.hour} style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>{formatHour(period.hour)}</div>)}
        </div>
        <div style={{ background: '#0a0f1e', border: '1px solid #0ea5e933', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 9, color: '#0ea5e9', fontWeight: 700, marginBottom: 8 }}>MINOR PERIODS</div>
          {minor.map((period) => <div key={period.hour} style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 4 }}>{formatHour(period.hour)}</div>)}
        </div>
      </div>

      <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, marginBottom: 10 }}>24-HOUR CALCULATED ACTIVITY</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
          {hourly.map(({ hour, score }) => <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><div style={{ width: '100%', background: scoreColor(score), borderRadius: '2px 2px 0 0', height: `${Math.max(4, score * 0.54)}px`, border: hour === now.getHours() ? '1px solid white' : 'none', boxSizing: 'border-box' }} />{hour % 6 === 0 && <div style={{ fontSize: 6, color: '#334155' }}>{formatHour(hour)}</div>}</div>)}
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg,#0c1e3a,#0a0f1e)', border: '1px solid #1e4080', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 700, marginBottom: 8 }}>HOW TO USE THIS ESTIMATE</div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>Use these windows as planning context, then verify provider weather, access, regulations, and actual fish behavior before traveling.</div>
      </div>
    </div>
  );
}
