import { NextRequest, NextResponse } from 'next/server'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage, parseSpotsContext, type SpotsContext } from '@/lib/fishbotPrompt'
import { getAiModel, getOllama } from '@/lib/ollama'
import { enforceRateLimit, requestBodyTooLarge, tooLarge } from '@/lib/security'

export const dynamic = 'force-dynamic'

type ProviderContext = SpotsContext & {
  source: string
  data_mode: string
  observed_at?: string
}

async function fetchSpotsContext(lat: number, lon: number, species?: string): Promise<ProviderContext | null> {
  try {
    const url = new URL(process.env.SPOTS_API || 'https://seamcast-spots.vercel.app/api/spots')
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lon', lon.toString())
    if (species) url.searchParams.set('species', species)

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null

    const parsed = parseSpotsContext(await res.json())
    if (!parsed) return null

    return {
      ...parsed,
      source: parsed.source ?? parsed.conditions?.source ?? 'seamcast-spots',
      data_mode: parsed.data_mode ?? 'provider',
      observed_at: parsed.observed_at ?? parsed.conditions?.issuedAt,
    }
  } catch {
    return null
  }
}

async function callAi(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const response = await getOllama().chat.completions.create({
    model: getAiModel(),
    messages,
    temperature: 0.7,
    max_tokens: 500,
  })
  const content = response.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('AI provider returned no text')
  return content
}

function unavailableResponse() {
  return NextResponse.json(
    {
      error: 'AI advisor is unavailable; no advice was generated.',
      source: 'none',
      data_mode: 'unavailable',
      live_data: false,
    },
    { status: 503 },
  )
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'ai-advisor', limit: 12, windowMs: 60_000 })
  if (limited) return limited
  if (requestBodyTooLarge(req, 16_384)) return tooLarge()

  try {
    const { lat, lon, targetSpecies } = await req.json()

    if (
      typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180
    ) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 })
    }

    const safeSpecies = typeof targetSpecies === 'string' ? targetSpecies.trim().slice(0, 80) : ''
    const spotsData = await fetchSpotsContext(lat, lon, safeSpecies)
    const context = buildContextMessage(spotsData)

    try {
      const advice = await callAi([
        { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
        { role: 'system', content: context },
        {
          role: 'user',
          content: `Give me a quick fishing strategy for ${safeSpecies || 'the best species'} at this exact spot. Be specific about lures and locations. Do not claim that any supplied value is live unless the context explicitly identifies it as a live observation.`,
        },
      ])

      return NextResponse.json({
        advice,
        source: 'ai',
        data_mode: 'ai-generated',
        live_data: false,
        context: spotsData
          ? {
              source: spotsData.source,
              data_mode: spotsData.data_mode,
              observed_at: spotsData.observed_at,
            }
          : { source: 'none', data_mode: 'unavailable', observed_at: undefined },
        generated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('AI advisor provider error:', error)
      return unavailableResponse()
    }
  } catch (error) {
    console.error('Advisor request error:', error)
    return NextResponse.json({ error: 'Invalid advisor request.' }, { status: 400 })
  }
}
