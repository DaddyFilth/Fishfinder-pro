import { NextRequest, NextResponse } from 'next/server';
import { getAiModel, getOllama } from '@/lib/ollama';
import { SpotPredictionsSchema, parseModelJson, type SpotPrediction } from '@/lib/aiResponse';
import { enforceRateLimit, requestBodyTooLarge, tooLarge } from '@/lib/security';

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
): RankedSpot[] {
  const sourceByName = new Map(
    sourceSpots.map((spot) => [spot.name.toLowerCase().trim(), spot]),
  );
  const usedSpotIds = new Set<string>();

  return candidates
    .map((candidate, index): RankedSpot | null => {
      const requestedName = candidate.spot_name.toLowerCase().trim();
      const sourceSpot = sourceByName.get(requestedName) ?? sourceSpots[index];
      if (!sourceSpot || usedSpotIds.has(sourceSpot.id)) return null;
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

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'ai-suggest-spots', limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  if (requestBodyTooLarge(req, 64_000)) return tooLarge();

  let spots: Spot[] = [];
  let species: string | undefined;
  let userLat: number | undefined;
  let userLng: number | undefined;

  try {
    const body = await req.json();

    spots = Array.isArray(body?.spots)
      ? body.spots.filter(
          (spot: unknown): spot is Spot =>
            Boolean(
              spot &&
                typeof spot === 'object' &&
                typeof (spot as Spot).id === 'string' &&
                typeof (spot as Spot).name === 'string' &&
                typeof (spot as Spot).lat === 'number' &&
                typeof (spot as Spot).lng === 'number',
            ),
        )
      : [];

    spots = spots.slice(0, 50).map((spot) => ({
      ...spot,
      id: spot.id.slice(0, 128),
      name: spot.name.trim().slice(0, 200),
      water_type: spot.water_type?.slice(0, 80),
      spot_type: spot.spot_type?.slice(0, 80),
    }));

    species =
      typeof body?.species === 'string' && body.species.trim()
        ? body.species.trim().slice(0, 80)
        : undefined;

    userLat =
      typeof body?.userLat === 'number' && Number.isFinite(body.userLat)
        ? body.userLat >= -90 && body.userLat <= 90 ? body.userLat : undefined
        : undefined;

    userLng =
      typeof body?.userLng === 'number' && Number.isFinite(body.userLng)
        ? body.userLng >= -180 && body.userLng <= 180 ? body.userLng : undefined
        : undefined;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  if (!spots.length) {
    return NextResponse.json(
      { error: 'No spots provided' },
      { status: 400 },
    );
  }

  try {
    const ollama = getOllama();

    const spotSummary = spots
      .slice(0, 10)
      .map(
        (spot) =>
          `- ${spot.name} | ID: ${spot.id} | ${spot.water_type ?? 'freshwater'} | ${spot.spot_type ?? 'fishing spot'}`,
      )
      .join(String.fromCharCode(10));

    const prompt = `
You are a professional Oklahoma fishing guide.

Make an independent, evidence-based prediction for each supplied body of water for catching ${species ?? 'the best available sport fish'} today.
Use each spot's exact name, coordinates, water type, and spot type to make the predictions materially different. Do not copy scores, ratings, species, times, techniques, lures, or reasons between bodies of water. A prediction is not a hardcoded rule: infer the likely target fish and score from the individual water body and its geography. If information is limited, express uncertainty in the reason but still provide a distinct estimate.

${spotSummary}

Return ONLY a valid JSON array. Return exactly one object for every supplied spot, in the same order.

Each object must contain:
- spot_name: exact supplied spot name
- fishing_score: integer 0 through 100 predicted by you for this specific water
- rating: your AI rating, exactly "Hot", "Good", or "Fair"
- primary_species: array containing one to three AI-selected fish species for this specific water
- best_time_today: a specific predicted fishing window
- best_technique: a specific technique tied to this water's type, location, and likely structure
- recommended_lure: a specific lure or bait chosen for this water and target species
- reason: one short explanation referencing what makes this water's prediction distinct

Every field is required and must be generated for every spot. Always use Fahrenheit only. Never use Celsius or °C. Do not return Markdown, code fences, commentary, or spots not included in the supplied list.
`.trim();

    const response = await ollama.chat.completions.create({
      model: getAiModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1800,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed = parseModelJson(content, SpotPredictionsSchema);

    const normalizedResults = normalizeAiResults(
      parsed,
      spots,
      userLat,
      userLng,
    );

    if (normalizedResults.length === Math.min(spots.length, 10)) {
      return NextResponse.json({
        results: normalizedResults,
        total_nearby: spots.length,
        source: 'ai',
      });
    }
  } catch {
    // AI is optional. The algorithmic fallback always returns a complete card shape.
  }

  return NextResponse.json(
    { error: 'AI predictions are temporarily unavailable. No hardcoded ratings were used.' },
    { status: 503 },
  );
}
