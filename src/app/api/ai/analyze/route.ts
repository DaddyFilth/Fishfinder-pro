import { getAiModel, getAiProviderName, getOllama } from '@/lib/ollama';
import { NextRequest, NextResponse } from 'next/server';
import { AnalysisSchema, parseModelJson } from '@/lib/aiResponse';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'ai-analyze', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  const bodyResult = await readJsonBody(req, 16_384)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value as { conditions?: unknown; spot?: unknown }
  if (!body.conditions || typeof body.conditions !== 'object' || !body.spot || typeof body.spot !== 'object') {
    return NextResponse.json({ error: 'A spot and a condition context are required' }, { status: 400 });
  }

  const spotData = body.spot as Record<string, unknown>;
  const conditionData = body.conditions as Record<string, unknown>;
  const inputSource = typeof conditionData.source === 'string' ? conditionData.source : 'caller-supplied context';
  const inputMode = typeof conditionData.data_mode === 'string' ? conditionData.data_mode : 'unspecified';
  const observedAt = typeof conditionData.captured_at === 'string' ? conditionData.captured_at : null;
  const waterTempF = conditionData.water_temp_c != null ? Math.round(Number(conditionData.water_temp_c) * 9 / 5 + 32) : 'unknown';
  const airTempF = conditionData.air_temp_c != null ? Math.round(Number(conditionData.air_temp_c) * 9 / 5 + 32) : 'unknown';

  try {
    const response = await getOllama().chat.completions.create({
      model: getAiModel(),
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `You are a fishing conditions analyst. Interpret the supplied context for an angler in three plain-English sentences. This is an AI interpretation, not a measurement or a guarantee. Do not call any input current, live, or verified unless the supplied metadata explicitly says so. If a value is unknown, say it is unavailable.

Input source: ${inputSource}
Input mode: ${inputMode}
Captured at: ${observedAt ?? 'not supplied'}
Spot: ${String(spotData.name ?? 'unspecified')}
Water type: ${String(spotData.water_type ?? 'unspecified')}
Water temperature: ${waterTempF === 'unknown' ? 'unknown' : `${waterTempF}°F`}
Air temperature: ${airTempF === 'unknown' ? 'unknown' : `${airTempF}°F`}
Wind: ${conditionData.wind_speed_ms ?? 'unknown'} m/s
Pressure: ${conditionData.pressure_hpa ?? 'unknown'} hPa
Dissolved oxygen: ${conditionData.dissolved_oxygen_mgl ?? 'unknown'} mg/L
Flow: ${conditionData.flow_rate_cfs ?? 'unknown'} cfs
Calculated score: ${conditionData.fishing_score ?? 'unavailable'}/100

Respond with ONLY a JSON object: { "summary": "three-sentence interpretation", "emoji_rating": "a short label" }`,
      }],
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    const result = parseModelJson(raw, AnalysisSchema);
    return NextResponse.json({
      ...result,
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: false,
      provider: getAiProviderName(),
      input: { source: inputSource, data_mode: inputMode, observed_at: observedAt },
      generated_at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'AI analysis is unavailable; no interpretation was generated.', source: 'none', data_mode: 'unavailable', live_data: false }, { status: 503 });
  }
}
