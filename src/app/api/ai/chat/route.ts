import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { message, spot, conditions, solunar, species } = await req.json();

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
- Spot: ${spot?.name} (${spot?.water_type}, ${spot?.spot_type})
- Water temp: ${conditions?.water_temp_c}°C, Air: ${conditions?.air_temp_c}°C
- Wind: ${conditions?.wind_speed_ms} m/s, Pressure: ${conditions?.pressure_hpa} hPa
- Fishing score: ${conditions?.fishing_score}/100
- Moon: ${solunar?.moonPhaseName}, Solunar score: ${solunar?.solunarScore}/100
- Target species: ${species}
- Time: ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}`
        },
        { role: 'user', content: message }
      ]
    });
    return NextResponse.json({ reply: response.choices[0].message.content });
  } catch(e) {
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
