import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

export async function POST(req: NextRequest) {
  const openai = getOllama();

  let body: { conditions?: unknown; spot?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { conditions, spot } = body;
  const spotData = (spot && typeof spot === 'object' ? spot : {}) as Record<string, unknown>;
  const conditionData = (conditions && typeof conditions === 'object' ? conditions : {}) as Record<string, unknown>;

  try {
    const response = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `You are a fishing conditions analyst. Given these water/weather conditions at "${spotData.name}", write a 3-sentence plain-English summary for an angler. Be specific, practical, and conversational. Mention what the conditions mean for fish behavior.

Conditions: water_temp=${conditionData.water_temp_c}°C, air_temp=${conditionData.air_temp_c}°C, wind=${conditionData.wind_speed_ms}m/s, pressure=${conditionData.pressure_hpa}hPa, DO=${conditionData.dissolved_oxygen_mgl}mg/L, flow=${conditionData.flow_rate_cfs}cfs, score=${conditionData.fishing_score}/100, water_type=${spotData.water_type}.

Respond with ONLY a JSON object: { "summary": "your 3-sentence summary here", "emoji_rating": "🟢 Excellent" }`
      }]
    });
    const raw = response.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
