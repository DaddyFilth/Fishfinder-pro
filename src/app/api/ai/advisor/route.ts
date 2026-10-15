import { fetchSeamcastResponse } from '@/lib/seamcastSpotsClient';
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseSpotsContext, type SpotsContext } from '@/lib/fishbotPrompt'
import { askBrain, type BrainContext } from '@/ai/brain'
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security'
import { hasVerifiedCurrentConditions } from '@/lib/verifiedConditions'

export const dynamic = 'force-dynamic'

type ProviderContext = SpotsContext & {
  source: string
  data_mode: string
  live?: boolean
  observed_at?: string
}

async function fetchSpotsContext(lat: number, lon: number, species?: string): Promise<ProviderContext | null> {
  try {
    const params = new URLSearchParams({ lat: lat.toString(), lon: lon.toString() })
    if (species) params.set('species', species)

    const res = await fetchSeamcastResponse(params, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res) return null

    const parsed = parseSpotsContext(await res.json())
    if (!parsed) return null

    return {
      ...parsed,
      source: parsed.source ?? parsed.conditions?.source ?? 'seamcast-spots',
      data_mode: parsed.data_mode ?? 'unavailable',
      live: hasVerifiedCurrentConditions(parsed),
      observed_at: parsed.observed_at ?? parsed.conditions?.issuedAt,
    }
  } catch {
    return null
  }
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
  const limited = await enforceRateLimit(req, { name: 'ai-advisor', limit: 12, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const bodyResult = await readJsonBody(req, 16_384)
  if (!bodyResult.ok) return bodyResult.response
  const parsed = z.object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    targetSpecies: z.string().trim().max(80).optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
  }).strict().safeParse(bodyResult.value)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid coordinates or species.' }, { status: 400 })

  const { lat, lon, targetSpecies, conditions } = parsed.data
  const safeSpecies = targetSpecies ?? ''
  const spotsData = await fetchSpotsContext(lat, lon, safeSpecies)

  const context: BrainContext = {
    conditions: conditions ?? null,
    location: { lat, lon },
    providerContext: spotsData,
    species: safeSpecies ? [safeSpecies] : [],
  }

  const question = `Provide general fishing-planning suggestions for ${safeSpecies || 'a plausible local species'} at this location.

  Your response MUST include:
  1. GEAR: Offer a general lure or bait suggestion and explain it is not based on water clarity unless context supplies clarity.
  2. APPROACH: Give a general technique; do not claim unprovided depth, structure, or access details.
  3. CONDITIONS: Describe a bite window only when the context contains relevant current observations. Otherwise state that current conditions are unavailable.
  4. TIP: Give a general species tip, not an insider claim.

  Be concise and explicit about uncertainty. Context may be absent or incomplete. Never invent measurements, observations, recent catches, or spot features. Do not claim any value is live unless the context identifies it as a live observation.`

  try {
    const { text: advice } = await askBrain(question, context, { temperature: 0.7, maxTokens: 500 })
    if (!advice) return unavailableResponse()

    return NextResponse.json({
      advice,
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: spotsData?.live === true,
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
}
