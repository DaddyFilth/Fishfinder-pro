import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type SpotsQuery = {
  lat: number
  lon: number
  species?: string
  time?: string
}

type BiteScore = {
  score: number
  level: 'poor' | 'fair' | 'good' | 'excellent'
  reasons: string[]
}

type SpeciesPrediction = {
  species: string
  probability: number
  notes: string[]
}

type BaitRecommendation = {
  baitType: string
  confidence: number
  conditionsMatch: string[]
}

type MicroSpot = {
  id: string
  label: string
  lat: number
  lon: number
  biteScore: BiteScore
  bestSpecies: SpeciesPrediction[]
  bestBaits: BaitRecommendation[]
  reasoning: string
}

type SpotsResponse = {
  query: SpotsQuery
  conditions: {
    source: 'api.weather.gov'
    issuedAt: string
    temperatureF: number | null
    windSpeedMph: number | null
    windDirection: string | null
    shortForecast: string | null
    detailedForecast: string | null
    isDaytime: boolean | null
  }
  overallBite: BiteScore
  summary: string
  speciesLikely: SpeciesPrediction[]
  recommendedBaits: BaitRecommendation[]
  microSpots: MicroSpot[]
}

interface ForecastPeriod {
  startTime: string
  temperature: number
  windSpeed: string
  windDirection: string
  shortForecast: string
  detailedForecast: string
  isDaytime: boolean
}

function parseQuery(req: NextRequest): SpotsQuery {
  const sp = req.nextUrl.searchParams
  const rawLat = Number(sp.get('lat'))
  const rawLon = Number(sp.get('lon'))
  const species = sp.get('species') || undefined
  const time = sp.get('time') || undefined

  if (Number.isNaN(rawLat) || Number.isNaN(rawLon)) {
    throw new Error('lat and lon are required and must be numbers')
  }

  // Clamp and round to 4 decimals to match Weather.gov constraints
  const lat = Number(Math.min(Math.max(rawLat, -90), 90).toFixed(4))
  const lon = Number(Math.min(Math.max(rawLon, -180), 180).toFixed(4))

  return { lat, lon, species, time }
}

async function fetchWeatherGovPointForecast(lat: number, lon: number) {
  const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`
  const pointsRes = await fetch(pointsUrl, {
    headers: {
      'Accept': 'application/geo+json',
      'User-Agent': 'seamcast/1.0 (spots api; contact: your-email@example.com)',
    },
  })

  if (!pointsRes.ok) {
    console.error('weather.gov points failed', { url: pointsUrl, status: pointsRes.status })
    throw new Error(`weather.gov points error: ${pointsRes.status}`)
  }

  const pointsJson = await pointsRes.json()
  const forecastUrl = pointsJson.properties?.forecast as string | undefined
  if (!forecastUrl) {
    throw new Error('weather.gov points response missing forecast URL')
  }

  const forecastRes = await fetch(forecastUrl, {
    headers: {
      'Accept': 'application/geo+json',
      'User-Agent': 'seamcast/1.0 (spots api; contact: your-email@example.com)',
    },
  })

  if (!forecastRes.ok) {
    throw new Error(`weather.gov forecast error: ${forecastRes.status}`)
  }

  const forecastJson = await forecastRes.json()
  const periods = forecastJson.properties?.periods as ForecastPeriod[] | undefined
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new Error('weather.gov forecast response missing periods')
  }

  const p = periods[0]
  return {
    issuedAt: p.startTime,
    temperatureF: p.temperature,
    windSpeedText: p.windSpeed,
    windDirection: p.windDirection,
    shortForecast: p.shortForecast,
    detailedForecast: p.detailedForecast || '',
    isDaytime: p.isDaytime,
  }
}

function parseWindSpeedMph(windSpeedText: string | null, detailedText: string | null): number | null {
  // Try explicit speed first: "10 mph", "5 to 15 mph"
  if (windSpeedText) {
    const match = windSpeedText.match(/(d+)s*(?:tos*(d+))?s*mph/i)
    if (match) {
      const low = Number(match[1])
      const high = match[2] ? Number(match[2]) : low
      if (!Number.isNaN(low) && !Number.isNaN(high)) return (low + high) / 2
    }
    if (windSpeedText.toLowerCase().includes('calm')) return 0
  }

  // Fallback to detailed forecast text
  if (detailedText) {
    const text = detailedText.toLowerCase()
    if (text.includes('calm')) return 0
    const windMatch = text.match(/winds+(d+)s*(?:tos*(d+))?s*mph/i)
    if (windMatch) {
      const low = Number(windMatch[1])
      const high = windMatch[2] ? Number(windMatch[2]) : low
      return (low + high) / 2
    }
  }
  return null
}

function isNearTwilight(isoTime: string): boolean {
  const date = new Date(isoTime)
  const hour = date.getHours()
  // Dawn: 5-8am, Dusk: 5-8pm
  return (hour >= 5 && hour <= 8) || (hour >= 17 && hour <= 20)
}

function computeBiteScore(
  temperatureF: number | null,
  windSpeedMph: number | null,
  shortForecast: string | null,
  detailedForecast: string | null,
  isDaytime: boolean | null,
  issuedAt: string
): BiteScore {
  let score = 50
  const reasons: string[] = []
  const text = ((shortForecast || '') + ' ' + (detailedForecast || '')).toLowerCase()

  // Temperature
  if (temperatureF != null) {
    if (temperatureF >= 60 && temperatureF <= 80) {
      score += 15
      reasons.push('Ideal warm-water temperature range')
    } else if (temperatureF < 45 || temperatureF > 85) {
      score -= 15
      reasons.push('Suboptimal temperature for active feeding')
    }
  }

  // Wind
  if (windSpeedMph != null) {
    if (windSpeedMph >= 5 && windSpeedMph <= 15) {
      score += 12
      reasons.push('Moderate wind oxygenates water and positions baitfish')
    } else if (windSpeedMph > 20) {
      score -= 10
      reasons.push('High wind makes boat control difficult')
    } else if (windSpeedMph < 3) {
      score -= 5
      reasons.push('Calm, slick conditions often mean tougher bites')
    }
  } else {
    reasons.push('Wind data unclear; assuming neutral conditions')
  }

  // Sky & Pressure indicators from text
  if (text.includes('cloudy') || text.includes('overcast')) {
    score += 10
    reasons.push('Cloud cover extends feeding windows')
  }
  if (text.includes('rain') || text.includes('showers') || text.includes('storms')) {
    score += 8
    reasons.push('Precipitation and falling pressure trigger feeding activity')
  }
  if (text.includes('sunny') || text.includes('clear')) {
    score -= 5
    reasons.push('Bright skies push fish deeper or into shade')
  }
  if (text.includes('front') || text.includes('approaching') || text.includes('falling')) {
    score += 5
    reasons.push('Pre-frontal conditions often create aggressive bites')
  }

  // Time of day
  if (isNearTwilight(issuedAt)) {
    score += 15
    reasons.push('Prime feeding window (dawn/dusk)')
  } else if (isDaytime === false) {
    score += 5
    reasons.push('Nighttime; some species feed heavily after dark')
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))

  let level: BiteScore['level'] = 'fair'
  if (score <= 30) level = 'poor'
  else if (score <= 55) level = 'fair'
  else if (score <= 75) level = 'good'
  else level = 'excellent'

  return { score, level, reasons }
}

function predictSpecies(
  query: SpotsQuery,
  bite: BiteScore,
  temperatureF: number | null
): SpeciesPrediction[] {
  const base: SpeciesPrediction[] = [
    {
      species: 'Largemouth Bass',
      probability: 0.5,
      notes: ['Common warm-water predator', 'Often responds strongly to changing weather fronts'],
    },
    {
      species: 'Crappie',
      probability: 0.3,
      notes: ['Schooling panfish; sensitive to light and temperature changes'],
    },
    {
      species: 'Channel Catfish',
      probability: 0.2,
      notes: ['Opportunistic feeder; can bite through a wide range of conditions'],
    },
  ]

  if (query.species) {
    const target = base.find(s => s.species.toLowerCase().includes(query.species!.toLowerCase()))
    if (target) {
      target.probability = Math.min(0.9, target.probability + 0.25)
      target.notes.push('User-selected target species boosted')
    }
  }

  base.forEach(s => {
    let delta = 0
    if (bite.level === 'excellent') delta += 0.1
    if (bite.level === 'poor') delta -= 0.1

    if (temperatureF != null) {
      if (s.species === 'Crappie' && temperatureF >= 50 && temperatureF <= 70) {
        delta += 0.05
        s.notes.push('Temperature favorable for crappie activity')
      }
      if (s.species === 'Largemouth Bass' && temperatureF >= 60 && temperatureF <= 80) {
        delta += 0.05
        s.notes.push('Temperature favorable for warm-water bass activity')
      }
      if (s.species === 'Channel Catfish' && temperatureF > 70) {
        delta += 0.05
        s.notes.push('Warm water increases catfish metabolism')
      }
    }

    s.probability = Math.max(0.05, Math.min(0.95, s.probability + delta))
  })

  const sum = base.reduce((acc, s) => acc + s.probability, 0)
  if (sum > 0) {
    base.forEach(s => { s.probability = s.probability / sum })
  }

  return base.sort((a, b) => b.probability - a.probability)
}

function recommendBaits(
  species: SpeciesPrediction[],
  bite: BiteScore,
  shortForecast: string | null,
  detailedForecast: string | null,
  windSpeedMph: number | null
): BaitRecommendation[] {
  const text = ((shortForecast || '') + ' ' + (detailedForecast || '')).toLowerCase()
  const recs: BaitRecommendation[] = []
  const aggressive = bite.level === 'good' || bite.level === 'excellent'
  const windy = windSpeedMph != null && windSpeedMph >= 5
  const cloudy = text.includes('cloudy') || text.includes('rain')

  species.forEach(sp => {
    if (sp.species === 'Largemouth Bass') {
      if (aggressive && (cloudy || windy)) {
        recs.push({
          baitType: 'Spinnerbaits, chatterbaits, or swim jigs on wind-blown banks',
          confidence: 0.92,
          conditionsMatch: ['High activity score', 'Wind/cloud creates reaction strike conditions'],
        })
      } else if (aggressive) {
        recs.push({
          baitType: 'Topwater frogs or walking baits in low light',
          confidence: 0.85,
          conditionsMatch: ['High activity', 'Low light or dawn/dusk timing'],
        })
      } else {
        recs.push({
          baitType: 'Finesse worms or jigs dragged slowly through cover',
          confidence: 0.8,
          conditionsMatch: ['Tougher bite', 'Requires slow, bottom-oriented presentation'],
        })
      }
    }
    if (sp.species === 'Crappie') {
      recs.push({
        baitType: 'Small jigs (1/16-1/8 oz) or live minnows under floats near brush',
        confidence: 0.82,
        conditionsMatch: ['Schooling fish near structure', 'Vertical presentation best'],
      })
    }
    if (sp.species === 'Channel Catfish') {
      recs.push({
        baitType: 'Cut shad or stink bait on bottom near channel edges',
        confidence: 0.78,
        conditionsMatch: ['Scent-based feeders', 'Wind-blown banks concentrate bait'],
      })
    }
  })

  return recs.sort((a, b) => b.confidence - a.confidence)
}

function buildMicroSpots(
  query: SpotsQuery,
  bite: BiteScore,
  species: SpeciesPrediction[],
  baits: BaitRecommendation[],
  windDirection: string | null
): MicroSpot[] {
  const baseLat = query.lat
  const baseLon = query.lon
  const wd = (windDirection || '').toUpperCase()

  const spots: MicroSpot[] = [
    {
      id: 'windward-bank',
      label: 'Windward Bank',
      lat: baseLat + 0.001,
      lon: baseLon,
      biteScore: bite,
      bestSpecies: species,
      bestBaits: baits,
      reasoning: 'Wind pushes baitfish here; predators follow',
    },
    {
      id: 'main-point',
      label: 'Main Lake Point',
      lat: baseLat,
      lon: baseLon + 0.001,
      biteScore: bite,
      bestSpecies: species,
      bestBaits: baits,
      reasoning: 'Current break and ambush spot for roaming fish',
    },
    {
      id: 'creek-channel',
      label: 'Creek Channel Edge',
      lat: baseLat - 0.001,
      lon: baseLon,
      biteScore: bite,
      bestSpecies: species,
      bestBaits: baits,
      reasoning: 'Depth change and structure attract bait and predators',
    },
  ]

  // Adjust for wind direction
  if (wd.includes('S') || wd.includes('SE') || wd.includes('SW')) {
    spots[0].label = 'North Shore (Wind-Blown)'
    spots[0].lat = baseLat + 0.0015
    spots[0].reasoning = 'South winds push warm surface water and baitfish to north banks'
  } else if (wd.includes('N') || wd.includes('NE') || wd.includes('NW')) {
    spots[0].label = 'South Shore (Wind-Blown)'
    spots[0].lat = baseLat - 0.0015
    spots[0].reasoning = 'North winds concentrate bait on south-facing structure'
  }

  return spots
}

function generateHumanSummary(
  bite: BiteScore,
  conditions: SpotsResponse['conditions'],
  topSpecies: SpeciesPrediction[],
  topBait: BaitRecommendation
): string {
  const timeStr = conditions.isDaytime ? 'today' : 'tonight'
  const temp = conditions.temperatureF ? `${conditions.temperatureF}°F` : 'moderate temps'
  const sky = conditions.shortForecast?.toLowerCase() || 'current conditions'
  const wind = conditions.windSpeedMph 
    ? `${Math.round(conditions.windSpeedMph)} mph winds` 
    : 'light winds'

  let vibe = ''
  if (bite.level === 'excellent') vibe = 'Excellent conditions—fish should be actively feeding and aggressive.'
  else if (bite.level === 'good') vibe = 'Solid fishing expected with good activity levels.'
  else if (bite.level === 'fair') vibe = 'Fair conditions; fish will bite but require patience and precise presentations.'
  else vibe = 'Tough bite expected. Focus on the best windows and slow down your approach.'

  return `${vibe} Expect ${timeStr}'s bite to center around ${topSpecies[0]?.species || 'gamefish'} given the ${temp} and ${sky}. With ${wind}, focus on ${topBait.baitType.toLowerCase()}. ${bite.reasons[0] ? bite.reasons[0].toLowerCase() : ''}`
}

export async function GET(req: NextRequest) {
  try {
    const query = parseQuery(req)
    const wx = await fetchWeatherGovPointForecast(query.lat, query.lon)

    const windSpeedMph = parseWindSpeedMph(wx.windSpeedText, wx.detailedForecast)
    const bite = computeBiteScore(
      wx.temperatureF,
      windSpeedMph,
      wx.shortForecast,
      wx.detailedForecast,
      wx.isDaytime,
      wx.issuedAt
    )

    const speciesLikely = predictSpecies(query, bite, wx.temperatureF)
    const recommendedBaits = recommendBaits(speciesLikely, bite, wx.shortForecast, wx.detailedForecast, windSpeedMph)
    const microSpots = buildMicroSpots(query, bite, speciesLikely, recommendedBaits, wx.windDirection)

    const conditions = {
      source: 'api.weather.gov' as const,
      issuedAt: wx.issuedAt,
      temperatureF: wx.temperatureF,
      windSpeedMph,
      windDirection: wx.windDirection,
      shortForecast: wx.shortForecast,
      detailedForecast: wx.detailedForecast,
      isDaytime: wx.isDaytime,
    }

    const summary = generateHumanSummary(bite, conditions, speciesLikely, recommendedBaits[0])

    const response: SpotsResponse = {
      query,
      conditions,
      overallBite: bite,
      summary,
      speciesLikely,
      recommendedBaits,
      microSpots,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (err: unknown) {
    console.error('spots api error', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Spots API error', message },
      { status: 400 }
    )
  }
}
