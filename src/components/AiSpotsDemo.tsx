'use client'

import { useEffect, useState } from 'react'
import { getAiSpots, AiSpotsResponse } from '../lib/aiSpots'

export default function AiSpotsDemo() {
  const [data, setData] = useState<AiSpotsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        // Purcell-ish coords; adjust as needed
        const result = await getAiSpots(34.999, -97.366)
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          setError(message)
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p>Loading AI spots…</p>
  }

  if (error) {
    return <p>Error loading AI spots: {error}</p>
  }

  if (!data) {
    return <p>No AI spots data.</p>
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>AI Spots Demo</h2>

      <p>
        Bite score: {data.overallBite.score} ({data.overallBite.level})
      </p>
      <p>
        Conditions: {data.conditions.temperatureF ?? 'N/A'}°F,{' '}
        {data.conditions.windSpeedMph ?? 'N/A'} mph wind,{' '}
        {data.conditions.shortForecast ?? 'Unknown'}
      </p>

      <h3>Top species</h3>
      <ul>
        {data.speciesLikely.slice(0, 3).map((s) => (
          <li key={s.species}>
            {s.species} — {(s.probability * 100).toFixed(0)}%
          </li>
        ))}
      </ul>

      <h3>Recommended baits</h3>
      <ul>
        {data.recommendedBaits.slice(0, 3).map((b, idx) => (
          <li key={idx}>{b.baitType}</li>
        ))}
      </ul>
    </div>
  )
}
