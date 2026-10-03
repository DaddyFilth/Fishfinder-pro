import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage, parseSpotsContext, type SpotsContext } from '@/lib/fishbotPrompt'
import { getAiModel, getGroqClient } from '@/lib/ollama'
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security'

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
      data_mode: parsed.data_mode ?? 'unavailable',
      observed_at: parsed.observed_at ?? parsed.conditions?.issuedAt,
    }
  } catch {
    return null
  }
}

async function callAi(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const response = await getGroqClient().chat.completions.create({
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
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const bodyResult = await readJsonBody(req, 16_384)
  if (!bodyResult.ok) return bodyResult.response
  const parsed = z.object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    targetSpecies: z.string().trim().max(80).optional(),
  }).strict().safeParse(bodyResult.value)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid coordinates or species.' }, { status: 400 })

  const { lat, lon, targetSpecies } = parsed.data
  const safeSpecies = targetSpecies ?? ''
    const spotsData = await fetchSpotsContext(lat, lon, safeSpecies)
    const context = buildContextMessage(spotsData)

    try {
      const advice = await callAi([
        { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
        { role: 'system', content: context },
        {
          role: 'user',
          content: `You are a Master Fishing Guide. Provide a high-precision fishing strategy for ${safeSpecies || 'the best species'} at this spot. 
          
          Your response MUST include:
          1. GEAR SPECIFICATIONS: Recommend a specific lure/bait, including suggested color (based on water clarity), weight/size, and if possible, a professional brand or style (e.g., 'Zman ChatterBait' or '1/8oz Neon Jig').
          2. TACTICAL APPROACH: Where exactly to cast (e.g., 'along the drop-off', 'near the submerged timber') and the specific retrieval speed.
          3. THE "BITE WINDOW": Analyze the current conditions to tell the user if they are in a prime window, a declining window, or a waiting window.
          4. PRO TIP: One insider secret for this species in these specific weather conditions.
          
          Be concise but authoritative. Do not claim any value is live unless the context identifies it as a live observation.`,
        },
      ])

      return NextResponse.json({
        advice,
        source: 'ai',
        data_mode: 'ai-generated',
        live_data: Boolean(spotsData && spotsData.data_mode === 'provider'),
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
