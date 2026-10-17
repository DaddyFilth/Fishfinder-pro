import { fetchSeamcastSpotSuggestions } from '@/lib/seamcastSpotsClient';
import { getAiProviderName, runBrainPromptCompletion } from '@/ai/brain';
import { NextRequest, NextResponse } from 'next/server';
import { AnalysisSchema, parseModelJson } from '@/lib/aiResponse';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';


function summarizeFeed(feed: Awaited<ReturnType<typeof fetchSeamcastSpotSuggestions>>): string {
  if (!feed) return 'Seamcast-spots feed: unavailable.';
  const species = (feed.speciesLikely ?? []).slice(0, 5).map((s) => s.species).join(', ') || 'none listed';
  const baits = (feed.recommendedBaits ?? []).slice(0, 5).map((b) => b.baitType).filter(Boolean).join(', ') || 'none listed';
  return `Seamcast-spots feed (AI-derived hints, not verified observations): overall bite ${feed.overallBite?.level ?? 'unknown'}; likely species: ${species}; suggested baits: ${baits}.`;
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'ai-analyze', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  const bodyResult = await readJsonBody(req, 16_384)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value as { conditions?: unknown; spot?: unknown; scope?: unknown; radius_miles?: unknown }
  if (!body.conditions || typeof body.conditions !== 'object' || !body.spot || typeof body.spot !== 'object') {
    return NextResponse.json({ error: 'A spot and a condition context are required' }, { status: 400 });
  }

  const scope = body.scope === 'spot' ? 'spot' : 'area';
  const spotData = body.spot as Record<string, unknown>;
  const conditionData = body.conditions as Record<string, unknown>;
  if (conditionData.scope !== scope || (scope === 'area' && conditionData.radius_miles !== 25)) {
    return NextResponse.json({ error: 'Analysis scope does not match its condition context.' }, { status: 400 });
  }
  const inputSource = typeof conditionData.source === 'string' ? conditionData.source : 'caller-supplied context';
  const inputMode = typeof conditionData.data_mode === 'string' ? conditionData.data_mode : 'unspecified';
  const observedAt = typeof conditionData.captured_at === 'string' ? conditionData.captured_at : null;
  const waterTempF = conditionData.water_temp_c != null ? Math.round(Number(conditionData.water_temp_c) * 9 / 5 + 32) : 'unknown';
  const airTempF = conditionData.air_temp_c != null ? Math.round(Number(conditionData.air_temp_c) * 9 / 5 + 32) : 'unknown';

  const spotLat = Number(spotData.lat);
  const spotLng = Number(spotData.lng);
  const feedContext = Number.isFinite(spotLat) && Number.isFinite(spotLng) && Math.abs(spotLat) <= 90 && Math.abs(spotLng) <= 180
    ? summarizeFeed(await fetchSeamcastSpotSuggestions(spotLat, spotLng))
    : 'Seamcast-spots feed: unavailable.';

  try {
    const { text: raw, provider: answeredProvider } = await runBrainPromptCompletion({
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
${feedContext}

Respond with ONLY a JSON object: { "summary": "three-sentence interpretation", "emoji_rating": "a short label" }`,
      }],
    });
    const result = parseModelJson(raw, AnalysisSchema);
    return NextResponse.json({
      ...result,
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: false,
      provider: answeredProvider,
      input: { source: inputSource, data_mode: inputMode, observed_at: observedAt },
      generated_at: new Date().toISOString(),
    });
  } catch {
    const readings: string[] = [];
    const addReading = (value: unknown, label: string, unit: string) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (value === null || value === undefined || value === '' || !Number.isFinite(numeric)) return;
      const rendered = Number.isInteger(numeric) ? String(numeric) : String(Math.round(numeric * 10) / 10);
      readings.push(`${label} ${rendered}${unit}`);
    };

    if (waterTempF !== 'unknown') readings.push(`water ${waterTempF}°F`);
    if (airTempF !== 'unknown') readings.push(`air ${airTempF}°F`);
    addReading(conditionData.wind_speed_ms, 'wind', ' m/s');
    addReading(conditionData.pressure_hpa, 'pressure', ' hPa');
    addReading(conditionData.dissolved_oxygen_mgl, 'dissolved oxygen', ' mg/L');
    addReading(conditionData.flow_rate_cfs, 'flow', ' cfs');
    addReading(conditionData.fishing_score, 'calculated score', '/100');

    const spotName = String(spotData.name ?? 'this location');
    const waterType = String(spotData.water_type ?? 'unspecified water type');
    const scopeLabel = scope === 'spot' ? 'this spot' : 'the 25-mile area around this point';
    const summary = [
      `${spotName} (${waterType}) for ${scopeLabel}: ${readings.length > 0 ? readings.join(', ') : 'no readings were supplied'}.`,
      `Context source: ${inputSource} (mode ${inputMode}${observedAt ? `, captured ${observedAt}` : ''}). ${feedContext}`,
      'No AI model was reachable, so this reports the supplied readings without adding an interpretation; treat them as reported data, not independently verified live values.',
    ].join(' ');

    const score = Number(conditionData.fishing_score);
    const emojiRating = Number.isFinite(score)
      ? score >= 70 ? 'Strong conditions' : score >= 45 ? 'Fair conditions' : 'Slow conditions'
      : 'Data limited';

    return NextResponse.json({
      summary: summary.length > 600 ? `${summary.slice(0, 597)}...` : summary,
      emoji_rating: emojiRating,
      source: 'app-stored',
      data_mode: 'catalog-derived',
      live_data: false,
      provider: getAiProviderName(),
      input: { source: inputSource, data_mode: inputMode, observed_at: observedAt },
      generated_at: new Date().toISOString(),
    });
  }
}
