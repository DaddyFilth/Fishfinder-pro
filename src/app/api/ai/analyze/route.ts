import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { conditions, spot } = await req.json();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: `You are a fishing conditions analyst. Given these water/weather conditions at "${spot?.name}", write a 3-sentence plain-English summary for an angler. Be specific, practical, and conversational. Mention what the conditions mean for fish behavior.

Conditions: water_temp=${conditions?.water_temp_c}°C, air_temp=${conditions?.air_temp_c}°C, wind=${conditions?.wind_speed_ms}m/s, pressure=${conditions?.pressure_hpa}hPa, DO=${conditions?.dissolved_oxygen_mgl}mg/L, flow=${conditions?.flow_rate_cfs}cfs, score=${conditions?.fishing_score}/100, water_type=${spot?.water_type}.

Respond with ONLY a JSON object: { "summary": "your 3-sentence summary here", "emoji_rating": "🟢 Excellent" }`
      }]
    });
    const raw = response.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```json
?/g, '').replace(/```
?/g, '').trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch (e) {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
