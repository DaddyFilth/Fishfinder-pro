import { NextRequest, NextResponse } from 'next/server'
import { FISHBOT_SYSTEM_PROMPT, buildContextMessage } from '../../../../lib/fishbotPrompt'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { lat, lon, targetSpecies } = await req.json()
    
    if (!lat || !lon) {
      return NextResponse.json({ error: 'Coordinates required' }, { status: 400 })
    }

    // Fetch spots data
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const spotsRes = await fetch(`${baseUrl}/api/spots?lat=${lat}&lon=${lon}${targetSpecies ? `&species=${targetSpecies}` : ''}`)
    
    if (!spotsRes.ok) {
      throw new Error('Failed to fetch spots data')
    }
    
    const spotsData = await spotsRes.json()
    const context = buildContextMessage(spotsData)

    // Generate advice using same AI logic as chat
    const prompt = `Give me a quick fishing strategy for ${targetSpecies || 'the best species'} at this spot right now.`

    // Use same AI provider logic (simplified here)
    const ollamaUrl = process.env.OLLAMA_BASE_URL
    let advice = ""

    if (ollamaUrl) {
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1',
          messages: [
            { role: 'system', content: FISHBOT_SYSTEM_PROMPT },
            { role: 'system', content: context },
            { role: 'user', content: prompt }
          ],
          stream: false
        })
      })
      const data = await res.json()
      advice = data.message?.content
    }

    return NextResponse.json({
      advice: advice || `Hit the ${spotsData.microSpots?.[0]?.label || 'windward bank'} with ${spotsData.recommendedBaits?.[0]?.baitType || 'moving baits'}. The ${spotsData.speciesLikely?.[0]?.species || 'bass'} should be active given the ${spotsData.overallBite?.level || 'current'} conditions.`,
      spotsData
    })

  } catch (err) {
    console.error('Advisor error:', err)
    return NextResponse.json({ error: 'Advisor unavailable' }, { status: 500 })
  }
}
