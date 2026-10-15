import { fetchSeamcastResponse } from '@/lib/seamcastSpotsClient';
import { NextRequest, NextResponse } from 'next/server'
import {
  findMentionedSpecies,
  parseSpotsContext,
  type SpotsContext,
} from '@/lib/fishbotPrompt'
import { formatSearchSummary, searchFishingInfo, type WebSearchResult } from '@/lib/webSearch'
import { askBrain, type BrainContext } from '@/ai/brain'
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security'
import { hasVerifiedCurrentConditions } from '@/lib/verifiedConditions'

export const dynamic = 'force-dynamic'

/** Caps how long a DuckDuckGo lookup may delay a chat reply. */
const WEB_SEARCH_BUDGET_MS = 1_500
const WEB_SEARCH_TIMEOUT_MS = 4_000

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
  live?: boolean
  observed_at?: string
}

function coordinate(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function fetchSpotsContext(lat?: number, lon?: number): Promise<ProviderContext | null> {
  if (lat === undefined || lon === undefined) return null
  try {
    const res = await fetchSeamcastResponse(new URLSearchParams({ lat: String(lat), lon: String(lon) }), {
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
  } catch (error) {
    console.error('Failed to fetch provider context:', error)
    return null
  }
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

/**
 * Runs the DuckDuckGo lookup the system prompt promises, but never lets a slow
 * search stall a reply: the race returns null once the budget is spent.
 */
async function researchWithinBudget(message: string): Promise<WebSearchResult | null> {
  const lookup = searchFishingInfo(message, WEB_SEARCH_TIMEOUT_MS)
    .then((result) => result?.result ?? null)
    .catch(() => null)
  const budget = new Promise<null>((resolve) => setTimeout(() => resolve(null), WEB_SEARCH_BUDGET_MS))
  return Promise.race([lookup, budget])
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'ai-chat', limit: 12, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const bodyResult = await readJsonBody(req, 64_000)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value as RequestBody

  try {
    const { message, lat, lon, spot, conditions, history = [] } = body

    if (typeof message !== 'string' || !message.trim() || message.length > 4_000) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((item): item is { role: 'user' | 'assistant'; content: string } =>
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
    const [spotsData, research] = await Promise.all([
      fetchSpotsContext(spotLat, spotLon),
      researchWithinBudget(message),
    ])

    const catalogSpecies = findMentionedSpecies(message)
    const searchSummary = research ? formatSearchSummary(research) : null
    const relatedTopics = (research?.related_topics ?? []).filter(
      (topic): topic is { text: string; url: string | null } => Boolean(topic?.text),
    )
    const webSearch = research && searchSummary
      ? { summary: searchSummary, related: relatedTopics }
      : null
    const usedWebSearch = Boolean(webSearch)

    const context: BrainContext = {
      spot: spot as BrainContext['spot'],
      conditions: conditions ?? null,
      location: { lat: spotLat, lon: spotLon },
      providerContext: spotsData,
      webSearch,
      history: safeHistory,
    }

    try {
      const { text: reply } = await askBrain(message, context, {
        temperature: 0.7,
        maxTokens: 1024,
        topP: 0.9,
      })
      if (!reply) return unavailableResponse()
      return NextResponse.json({
        reply,
        response: reply,
        source: 'ai',
        data_mode: 'ai-generated',
        live_data: spotsData?.live === true,
        used_web_search: usedWebSearch,
        catalog_species: catalogSpecies.map((entry) => entry.name),
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
