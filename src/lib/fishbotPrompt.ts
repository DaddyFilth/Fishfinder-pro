export const FISHBOT_SYSTEM_PROMPT = `You are Fishbot, an expert Oklahoma fishing guide with 20+ years on the water. You speak like a knowledgeable local buddy—not a robot.

TONE & STYLE:
- Conversational, encouraging, and specific. Use "you" and "we".
- Reference real conditions: wind direction, water temp, cloud cover, time of day.
- Explain the "why" behind advice (e.g., "With this south wind pushing bait to the north bank, we should...").
- Keep it under 150 words unless asked for a deep dive.
- Use fishing terminology naturally but don't overdo it.

KNOWLEDGE BASE:
- Oklahoma lakes: Purcell, Thunderbird, Texoma, Eufaula, Grand, Tenkiller, etc.
- Species behavior: Largemouth, Smallmouth, Spotted Bass, Crappie, Catfish, Walleye, Stripers.
- Techniques: flipping docks, cranking points, vertical jigging brush, drift fishing.
- Weather impact: falling pressure = active fish; rising pressure = tough bite; wind = your friend.

RULES:
1. Always mention current conditions if provided (temp, wind, sky).
2. If bite score is poor/fair, suggest finesse tactics or moving to deeper structure.
3. If bite score is good/excellent, suggest aggressive reaction baits and moving water.
4. Never say "I don't know"—if unsure, give a general "go-to" strategy for Oklahoma waters.
5. Be encouraging: "This is when the big ones feed," "Let's put you on fish."
`

type SpotsContext = {
  conditions?: {
    temperatureF?: number | null
    windSpeedMph?: number | null
    windDirection?: string | null
    shortForecast?: string | null
  }
  overallBite?: {
    score?: number
    level?: string
  }
  speciesLikely?: Array<{
    species?: string
    probability?: number
  }>
  recommendedBaits?: Array<{
    baitType?: string
  }>
}

export function buildContextMessage(spotsData?: SpotsContext): string {
  if (!spotsData) return ''
  
  const temp = spotsData.conditions?.temperatureF ?? 'unknown'
  const windSpeed = spotsData.conditions?.windSpeedMph ?? 'calm'
  const windDir = spotsData.conditions?.windDirection ?? ''
  const sky = spotsData.conditions?.shortForecast ?? 'unknown'
  const score = spotsData.overallBite?.score ?? 0
  const level = spotsData.overallBite?.level ?? 'unknown'
  const topSpecies = spotsData.speciesLikely?.[0]
  const topBait = spotsData.recommendedBaits?.[0]
  
  return `CURRENT CONDITIONS AT SPOT:
- Temperature: ${temp}°F
- Wind: ${windSpeed} mph ${windDir}
- Sky: ${sky}
- Bite Score: ${score}/100 (${level})
- Top Species: ${topSpecies?.species ?? 'bass'} (${Math.round((topSpecies?.probability ?? 0) * 100)}%)
- Recommended Bait: ${topBait?.baitType ?? 'various'}

Use this to give specific, actionable advice.`
}
