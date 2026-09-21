import { NextRequest, NextResponse } from 'next/server'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage } from '../../../../lib/fishbotPrompt'
import { enforceRateLimit, requestBodyTooLarge, tooLarge } from '@/lib/security'

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

function coordinate(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function fetchSpotsContext(lat?: number, lon?: number) {
  if (lat === undefined || lon === undefined) return null
  try {
    const configuredApi = process.env.SPOTS_API || 'https://seamcast-spots.vercel.app/api/spots'
    const apiUrl = new URL(configuredApi)
    apiUrl.searchParams.set('lat', String(lat))
    apiUrl.searchParams.set('lon', String(lon))
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error('Failed to fetch spots context:', error)
    return null
  }
}

async function callGroq(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
      stream: false
    }),
  })

  if (!response.ok) {
    console.error('Groq API error:', response.status)
    throw new Error(`Groq API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response from Fishbot'
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'ai-chat', limit: 12, windowMs: 60_000 })
  if (limited) return limited
  if (requestBodyTooLarge(req, 64_000)) return tooLarge()

  try {
    const body: RequestBody = await req.json()
    const { message, lat, lon, spot, conditions, history = [] } = body

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
    const liveContext = spotsData ?? (conditions ? { conditions } : null)
    const context = buildContextMessage(liveContext)

    // Build conversation with system prompt and context
    const messages: ChatMessage[] = [
      { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
      { role: 'system', content: context },
      ...safeHistory, // Keep only bounded user/assistant messages for context
      { role: 'user', content: message }
    ]

    let aiResponse: string

    try {
      aiResponse = await callGroq(messages)
    } catch (groqError) {
      console.error('Groq failed:', groqError)
      
      // Smart fallback using spots data if Groq fails or is not configured
      if (spotsData) {
        const temp = spotsData.conditions?.temperatureF
        const wind = spotsData.conditions?.windSpeedMph
        const sky = spotsData.conditions?.shortForecast
        const score = spotsData.overallBite?.score
        const level = spotsData.overallBite?.level
        const topSpecies = spotsData.speciesLikely?.[0]?.species || 'bass'
        const topBait = spotsData.recommendedBaits?.[0]?.baitType || 'moving baits'
        
        aiResponse = `Right now we're looking at ${temp}°F with ${wind || 'light'} wind and ${sky || 'current'} conditions. The bite is ${level} (${score}/100). For ${topSpecies}, start with ${topBait.toLowerCase()}. Focus on the wind-blown structure I marked on the map. (Note: Running in offline mode - add GROQ_API_KEY for full AI)`
      } else {
        aiResponse = "I need coordinates to give you live conditions, but generally in Oklahoma right now, look for wind-blown points with moving baits if it's cloudy, or slow down with plastics if it's bright and calm."
      }
    }

    return NextResponse.json({
      reply: aiResponse,
      response: aiResponse,
      spotsData: spotsData || undefined,
      timestamp: new Date().toISOString()
    })

  } catch (err: unknown) {
    console.error('Fishbot error:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json(
      { 
        error: 'Fishbot is temporarily unavailable.',
        message: 'Try asking about specific conditions or locations in Oklahoma.',
        fallback: "Try asking about specific conditions or locations in Oklahoma."
      },
      { status: 500 }
    )
  }
}
