import { NextRequest, NextResponse } from 'next/server'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage, parseSpotsContext, type SpotsContext } from '@/lib/fishbotPrompt'
import { getAiModel, getOllama } from '@/lib/ollama'
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security'

export const dynamic = 'force-dynamic'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type RequestBody = {
  message: string
  lat?: number
  lon?: number
  spot?: Record<string, unknown>
  conditions?: Record<string, unknown>
  history?: ChatMessage[]
}

type ProviderContext = SpotsContext & {
  source: string
  data_mode: string
  observed_at?: string
}

function coordinate(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function fetchSpotsContext(lat?: number, lon?: number): Promise<ProviderContext | null> {
  if (lat === undefined || lon === undefined) return null
  try {
    const apiUrl = new URL(process.env.SPOTS_API || 'https://seamcast-spots.vercel.app/api/spots')
    apiUrl.searchParams.set('lat', String(lat))
    apiUrl.searchParams.set('lon', String(lon))
    const res = await fetch(apiUrl, {
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
  } catch (error) {
    console.error('Failed to fetch provider context:', error)
    return null
  }
}

async function callAi(messages: ChatMessage[]): Promise<string> {
  const response = await getOllama().chat.completions.create({
    model: getAiModel(),
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 0.9,
    stream: false,
  })
  const content = response.choices[0]?.message?.content?.trim()
  if (!content) throw new Error('AI provider returned no text')
  return content
}

function unavailableResponse() {
  return NextResponse.json(
    {
      error: 'Fishbot is unavailable; no AI response was generated.',
      source: 'none',
      data_mode: 'unavailable',
      live_data: false,
    },
    { status: 503 },
  )
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'ai-chat', limit: 12, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const bodyResult = await readJsonBody(req, 64_000)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value as RequestBody

  try {
    const { message, lat, lon, spot, history = [] } = body

    if (typeof message !== 'string' || !message.trim() || message.length > 4_000) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((item): item is ChatMessage =>
            Boolean(
              item &&
                (item.role === 'user' || item.role === 'assistant') &&
                typeof item.content === 'string' &&
                item.content.length <= 4_000,
            ),
          )
          .slice(-6)
      : []

    const spotLat = lat ?? coordinate(spot?.lat ?? spot?.latitude)
    const spotLon = lon ?? coordinate(spot?.lon ?? spot?.lng ?? spot?.longitude)
    const spotsData = await fetchSpotsContext(spotLat, spotLon)
    const context = buildContextMessage(spotsData)
    const messages: ChatMessage[] = [
      { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
      { role: 'system', content: context },
      ...safeHistory,
      { role: 'user', content: message },
    ]

    try {
      const reply = await callAi(messages)
      return NextResponse.json({
        reply,
        response: reply,
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
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Fishbot provider error:', error)
      return unavailableResponse()
    }
  } catch (error: unknown) {
    console.error('Fishbot request error:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Invalid Fishbot request.' }, { status: 400 })
  }
}
