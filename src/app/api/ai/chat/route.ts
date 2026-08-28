import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

export async function POST(req: NextRequest) {
  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });

  let body: { message?: unknown; spot?: unknown; conditions?: unknown; solunar?: unknown; species?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { message, spot, conditions, solunar, species } = body;
  const spotData = (spot && typeof spot === 'object' ? spot : {}) as Record<string, unknown>;
  const conditionData = (conditions && typeof conditions === 'object' ? conditions : {}) as Record<string, unknown>;
  const solunarData = (solunar && typeof solunar === 'object' ? solunar : {}) as Record<string, unknown>;
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) {
    return NextResponse.json({ error: 'Message must be 1-2000 characters' }, { status: 400 });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `You are FishBot, a friendly expert AI fishing guide. Keep answers concise (2-3 sentences max), practical, and specific to the provided conditions. Never say "I don't know" — always give your best recommendation. Use fishing slang naturally.

Current context:
- Spot: ${spotData.name} (${spotData.water_type}, ${spotData.spot_type})
- Water temp: ${conditionData.water_temp_c}°C, Air: ${conditionData.air_temp_c}°C
- Wind: ${conditionData.wind_speed_ms} m/s, Pressure: ${conditionData.pressure_hpa} hPa
- Fishing score: ${conditionData.fishing_score}/100
- Moon: ${solunarData.moonPhaseName}, Solunar score: ${solunarData.solunarScore}/100
- Target species: ${species}
- Time: ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`
        },
        { role: 'user', content: message }
      ]
    });
    return NextResponse.json({ reply: response.choices[0].message.content });
  } catch {
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
