import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';
import { runBrainPrompt } from '@/ai/brain';
import { SmartAnalysisSchema, parseModelJson, type SmartAnalysis } from '@/lib/aiResponse';
import { SPECIES } from '@/lib/speciesCatalog';
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
export const maxDuration = 120;

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

function catalogRecommendation(row: BaselineRow, catalogIds: Set<string>): SmartAnalysis['recommendations'][number] | null {
  if (!catalogIds.has(row.spot_id)) return null;
  const catalogSpecies = SPECIES.find((entry) => entry.name.toLowerCase() === row.species.toLowerCase());
  const score = Math.min(100, Math.max(0, Math.round(row.score)));

  return {
    spot_id: row.spot_id.slice(0, 128),
    spot_name: row.spot_name.slice(0, 200),
    score,
    rating: score >= 70 ? 'Hot' : score >= 45 ? 'Good' : 'Fair',
    primary_species: [(catalogSpecies?.name ?? row.species).slice(0, 120)],
    best_time_today: (catalogSpecies?.bestTime ?? 'Catalog best time unavailable').slice(0, 160),
    best_technique: (catalogSpecies?.advice.techniqueWarm ?? catalogSpecies?.tips ?? 'Catalog technique unavailable').slice(0, 300),
    recommended_lure: (catalogSpecies?.bestBait.join(', ') ?? 'Catalog bait unavailable').slice(0, 160),
    reason: row.reason.slice(0, 500),
  };
}

/**
 * Complete, catalog-only analysis used when no model reply is available. It
 * publishes the app's own stored scoring so the panel still answers, and states
 * plainly that no model judgment was applied.
 */
function buildCatalogAnalysis(
  baseline: BaselineRow[],
  catalogIds: Set<string>,
  providerStatus: string,
): SmartAnalysis | null {
  const recommendations = baseline
    .map((row) => catalogRecommendation(row, catalogIds))
    .filter((row): row is SmartAnalysis['recommendations'][number] => row !== null)
    .slice(0, 6);
  if (recommendations.length === 0) return null;

  const leader = recommendations[0];
  const dataGaps = ['AI model verdict'];
  if (providerStatus !== 'ok') dataGaps.push('live provider readings');

  return {
    verdict: `Catalog ranking: ${leader.spot_name} leads at ${leader.score}/100 from the app's stored catalog scoring because no AI model was reachable. No model judgment was applied.`,
    confidence: 40,
    reasoning:
      'Scores come from the stored catalog baseline (distance, species match, and any provider readings on file). Treat them as planning estimates, not live predictions.',
    data_gaps: dataGaps,
    recommendations,
  };
}

function catalogDerivedResponse(analysis: SmartAnalysis, sources: SmartAnalyticsSources, baseline: BaselineRow[]) {
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
      recommendations: analysis.recommendations,
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
      dropped_recommendations: 0,
      source: 'app-stored',
      data_mode: 'catalog-derived',
      live_data: liveData,
      conditions: {
        status: sources.provider.status,
        providers: sources.provider.providers,
        observed_at: observedAt,
        fishing_score: sources.provider.fishing_score,
      },
      generated_at: new Date().toISOString(),
      note: 'No AI model was reachable; this analysis was assembled from the stored catalog and any provider data on file.',
    },
    { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'catalog-derived' } },
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

  const catalogIds = new Set(sources.catalog.nearby_spots.map((spot) => spot.id));

  let analysis: SmartAnalysis;
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
    const catalogAnalysis = buildCatalogAnalysis(baseline, catalogIds, sources.provider.status);
    if (catalogAnalysis) return catalogDerivedResponse(catalogAnalysis, sources, baseline);
    return unavailable(
      'AI smart analysis is unavailable and no stored catalog spots answered for these coordinates; no analysis was generated.',
      sources,
    );
  }

  const recommendations = analysis.recommendations.filter((row) => catalogIds.has(row.spot_id));
  const dropped = analysis.recommendations.length - recommendations.length;

  if (recommendations.length === 0) {
    console.warn('[smart-analytics] model returned no recommendations inside the stored catalog.');
    const catalogAnalysis = buildCatalogAnalysis(baseline, catalogIds, sources.provider.status);
    if (catalogAnalysis) return catalogDerivedResponse(catalogAnalysis, sources, baseline);
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
