import { NextRequest, NextResponse } from 'next/server';
import { getAiModel, getOllama } from '@/lib/ollama';
import { BiteTimesSchema, parseModelJson } from '@/lib/aiResponse';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'ai-bite-times', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }
  const bodyResult = await readJsonBody(req, 16_384)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value as {
    species?: unknown; lat?: unknown; lng?: unknown;
    water_temp_c?: unknown; pressure_hpa?: unknown;
    wind_speed_ms?: unknown; dissolved_oxygen_mgl?: unknown;
    solunar_score?: unknown; moon_phase?: unknown;
  }

  const {
    species, lat, lng,
    water_temp_c, pressure_hpa, wind_speed_ms,
    dissolved_oxygen_mgl, solunar_score, moon_phase,
  } = body;

  if (typeof species !== 'string' || !species.trim() || species.length > 80) {
    return NextResponse.json({ error: 'A valid species is required.' }, { status: 400 });
  }

  const latNumber = Number(lat);
  const lngNumber = Number(lng);
  if (!Number.isFinite(latNumber) || latNumber < -90 || latNumber > 90 || !Number.isFinite(lngNumber) || lngNumber < -180 || lngNumber > 180) {
    return NextResponse.json({ error: 'Valid coordinates are required.' }, { status: 400 });
  }

  const now = new Date();
  const localHour = now.getHours();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const season = ['December','January','February'].includes(month) ? 'Winter'
    : ['March','April','May'].includes(month) ? 'Spring'
    : ['June','July','August'].includes(month) ? 'Summer' : 'Fall';

  const prompt = `You are an expert freshwater fishing guide AI with deep knowledge of fish behavior, solunar theory, barometric pressure effects, and seasonal patterns.

Given the supplied conditions for ${species} at coordinates (${latNumber}, ${lngNumber}):
- Season: ${season} (${month})
- Current time: ${localHour}:00
- Water temp: ${water_temp_c != null ? Math.round(Number(water_temp_c) * 9 / 5 + 32) : 'unknown'}°F
- Barometric pressure: ${pressure_hpa ?? 'unknown'} hPa
- Wind speed: ${wind_speed_ms ?? 'unknown'} m/s
- Dissolved oxygen: ${dissolved_oxygen_mgl ?? 'unknown'} mg/L
- Solunar score: ${solunar_score ?? 'unknown'}/100
- Moon phase: ${moon_phase ?? 'unknown'}

Estimate 3 candidate bite time windows for ${species} TODAY. These are optional planning estimates, not guarantees.

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
} Always use Fahrenheit only for every temperature. Never use Celsius or °C.`;

  try {
    const openai = getOllama();
    const res = await openai.chat.completions.create({
      model: getAiModel(),
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.choices[0].message.content ?? '{}';
    return NextResponse.json(parseModelJson(raw, BiteTimesSchema), { status: 200, headers: { 'x-fishfinder-source': 'ai', 'x-fishfinder-data-mode': 'ai-generated', 'x-fishfinder-live-data': 'false' } });
  } catch {
    return NextResponse.json({ error: 'AI bite prediction is unavailable; no prediction was generated.', source: 'none', data_mode: 'unavailable', live_data: false }, { status: 503 });
  }
}
