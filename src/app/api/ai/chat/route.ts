import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

function generateFallbackChatResponse(message: string, spotName?: string): string {
  const m = message.toLowerCase();
  const spot = spotName || 'this lake';

  if (m.includes('lure') || m.includes('bait')) {
    return `For ${spot}, stick to 3/8oz spinnerbaits or a green pumpkin chatterbait around weed lines and brush. If the water is murky, try a black and blue jig with a craw trailer.`;
  }
  if (m.includes('depth') || m.includes('deep')) {
    return `During warm sun, fish drop off into 12-18ft of water near creek channels and structure. Early mornings and late evenings, expect active feeding up in 3-6ft shallows.`;
  }
  if (m.includes('bass')) {
    return `Bass at ${spot} are holding close to secondary points and timber. Slow down your presentation with a Texas-rigged Senko or drop shot near drop-offs.`;
  }
  if (m.includes('crappie') || m.includes('catfish')) {
    return `Crappie are stacked over sunken brush piles in 10-15ft on 1/16oz jigs. For catfish, target fresh cut shad or punch bait on slip sinker rigs along the channel edge.`;
  }

  return `Conditions look solid around ${spot}. Work windblown points and shoreline cover with medium-retrieve moving baits first, then slow down with bottom contact jigs if strikes slow down.`;
}

export async function POST(req: NextRequest) {
  let body: { message?: unknown; spot?: unknown; conditions?: unknown; solunar?: unknown; species?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }

  const { message, spot, conditions, solunar, species } = body;

  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  const spotData = (spot && typeof spot === 'object' ? spot : {}) as Record<string, unknown>;
  const spotName = typeof spotData.name === 'string' ? spotData.name : 'this spot';

  try {
    const openai = getOllama();
    const response = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are FishBot, a friendly expert Oklahoma fishing guide with decades of lake experience. Keep answers concise (2-4 sentences max), practical, and specific. Use natural angler terms. Never say you do not know.'
        },
        {
          role: 'user',
          content: `User question: "${message}"Spot: ${spotName} (${spotData.water_type || 'lake'}, ${spotData.spot_type || 'public access'})Target Species: ${species || 'Oklahoma sport fish'}Conditions: ${JSON.stringify(conditions || {})}`
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (reply) {
      return NextResponse.json({ reply });
    }
  } catch {
    // API or network failure; gracefully provide expert advice
  }

  return NextResponse.json({ reply: generateFallbackChatResponse(message, spotName) });
}
