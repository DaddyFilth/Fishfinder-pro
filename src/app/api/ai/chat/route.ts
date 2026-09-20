import { NextRequest, NextResponse } from 'next/server'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage } from '../../../../lib/fishbotPrompt'

export const dynamic = 'force-dynamic'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type RequestBody = {
  message: string
  lat?: number
  lon?: number
  history?: ChatMessage[]
}

async function fetchSpotsContext(lat?: number, lon?: number) {
  if (!lat || !lon) return null
  try {
    // Call our own spots API internally
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/spots?lat=${lat}&lon=${lon}`, {
      next: { revalidate: 300 } // Cache for 5 mins
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json()
    const { message, lat, lon, history = [] } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Fetch live conditions if coordinates provided
    const spotsData = await fetchSpotsContext(lat, lon)
    const context = buildContextMessage(spotsData)

    // Build messages array for LLM
    const messages: ChatMessage[] = [
      { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
      { role: 'system', content: context },
      ...history.slice(-6), // Keep last 6 messages for context
      { role: 'user', content: message }
    ]

    // Check which AI provider to use (Ollama, OpenAI, etc.)
    const ollamaUrl = process.env.OLLAMA_BASE_URL
    const openaiKey = process.env.OPENAI_API_KEY

    let aiResponse: string

    if (ollamaUrl) {
      // Ollama integration
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1', // or your preferred model
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
        })
      })
      
      if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
      const data = await res.json()
      aiResponse = data.message?.content || "I'm having trouble thinking right now. Try again?"
    } 
    else if (openaiKey) {
      // OpenAI integration
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 300
        })
      })
      
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
      const data = await res.json()
      aiResponse = data.choices?.[0]?.message?.content || "I'm having trouble thinking right now."
    }
    else {
      // Fallback if no AI configured
      aiResponse = `I see you're asking about "${message}". Right now I'm running in offline mode, but based on general Oklahoma patterns: ${spotsData ? `The bite is ${spotsData.overallBite?.level} with a score of ${spotsData.overallBite?.score}. ` : ''}Try ${spotsData?.recommendedBaits?.[0]?.baitType || 'moving baits'} around wind-blown structure. What specific species are you targeting?`
    }

    return NextResponse.json({
      response: aiResponse,
      spotsData: spotsData || undefined,
      timestamp: new Date().toISOString()
    })

  } catch (err: unknown) {
    console.error('Fishbot error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Fishbot is temporarily unavailable', 
        message,
        fallback: "Try asking about specific conditions or locations in Oklahoma."
      },
      { status: 500 }
    )
  }
}
