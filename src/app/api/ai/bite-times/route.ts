import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

export async function POST(req: NextRequest) {
  const openai = getOllama();

  let body: {
    species?: unknown; lat?: unknown; lng?: unknown;
    water_temp_c?: unknown; pressure_hpa?: unknown;
    wind_speed_ms?: unknown; dissolved_oxygen_mgl?: unknown;
    solunar_score?: unknown; moon_phase?: unknown;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    species, lat, lng,
    water_temp_c, pressure_hpa, wind_speed_ms,
    dissolved_oxygen_mgl, solunar_score, moon_phase,
  } = body;

  const now = new Date();
  const localHour = now.getHours();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const season = ['December','January','February'].includes(month) ? 'Winter'
    : ['March','April','May'].includes(month) ? 'Spring'
    : ['June','July','August'].includes(month) ? 'Summer' : 'Fall';

  const prompt = `You are an expert freshwater fishing guide AI with deep knowledge of fish behavior, solunar theory, barometric pressure effects, and seasonal patterns.

Given these real-time conditions for ${species} at coordinates (${lat}, ${lng}):
- Season: ${season} (${month})
- Current time: ${localHour}:00
- Water temp: ${water_temp_c ?? 'unknown'}°C
- Barometric pressure: ${pressure_hpa ?? 'unknown'} hPa
- Wind speed: ${wind_speed_ms ?? 'unknown'} m/s
- Dissolved oxygen: ${dissolved_oxygen_mgl ?? 'unknown'} mg/L
- Solunar score: ${solunar_score ?? 'unknown'}/100
- Moon phase: ${moon_phase ?? 'unknown'}

Predict the 3 best bite time windows for ${species} TODAY.

Respond with ONLY valid JSON in this exact format:
{
  "overall_rating": "Excellent|Good|Fair|Slow",
  "overall_score": 82,
  "summary": "One sentence overall bite forecast for today",
  "windows": [
    {
      "start": "06:30",
      "end": "08:00",
      "quality": "Peak|Good|Fair",
      "score": 95,
      "reason": "Why this window is good for this species",
      "recommended_bait": "Best bait for this window",
      "depth": "Target depth range"
    }
  ],
  "avoid_times": "Brief description of times to avoid and why",
  "pro_tip": "One specific actionable tip for ${species} today"
}`;

  try {
    const res = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```jsons*/gi, '').replace(/```s*/g, '').trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: 'AI prediction failed' }, { status: 500 });
  }
}
