import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

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

function getBestTimeWindow(): string {
  const hour = new Date().getHours();

  if (hour >= 4 && hour < 8) {
    return 'Now through 8:30 AM';
  }

  if (hour >= 8 && hour < 11) {
    return '8:30 AM–10:30 AM';
  }

  if (hour >= 11 && hour < 16) {
    return '6:30 PM–8:30 PM';
  }

  if (hour >= 16 && hour < 19) {
    return 'Now through sunset';
  }

  if (hour >= 19 && hour < 22) {
    return 'Sunset through 10:00 PM';
  }

  return 'Dawn: 5:30 AM–8:30 AM';
}

function getSpeciesAndTechnique(
  spot: Spot,
  targetSpecies?: string,
): {
  primary_species: string[];
  best_technique: string;
  recommended_lure: string;
} {
  const requested = targetSpecies?.trim();

  if (requested) {
    const species = requested.toLowerCase();

    if (species.includes('bass')) {
      return {
        primary_species: [requested],
        best_technique:
          'Work rocky points, laydowns, and weed edges slowly; focus on shade and current breaks.',
        recommended_lure:
          'Green-pumpkin Texas-rig, compact jig and craw, or white/chartreuse spinnerbait.',
      };
    }

    if (species.includes('crappie')) {
      return {
        primary_species: [requested],
        best_technique:
          'Vertical-jig brush piles, bridge pilings, standing timber, and submerged structure.',
        recommended_lure:
          '1/16 oz chartreuse tube jig, small marabou jig, or live minnow under a slip float.',
      };
    }

    if (species.includes('catfish')) {
      return {
        primary_species: [requested],
        best_technique:
          'Fish channel edges, creek mouths, riprap, and deep holes; let the bait sit near bottom.',
        recommended_lure:
          'Cut shad, stink bait, chicken liver, or punch bait on a slip-sinker rig.',
      };
    }

    if (species.includes('trout')) {
      return {
        primary_species: [requested],
        best_technique:
          'Cast upstream or across current and retrieve naturally through deeper runs and seams.',
        recommended_lure:
          'Small inline spinner, 1/32 oz jig, trout worm, or natural-colored nymph presentation.',
      };
    }

    if (species.includes('striped') || species.includes('striper')) {
      return {
        primary_species: [requested],
        best_technique:
          'Target windblown points, channel edges, and active bait schools with a steady retrieve.',
        recommended_lure:
          'Paddle-tail swimbait, bucktail jig, topwater walking bait, or live shad.',
      };
    }

    return {
      primary_species: [requested],
      best_technique:
        'Fish the nearest structure, depth change, and shaded cover during the best low-light window.',
      recommended_lure:
        'Match bait size and color to water clarity; start with a natural-color soft plastic or jig.',
    };
  }

  const type = `${spot.water_type ?? ''} ${spot.spot_type ?? ''}`.toLowerCase();

  if (type.includes('river') || type.includes('stream')) {
    return {
      primary_species: ['Largemouth Bass', 'Channel Catfish', 'Sunfish'],
      best_technique:
        'Fish current seams, eddies, undercut banks, logjams, and deeper pools below shallow runs.',
      recommended_lure:
        'Small spinnerbait, tube jig, squarebill crankbait, or cut bait on a bottom rig.',
    };
  }

  if (type.includes('reservoir')) {
    return {
      primary_species: ['Largemouth Bass', 'Crappie', 'Channel Catfish'],
      best_technique:
        'Target points, submerged timber, brush piles, riprap, and creek-channel transitions.',
      recommended_lure:
        'Texas-rigged creature bait, compact jig, crankbait, or 1/16 oz crappie jig.',
    };
  }

  return {
    primary_species: ['Largemouth Bass', 'Crappie', 'Channel Catfish'],
    best_technique:
      'Fish visible cover, shoreline transitions, docks, weed edges, and nearby depth changes.',
    recommended_lure:
      'Spinnerbait, soft-plastic worm, compact jig, or small chartreuse crappie jig.',
  };
}

function getRating(score: number): 'Hot' | 'Good' | 'Fair' {
  if (score >= 82) return 'Hot';
  if (score >= 70) return 'Good';
  return 'Fair';
}

function generateAlgorithmicRanking(
  spots: Spot[],
  targetSpecies?: string,
  userLat?: number,
  userLng?: number,
): RankedSpot[] {
  const bestTimeToday = getBestTimeWindow();

  return spots.slice(0, 10).map((spot, index) => {
    const fishingScore = Math.max(68, 94 - index * 3);
    const recommendation = getSpeciesAndTechnique(spot, targetSpecies);

    const milesAway =
      typeof userLat === 'number' &&
      typeof userLng === 'number' &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng)
        ? round(distanceMiles(userLat, userLng, spot.lat, spot.lng))
        : null;

    return {
      spot_id: spot.id ?? null,
      spot_name: spot.name,
      spot_lat: spot.lat ?? null,
      spot_lng: spot.lng ?? null,
      miles_away: milesAway,
      fishing_score: fishingScore,
      rating: getRating(fishingScore),
      primary_species: recommendation.primary_species,
      best_time_today: bestTimeToday,
      best_technique: recommendation.best_technique,
      recommended_lure: recommendation.recommended_lure,
      reason:
        `${spot.name} offers accessible ${spot.spot_type ?? 'fishing'} structure. ` +
        `The best opportunity is during the low-light feeding window, with attention to nearby cover and depth changes.`,
    };
  });
}

function normalizeAiResults(
  candidates: unknown,
  sourceSpots: Spot[],
  targetSpecies?: string,
  userLat?: number,
  userLng?: number,
): RankedSpot[] {
  if (!Array.isArray(candidates)) {
    return [];
  }

  const sourceByName = new Map(
    sourceSpots.map((spot) => [spot.name.toLowerCase().trim(), spot]),
  );

  const fallbackByName = new Map(
    generateAlgorithmicRanking(
      sourceSpots,
      targetSpecies,
      userLat,
      userLng,
    ).map((result) => [result.spot_name.toLowerCase().trim(), result]),
  );

  const usedSpotIds = new Set<string>();

  return candidates
    .map((candidate, index): RankedSpot | null => {
      if (!candidate || typeof candidate !== 'object') {
        return null;
      }

      const item = candidate as Record<string, unknown>;
      const requestedName = String(item.spot_name ?? '').trim().toLowerCase();
      const sourceSpot = sourceByName.get(requestedName) ?? sourceSpots[index];
      const fallback = sourceSpot
        ? fallbackByName.get(sourceSpot.name.toLowerCase().trim())
        : null;

      if (!sourceSpot || !fallback || usedSpotIds.has(sourceSpot.id)) {
        return null;
      }

      usedSpotIds.add(sourceSpot.id);

      const rawScore = Number(item.fishing_score);
      const fishingScore = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : fallback.fishing_score;

      const rawSpecies = Array.isArray(item.primary_species)
        ? item.primary_species
        : typeof item.primary_target === 'string'
          ? [item.primary_target]
          : fallback.primary_species;

      const primarySpecies = rawSpecies
        .map((species) => String(species).trim())
        .filter(Boolean)
        .slice(0, 3);

      return {
        spot_id: sourceSpot.id,
        spot_name: sourceSpot.name,
        spot_lat: sourceSpot.lat,
        spot_lng: sourceSpot.lng,
        miles_away: fallback.miles_away,
        fishing_score: fishingScore,
        rating: getRating(fishingScore),
        primary_species:
          primarySpecies.length > 0
            ? primarySpecies
            : fallback.primary_species,
        best_time_today:
          String(
            item.best_time_today ??
              item.best_time ??
              fallback.best_time_today,
          ).trim() || fallback.best_time_today,
        best_technique:
          String(
            item.best_technique ??
              item.recommended_lure ??
              fallback.best_technique,
          ).trim() || fallback.best_technique,
        recommended_lure:
          String(
            item.recommended_lure ??
              fallback.recommended_lure,
          ).trim() || fallback.recommended_lure,
        reason:
          String(item.reason ?? fallback.reason).trim() ||
          fallback.reason,
      };
    })
    .filter((result): result is RankedSpot => result !== null)
    .slice(0, 10);
}

export async function POST(req: NextRequest) {
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

    species =
      typeof body?.species === 'string' && body.species.trim()
        ? body.species.trim()
        : undefined;

    userLat =
      typeof body?.userLat === 'number' && Number.isFinite(body.userLat)
        ? body.userLat
        : undefined;

    userLng =
      typeof body?.userLng === 'number' && Number.isFinite(body.userLng)
        ? body.userLng
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

  const fallbackResults = generateAlgorithmicRanking(
    spots,
    species,
    userLat,
    userLng,
  );

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

Rank the following fishing spots for catching ${species ?? 'sport fish'} today.

${spotSummary}

Return ONLY a valid JSON array. Return exactly one object for every supplied spot, in the same order.

Each object must contain:
- spot_name: exact supplied spot name
- fishing_score: integer 0 through 100
- rating: "Hot", "Good", or "Fair"
- primary_species: array containing one to three fish species
- best_time_today: a specific fishing window such as "6:15 AM–8:45 AM" or "Now through sunset"
- best_technique: a specific technique tied to the water type and structure
- recommended_lure: a specific lure or bait recommendation
- reason: one short plain-language explanation

Every spot must have a non-empty best_time_today, best_technique, recommended_lure, and reason.
Always use Fahrenheit only. Never use Celsius or °C.
Do not return Markdown, code fences, commentary, or spots not included in the supplied list.
`.trim();

    const response = await ollama.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1800,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    const jsonMatch = content.match(/[[sS]*]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const normalizedResults = normalizeAiResults(
        parsed,
        spots,
        species,
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
    }
  } catch {
    // AI is optional. The algorithmic fallback always returns a complete card shape.
  }

  return NextResponse.json({
    results: fallbackResults,
    total_nearby: spots.length,
    source: 'algorithmic-fallback',
  });
}
