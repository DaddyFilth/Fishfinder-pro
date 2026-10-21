'use client';

import { useState } from 'react';

type SourceRow = {
  id: string;
  label: string;
  status: 'ok' | 'empty' | 'unavailable';
  mode: string;
  note: string;
};

type Recommendation = {
  spot_id: string;
  spot_name: string;
  score: number;
  rating: 'Hot' | 'Good' | 'Fair';
  primary_species: string[];
  best_time_today: string;
  best_technique: string;
  recommended_lure: string;
  reason: string;
};

type AnalysisResult = {
  analysis?: { verdict?: string; confidence?: number; reasoning?: string; data_gaps?: string[] };
  recommendations?: Recommendation[];
  data_phase?: 'bootstrap' | 'community';
  data_sufficiency?: { catch_log_total?: number; catch_log_nearby?: number; sufficient?: boolean; note?: string };
  sources?: SourceRow[];
  dropped_recommendations?: number;
  live_data?: boolean;
  conditions?: { status?: string; providers?: string[]; observed_at?: string | null; fishing_score?: number | null };
};

type Props = {
  spot?: { id?: string; name?: string; lat?: number; lng?: number; water_type?: string } | null;
  coordinates?: { latitude: number; longitude: number } | null;
  targetSpecies?: string | null;
};

const statusColor: Record<SourceRow['status'], string> = {
  ok: '#4ade80',
  empty: '#fbbf24',
  unavailable: '#f87171',
};

export default function SmartAnalyticsPanel({ spot, coordinates, targetSpecies: initialTargetSpecies }: Props) {
  const [loading, setLoading] = useState(false);
  const [targetSpecies, setTargetSpecies] = useState(initialTargetSpecies ?? '');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lat = typeof spot?.lat === 'number' ? spot.lat : coordinates?.latitude;
  const lng = typeof spot?.lng === 'number' ? spot.lng : coordinates?.longitude;
  const label = spot?.name ?? (coordinates ? 'Current location' : null);

  const run = async () => {
    if (lat === undefined || lng === undefined) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ai/smart-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          saltwater: spot?.water_type === 'saltwater',
          ...(spot?.name ? { region: spot.name } : {}),
          ...(targetSpecies.trim() ? { targetSpecies: targetSpecies.trim() } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      const body = payload && typeof payload === 'object' ? payload as AnalysisResult & { error?: string } : {};

      if (!response.ok || !body.analysis || !Array.isArray(body.recommendations) || body.recommendations.length === 0) {
        setError(body.error ?? 'AI analysis is unavailable right now; no analysis was generated.');
        return;
      }
      setResult(body);
    } catch {
      setError('AI analysis is unavailable right now; no analysis was generated.');
    } finally {
      setLoading(false);
    }
  };

  if (!label || lat === undefined || lng === undefined) {
    return (
      <section aria-label="Smart analysis" style={styles.card}>
        <div style={styles.title}>Smart analysis</div>
        <div style={styles.muted}>Choose a spot or enable location to run a smart analysis.</div>
      </section>
    );
  }

  const phase = result?.data_phase;
  const confidence = result?.analysis?.confidence;

  return (
    <section aria-label={`Smart analysis for ${label}`} style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.title}>Smart analysis</div>
          <div style={styles.muted}>{label} · provider conditions, stored history, catalog, catch log and research compared by Fishbot</div>
        </div>
        <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
          Target species (optional)
          <input
            value={targetSpecies}
            onChange={(event) => setTargetSpecies(event.target.value)}
            placeholder="e.g. Largemouth Bass"
            style={{ width: '100%', marginTop: 4, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px', color: '#e2e8f0', fontSize: 12, boxSizing: 'border-box' }}
          />
        </label>
        <button type="button" onClick={() => void run()} disabled={loading} style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Analyzing…' : result ? 'Re-run' : 'Run analysis'}
        </button>
      </div>

      {loading && <div style={styles.muted}>Gathering sources and asking Fishbot…</div>}

      {error && (
        <div role="alert" style={{ ...styles.muted, color: '#fbbf24', marginTop: 8 }}>
          {error}
        </div>
      )}

      {result?.analysis && (
        <div style={{ marginTop: 10 }}>
          <div style={styles.badgeRow}>
            <span style={{ ...styles.badge, background: phase === 'community' ? '#14532d' : '#1e3a8a', color: phase === 'community' ? '#4ade80' : '#93c5fd' }}>
              {phase === 'community' ? 'Community catch log' : 'Bootstrap mode'}
            </span>
            {typeof confidence === 'number' && (
              <span style={{ ...styles.badge, background: '#0f172a', color: '#67e8f9' }}>Confidence {confidence}/100</span>
            )}
            <span style={{ ...styles.badge, background: '#0f172a', color: '#cbd5e1' }}>
              {result.live_data ? 'Provider readings fetched this run' : 'No live provider readings this run'}
            </span>
          </div>

          <div style={styles.verdict}>{result.analysis.verdict}</div>
          {result.analysis.reasoning && <div style={styles.body}>{result.analysis.reasoning}</div>}
          {result.data_sufficiency?.note && <div style={styles.muted}>{result.data_sufficiency.note}</div>}

          {Array.isArray(result.analysis.data_gaps) && result.analysis.data_gaps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={styles.subhead}>Data gaps</div>
              <ul style={styles.list}>
                {result.analysis.data_gaps.map((gap, index) => (
                  <li key={`${gap}-${index}`} style={styles.listItem}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <div style={styles.subhead}>Recommendations</div>
            {(result.recommendations ?? []).map((row) => (
              <div key={row.spot_id} style={styles.recRow}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={styles.recName}>{row.spot_name}</div>
                  <div style={{ ...styles.score, color: row.rating === 'Hot' ? '#f87171' : row.rating === 'Good' ? '#4ade80' : '#fbbf24' }}>
                    {row.rating} {row.score}
                  </div>
                </div>
                <div style={styles.muted}>
                  {row.primary_species.join(', ')} · {row.best_time_today}
                </div>
                <div style={styles.body}>{row.reason}</div>
                <div style={styles.muted}>{row.best_technique} · {row.recommended_lure}</div>
              </div>
            ))}
          </div>

          {Array.isArray(result.sources) && result.sources.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={styles.subhead}>Sources used</div>
              {result.sources.map((source) => (
                <div key={source.id} style={styles.sourceRow}>
                  <span style={{ ...styles.dot, background: statusColor[source.status] ?? '#94a3b8' }} aria-hidden="true" />
                  <span style={styles.sourceLabel}>{source.label}</span>
                  <span style={styles.muted}>{source.note}</span>
                </div>
              ))}
            </div>
          )}

          {typeof result.dropped_recommendations === 'number' && result.dropped_recommendations > 0 && (
            <div style={{ ...styles.muted, marginTop: 6 }}>
              {result.dropped_recommendations} suggestion(s) outside the stored catalog were discarded.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0a1724',
    border: '1px solid #234458',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    color: '#e2e8f0',
  },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { color: '#67e8f9', fontSize: 12, fontWeight: 800 },
  subhead: { color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 4 },
  muted: { color: '#78909c', fontSize: 10, lineHeight: 1.5 },
  body: { color: '#cbd5e1', fontSize: 12, lineHeight: 1.5, marginTop: 4 },
  verdict: { color: '#e2e8f0', fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginTop: 8 },
  button: {
    border: '1px solid #0e7490',
    borderRadius: 8,
    background: '#102536',
    color: '#cffafe',
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 700 },
  list: { margin: 0, paddingLeft: 16 },
  listItem: { color: '#cbd5e1', fontSize: 11, lineHeight: 1.5 },
  recRow: { border: '1px solid #1e293b', borderRadius: 10, padding: 8, marginBottom: 6, background: '#0d1a29' },
  recName: { color: '#e2e8f0', fontSize: 12, fontWeight: 700 },
  score: { fontSize: 11, fontWeight: 800 },
  sourceRow: { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3, fontSize: 10 },
  sourceLabel: { color: '#cbd5e1', fontWeight: 700, flexShrink: 0 },
  dot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0, alignSelf: 'center' },
};
