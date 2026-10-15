import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';
import { runBrainPrompt } from '@/ai/brain';
import { SmartAnalysisSchema, parseModelJson } from '@/lib/aiResponse';
import { analyzeSpotsSmart } from '@/lib/aiAnalytics';
import {
  buildAnalysisPrompt,
  gatherSmartAnalyticsSources,
  type SmartAnalyticsSources,
} from '@/lib/smartAnalytics';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthContext } from '@/lib/auth/server';
import { hasVerifiedCurrentConditions } from '@/lib/verifiedConditions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RequestSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  targetSpecies: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  saltwater: z.boolean().optional(),
}).strict();

type BaselineRow = {
  spot_id: string;
  spot_name: string;
  score: number;
  species: string;
  reason: string;
};

function toFahrenheit(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round((value * 9) / 5 + 32)
    : null;
}

/** Local, non-AI catalog scoring handed to the model as a comparison baseline. */
async function buildBaseline(input: {
  lat: number;
  lng: number;
  targetSpecies?: string;
  sources: SmartAnalyticsSources;
}): Promise<BaselineRow[]> {
  const { provider } = input.sources;
  const result = await analyzeSpotsSmart({
    userLat: input.lat,
    userLng: input.lng,
    targetSpecies: input.targetSpecies,
    conditions: provider.status === 'ok'
      ? {
          waterTempC: null,
          waterTempF: toFahrenheit(provider.sea_surface_temp_f),
          airTempC: null,
          airTempF: provider.air_temp_f,
          windSpeedMs: null,
          windSpeedMph: provider.wind_speed_mph,
          windDirection: provider.wind_direction,
          dissolvedOxygenMgl: null,
          fishingScore: provider.fishing_score,
          condition: 'stable',
        }
      : undefined,
  });

  return result.analyzedSpots.slice(0, 8).map((analysis) => ({
    spot_id: analysis.spot.id,
    spot_name: analysis.spot.name,
    score: analysis.suitabilityScore,
    species: analysis.recommendedSpecies[0]?.name ?? 'unknown',
    reason: analysis.reason,
  }));
}

function unavailable(message: string, sources?: SmartAnalyticsSources) {
  return NextResponse.json(
    {
      error: message,
      source: 'none',
      data_mode: 'unavailable',
      live_data: false,
      ...(sources ? { data_phase: sources.data_phase, sources: sources.sources } : {}),
    },
    { status: 503 },
  );
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'ai-smart-analytics', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req, 16_384);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = RequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid latitude, longitude and optional target species are required.' },
      { status: 400 },
    );
  }

  const { lat, lng, targetSpecies, region, saltwater } = parsed.data;
  const supabase = getSupabaseAdmin();

  let authenticated = false;
  let userId: string | null = null;
  try {
    const context = await getAuthContext();
    authenticated = Boolean(context);
    userId = context?.user?.id ?? null;
  } catch {
    authenticated = false;
    userId = null;
  }

  const sources = await gatherSmartAnalyticsSources(
    { lat, lng, targetSpecies, region, saltwater },
    { supabase, userId, authenticated },
  );

  const baseline = await buildBaseline({ lat, lng, targetSpecies, sources });
  const prompt = buildAnalysisPrompt({
    lat,
    lng,
    targetSpecies,
    region,
    sources,
    baseline,
  });

  let analysis;
  try {
    const raw = await runBrainPrompt({
      temperature: 0.3,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    analysis = parseModelJson(raw, SmartAnalysisSchema);
  } catch (error) {
    console.error('[smart-analytics] AI provider error:', error);
    return unavailable('AI smart analysis is unavailable; no analysis was generated.', sources);
  }

  const catalogIds = new Set(sources.catalog.nearby_spots.map((spot) => spot.id));
  const recommendations = analysis.recommendations.filter((row) => catalogIds.has(row.spot_id));
  const dropped = analysis.recommendations.length - recommendations.length;

  if (recommendations.length === 0) {
    console.warn('[smart-analytics] model returned no recommendations inside the stored catalog.');
    return unavailable(
      'AI smart analysis returned recommendations outside the stored catalog; no analysis was published.',
      sources,
    );
  }

  const observedAt = sources.provider.captured_at;
  const liveData = hasVerifiedCurrentConditions({
    live: sources.provider.status === 'ok',
    data_mode: 'provider',
    observed_at: observedAt,
  });

  return NextResponse.json(
    {
      analysis: {
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        data_gaps: analysis.data_gaps,
      },
      recommendations,
      aiSummary: analysis.verdict,
      baseline,
      data_phase: sources.data_phase,
      data_sufficiency: {
        catch_log_total: sources.catchLog.total,
        catch_log_nearby: sources.catchLog.nearby,
        catch_log_recent_30d: sources.catchLog.recent_30d,
        sufficient: sources.catchLog.sufficient,
        note: sources.catchLog.note,
      },
      sources: sources.sources,
      dropped_recommendations: dropped,
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: liveData,
      conditions: {
        status: sources.provider.status,
        providers: sources.provider.providers,
        observed_at: observedAt,
        fishing_score: sources.provider.fishing_score,
      },
      generated_at: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'ai-generated' } },
  );
}
