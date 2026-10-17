import { NextRequest, NextResponse } from 'next/server';
import { runBrainPrompt } from '@/ai/brain';
import { SpotPredictionsSchema, parseModelJson, type SpotPrediction } from '@/lib/aiResponse';
import { analyzeSpotsSmart } from '@/lib/aiAnalytics';
import { findSpeciesByQuery } from '@/lib/fishbotPrompt';
import { fetchSeamcastSpotSuggestions } from '@/lib/seamcastSpotsClient';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';

interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type?: string;
  spot_type?: string;
}

interface RankedSpot {
  spot_id: string | null;
  spot_name: string;
  spot_lat: number | null;
  spot_lng: number | null;
  miles_away: number | null;
  fishing_score: number;
  rating: 'Hot' | 'Good' | 'Fair';
  primary_species: string[];
  best_time_today: string;
  best_technique: string;
  recommended_lure: string;
  reason: string;
}

function round(value: number, places = 1): number {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function distanceMiles(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latDifference = toRadians(toLat - fromLat);
  const lngDifference = toRadians(toLng - fromLng);

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(lngDifference / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeAiResults(
  candidates: SpotPrediction[],
  sourceSpots: Spot[],
  userLat?: number,
  userLng?: number,
  requestedSpecies?: string,
): RankedSpot[] {
  const sourceByName = new Map(
    sourceSpots.map((spot) => [spot.name.toLowerCase().trim(), spot]),
  );
  const usedSpotIds = new Set<string>();

  return candidates
    .map((candidate): RankedSpot | null => {
      const requestedName = candidate.spot_name.toLowerCase().trim();
      const sourceSpot = sourceByName.get(requestedName);
      if (!sourceSpot || usedSpotIds.has(sourceSpot.id)) return null;
      if (
        requestedSpecies &&
        !candidate.primary_species.some((species) => species.toLowerCase() === requestedSpecies.toLowerCase())
      ) return null;
      usedSpotIds.add(sourceSpot.id);

      const milesAway = typeof userLat === 'number' && typeof userLng === 'number'
        ? round(distanceMiles(userLat, userLng, sourceSpot.lat, sourceSpot.lng))
        : null;

      return {
        spot_id: sourceSpot.id,
        spot_name: sourceSpot.name,
        spot_lat: sourceSpot.lat,
        spot_lng: sourceSpot.lng,
        miles_away: milesAway,
        fishing_score: candidate.fishing_score,
        rating: candidate.rating,
        primary_species: candidate.primary_species,
        best_time_today: candidate.best_time_today,
        best_technique: candidate.best_technique,
        recommended_lure: candidate.recommended_lure,
        reason: candidate.reason,
      };
    })
    .filter((result): result is RankedSpot => result !== null)
    .slice(0, 10);
}

/**
 * Complete, catalog-only predictions used when no model reply is available.
 * Scores come from the app's stored catalog scoring — never from invented
 * numbers — and every entry states that the metadata is insufficient for a
 * site-specific prediction.
 */
async function buildCatalogPredictions(
  spots: Spot[],
  species?: string,
  userLat?: number,
  userLng?: number,
): Promise<RankedSpot[]> {
  const anchorLat = userLat ?? spots[0]?.lat;
  const anchorLng = userLng ?? spots[0]?.lng;
  const analysis = await analyzeSpotsSmart({
    ...(typeof anchorLat === 'number' && Number.isFinite(anchorLat) ? { userLat: anchorLat } : {}),
    ...(typeof anchorLng === 'number' && Number.isFinite(anchorLng) ? { userLng: anchorLng } : {}),
    ...(species ? { targetSpecies: species } : {}),
  });
  const byId = new Map(analysis.analyzedSpots.map((row) => [row.spot.id, row]));
  const requestedSpecies = species ? findSpeciesByQuery(species)[0] : undefined;

  return spots
    .map((spot): RankedSpot | null => {
      const row = byId.get(spot.id);
      if (!row) return null;
      const recommended = row.recommendedSpecies[0];
      const speciesNames = [requestedSpecies?.name ?? recommended?.name]
        .filter((name): name is string => Boolean(name))
        .slice(0, 3);

      return {
        spot_id: spot.id,
        spot_name: spot.name,
        spot_lat: spot.lat,
        spot_lng: spot.lng,
        miles_away: typeof userLat === 'number' && typeof userLng === 'number'
          ? round(distanceMiles(userLat, userLng, spot.lat, spot.lng))
          : null,
        fishing_score: Math.max(0, Math.min(100, Math.round(row.suitabilityScore))),
        rating: row.suitabilityScore >= 70 ? 'Hot' : row.suitabilityScore >= 45 ? 'Good' : 'Fair',
        primary_species: speciesNames,
        best_time_today: `${row.bestBiteWindow} (catalog estimate)`.slice(0, 120),
        best_technique: (row.recommendedTechnique ?? recommended?.advice.techniqueWarm ?? 'Catalog technique unavailable').slice(0, 240),
        recommended_lure: (row.recommendedBait ?? recommended?.bestBait.join(', ') ?? 'Catalog bait unavailable').slice(0, 120),
        reason: `${row.reason} Catalog planning estimate only; the supplied metadata is insufficient for a site-specific prediction.`.slice(0, 400),
      };
    })
    .filter((row): row is RankedSpot => row !== null)
    .slice(0, 10);
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'ai-suggest-spots', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }

  const bodyResult = await readJsonBody(req, 64_000);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.value as {
    spots?: unknown;
    species?: unknown;
    userLat?: unknown;
    userLng?: unknown;
  };

  const spots = (Array.isArray(body.spots) ? body.spots : [])
    .filter(
      (spot: unknown): spot is Spot =>
        Boolean(
          spot &&
            typeof spot === 'object' &&
            typeof (spot as Spot).id === 'string' &&
            typeof (spot as Spot).name === 'string' &&
            typeof (spot as Spot).lat === 'number' &&
            Number.isFinite((spot as Spot).lat) &&
            typeof (spot as Spot).lng === 'number' &&
            Number.isFinite((spot as Spot).lng),
        ),
    )
    .slice(0, 10)
    .map((spot) => ({
      ...spot,
      id: spot.id.slice(0, 128),
      name: spot.name.trim().slice(0, 200),
      water_type: spot.water_type?.slice(0, 80),
      spot_type: spot.spot_type?.slice(0, 80),
    }));

  const species =
    typeof body.species === 'string' && body.species.trim()
      ? body.species.trim().slice(0, 80)
      : undefined;
  const userLat =
    typeof body.userLat === 'number' && Number.isFinite(body.userLat) && body.userLat >= -90 && body.userLat <= 90
      ? body.userLat
      : undefined;
  const userLng =
    typeof body.userLng === 'number' && Number.isFinite(body.userLng) && body.userLng >= -180 && body.userLng <= 180
      ? body.userLng
      : undefined;

  if (!spots.length) {
    return NextResponse.json(
      { error: 'No spots provided' },
      { status: 400 },
    );
  }

  try {
    const spotSummary = spots
      .map(
        (spot) =>
          `- ${spot.name} | ID: ${spot.id} | ${spot.lat}, ${spot.lng} | ${spot.water_type ?? 'freshwater'} | ${spot.spot_type ?? 'fishing spot'}`,
      )
      .join(String.fromCharCode(10));

    const feed = typeof userLat === 'number' && typeof userLng === 'number'
      ? await fetchSeamcastSpotSuggestions(userLat, userLng)
      : null;
    const feedSummary = feed
      ? `\nSeamcast-spots feed hints for the user's area (AI-derived, not verified observations): overall bite ${feed.overallBite?.level ?? 'unknown'}${typeof feed.overallBite?.score === 'number' ? ` (${feed.overallBite.score})` : ''}; likely species: ${(feed.speciesLikely ?? []).slice(0, 5).map((s) => s.species).join(', ') || 'none listed'}; suggested baits: ${(feed.recommendedBaits ?? []).slice(0, 5).map((b) => b.baitType).filter(Boolean).join(', ') || 'none listed'}.\n`
      : '';

    const prompt = `
You are an AI fishing-planning assistant.

Give a clearly labeled estimate for ${species ?? 'a plausible sport fish'} at each supplied water. Use only its supplied name, coordinates, water type, and spot type. No current environmental readings, catch reports, water clarity, depth, structure, or access status are provided. Do not claim that any detail is observed, verified, evidence-based, or live, and do not invent spot-specific conditions or features. Keep recommendations general and state in the reason that the supplied metadata is insufficient for site-specific predictions. ${species ? `Include the exact target species "${species}" in primary_species for every spot.` : ''}

${spotSummary}
${feedSummary}
Return ONLY a valid JSON array. Return exactly one object for every supplied spot, in the same order. All scores, ratings, species, times, techniques, and lure choices are AI-generated planning estimates, not fishing reports or forecasts.

Each object must contain:
- spot_name: exact supplied spot name
- fishing_score: integer 0 through 100 predicted by you for this specific water
- rating: your AI rating, exactly "Hot", "Good", or "Fair"
- primary_species: array containing one to three AI-selected fish species for this specific water
- best_time_today: a broad, explicitly estimated window, not a conditions-based forecast
- best_technique: a general technique suitable for the supplied water type and species, without claiming unprovided local structure
- recommended_lure: a general lure or bait suggestion suitable for the supplied water type and target species
- reason: one short explanation noting that supplied metadata is insufficient for a site-specific prediction

Every field is required and must be generated for every spot. Always use Fahrenheit only. Never use Celsius or °C. Do not return Markdown, code fences, commentary, or spots not included in the supplied list.
`.trim();

    const content = await runBrainPrompt({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1800,
    });

    const parsed = parseModelJson(content, SpotPredictionsSchema);

    const normalizedResults = normalizeAiResults(
      parsed,
      spots,
      userLat,
      userLng,
      species,
    );

    if (normalizedResults.length === spots.length) {
      return NextResponse.json({
        results: normalizedResults,
        total_nearby: spots.length,
        source: 'ai',
        data_mode: 'ai-generated',
        live_data: false,
      });
    }
  } catch {
    // Model unreachable: answer from the stored catalog below instead of refusing.
  }

  const catalogResults = await buildCatalogPredictions(spots, species, userLat, userLng);
  if (catalogResults.length > 0) {
    return NextResponse.json({
      results: catalogResults,
      total_nearby: spots.length,
      source: 'app-stored',
      data_mode: 'catalog-derived',
      live_data: false,
      note: "No AI model was reachable; scores come from the app's stored catalog planning estimate.",
    });
  }

  return NextResponse.json(
    { error: 'AI predictions are temporarily unavailable and the supplied spots are not in the stored catalog; no predictions were generated.' },
    { status: 503 },
  );
}
