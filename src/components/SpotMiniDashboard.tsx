'use client'

import { useEffect, useState } from 'react'
import type { Spot } from '@/lib/mapFilters'

type Props = { spot: Spot }
type Analysis = { spot_id: string; spot_name: string; bite_likelihood: string; confidence: number; summary: string; best_species: Array<{ species: string; reason: string }>; best_bait: string; target_depth: string; bite_window: string; technique: string; evidence: string[]; source?: string; conditions_source?: string; observed_at?: string | null }

const cardStyle = { background: '#0d1c29', border: '1px solid #1d3442', borderRadius: 14, padding: 16 } as const

export default function SpotMiniDashboard({ spot }: Props) {
  const [conditions, setConditions] = useState<Record<string, unknown> | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [loadedSpotId, setLoadedSpotId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      try {
        const query = new URLSearchParams({ lat: String(spot.lat), lng: String(spot.lng) })
        const conditionResponse = await fetch(`/api/spots/${encodeURIComponent(spot.id)}/conditions?${query}`, { cache: 'no-store', signal: controller.signal })
        const conditionPayload: unknown = await conditionResponse.json().catch(() => ({}))
        const conditionData = conditionPayload && typeof conditionPayload === 'object' ? conditionPayload as Record<string, unknown> : {}
        if (!conditionResponse.ok) throw new Error(typeof conditionData.error === 'string' ? conditionData.error : 'Provider conditions unavailable.')
        if (!active) return
        setConditions(conditionData)

        const analysisResponse = await fetch(`/api/ai/spots/${encodeURIComponent(spot.id)}/analysis`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conditions: conditionData }), signal: controller.signal,
        })
        const analysisPayload: unknown = await analysisResponse.json().catch(() => ({}))
        const analysisData = analysisPayload && typeof analysisPayload === 'object' ? analysisPayload as Partial<Analysis> & { error?: string } : {}
        if (!analysisResponse.ok) throw new Error(analysisData.error ?? 'AI analysis unavailable.')
        if (!active || analysisData.spot_id !== spot.id) return
        setAnalysis(analysisData as Analysis)
        setLoadedSpotId(spot.id)
        setStatus('ready')
      } catch (requestError: unknown) {
        if (!active || (requestError instanceof DOMException && requestError.name === 'AbortError')) return
        setError(requestError instanceof Error ? requestError.message : 'Spot analysis unavailable.')
        setLoadedSpotId(spot.id)
        setStatus('unavailable')
      }
    }
    void load()
    return () => { active = false; controller.abort() }
  }, [spot.id, spot.lat, spot.lng])

  const isCurrentSpot = loadedSpotId === spot.id

  return (
    <section aria-labelledby={`spot-dashboard-${spot.id}`} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
      <div style={cardStyle}>
        <p className="seo-page__eyebrow" style={{ marginTop: 0 }}>Spot-specific intelligence</p>
        <h2 id={`spot-dashboard-${spot.id}`} style={{ marginTop: 0 }}>Mini dashboard for {spot.name}</h2>
        {!isCurrentSpot && <p>Loading provider conditions, then generating a spot-scoped analysis…</p>}
        {isCurrentSpot && status === 'unavailable' && <p role="status">{error ?? 'No analysis was generated.'} No cross-spot fallback is shown.</p>}
        {isCurrentSpot && analysis && (
          <>
            <p><strong>{analysis.bite_likelihood.replace('_', ' ')}</strong> · model confidence {analysis.confidence}/100</p>
            <p>{analysis.summary}</p>
            <div className="seo-detail-grid" style={{ margin: 0 }}>
              <div className="seo-panel"><h3>Most likely species</h3>{analysis.best_species.map((item) => <p key={item.species}><strong>{item.species}:</strong> {item.reason}</p>)}</div>
              <div className="seo-panel"><h3>Bait and presentation</h3><p><strong>Bait/lure:</strong> {analysis.best_bait}</p><p><strong>Technique:</strong> {analysis.technique}</p></div>
              <div className="seo-panel"><h3>Window and depth</h3><p><strong>Window:</strong> {analysis.bite_window}</p><p><strong>Target:</strong> {analysis.target_depth}</p></div>
            </div>
            <p className="seo-page__source">Analysis source: {analysis.source ?? 'AI'}; conditions source: {analysis.conditions_source ?? 'not supplied'}{analysis.observed_at ? `; observed ${new Date(analysis.observed_at).toLocaleString()}` : ''}. This is a model estimate, not a live guarantee.</p>
          </>
        )}
        {isCurrentSpot && conditions && !analysis && <p>Provider conditions loaded for this spot. AI analysis is still unavailable.</p>}
      </div>
    </section>
  )
}
