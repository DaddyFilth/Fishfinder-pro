import { NextRequest, NextResponse } from 'next/server'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage } from '../../../../lib/fishbotPrompt'

export const dynamic = 'force-dynamic'

async function fetchSpotsContext(lat: number, lon: number, species?: string) {
  try {
    const url = new URL('https://seamcast-spots.vercel.app/api/spots')
    url.searchParams.set('lat', lat.toString())
    url.searchParams.set('lon', lon.toString())
    if (species) url.searchParams.set('species', species)
    
    const res = await fetch(url.toString(), {
      next: { revalidate: 300 }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function callGroq(messages: Array<{role: string, content: string}>): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  })

  if (!response.ok) throw new Error(`Groq error: ${response.status}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lon, targetSpecies } = await req.json()
    
    if (!lat || !lon) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 })
    }

    const spotsData = await fetchSpotsContext(lat, lon, targetSpecies)
    const context = buildContextMessage(spotsData)

    let advice = ""
    
    try {
      advice = await callGroq([
        { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
        { role: 'system', content: context },
        { role: 'user', content: `Give me a quick fishing strategy for ${targetSpecies || 'the best species'} at this exact spot right now. Be specific about lures and locations.` }
      ])
    } catch {
      // Fallback to spots data summary
      if (spotsData) {
        advice = `Based on current conditions (${spotsData.conditions?.temperatureF}°F, ${spotsData.conditions?.shortForecast}), the ${spotsData.speciesLikely?.[0]?.species || 'fish'} should be biting. Start with ${spotsData.recommendedBaits?.[0]?.baitType || 'standard baits'} at the ${spotsData.microSpots?.[0]?.label || 'marked spots'}.`
      } else {
        advice = "Unable to get current conditions. Check the spots map for general location advice."
      }
    }

    return NextResponse.json({
      advice,
      spotsData
    })

  } catch (err) {
    console.error('Advisor error:', err)
    return NextResponse.json({ error: 'Advisor unavailable' }, { status: 500 })
  }
}
