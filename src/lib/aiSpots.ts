export type AiSpotsResponse = {
  query: {
    lat: number
    lon: number
    species?: string
    time?: string
  }
  conditions: {
    source: string
    issuedAt: string
    temperatureF: number | null
    windSpeedMph: number | null
    windDirection: string | null
    shortForecast: string | null
    isDaytime: boolean | null
  }
  overallBite: {
    score: number
    level: 'poor' | 'fair' | 'good' | 'excellent'
    reasons: string[]
  }
  speciesLikely: {
    species: string
    probability: number
    notes: string[]
  }[]
  recommendedBaits: {
    baitType: string
    confidence: number
    conditionsMatch: string[]
  }[]
  microSpots: {
    id: string
    label: string
    lat: number
    lon: number
    biteScore: {
      score: number
      level: 'poor' | 'fair' | 'good' | 'excellent'
      reasons: string[]
    }
    bestSpecies: {
      species: string
      probability: number
      notes: string[]
    }[]
    bestBaits: {
      baitType: string
      confidence: number
      conditionsMatch: string[]
    }[]
  }[]
}

const AI_SPOTS_BASE_URL = 'https://seamcast-spots.vercel.app'

export async function getAiSpots(
  lat: number,
  lon: number,
  species?: string
): Promise<AiSpotsResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  })

  if (species) {
    params.set('species', species)
  }

  const res = await fetch(`${AI_SPOTS_BASE_URL}/api/spots?${params.toString()}`)

  if (!res.ok) {
    throw new Error(`AI spots API error: ${res.status}`)
  }

  return res.json()
}
