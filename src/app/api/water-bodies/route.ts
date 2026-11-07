import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security';
import { getAuthContext } from '@/lib/auth/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAiProviderTargets } from '@/lib/groq';
import { createOpenAiCompatibleClient } from '@/lib/groq';
import { envValue } from '@/lib/env';
import type { WaterBodyLabel } from '@/lib/waterBodies';

// ── Zod validation schema for AI response ────────────────────────────────
import { z } from 'zod';

const WaterBodyAIResponseSchema = z.object({
  status: z.enum(['PUBLIC', 'PRIVATE', 'UNKNOWN']),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().nonempty(),
});

type WaterBodyAIResponse = z.infer<typeof WaterBodyAIResponseSchema>;

// ── Overpass API helper ──────────────────────────────────────────────────

async function queryOverpassAPI(lat: number, lon: number, radiusMiles: number): Promise<{
  results: Array<{ osm_id: number; name: string | null; lat: number; lon: number; water_type: string | null; tags: Record<string, string | null> }>;
} | null> {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const overpassQuery = `
    [out:json];
    (way["natural"="water"]["water"~"lake|reservoir|pond"](around:${radiusMeters},${lat},${lon});
     relation["natural"="water"](around:${radiusMeters},${lat},${lon}));
    );
    out center tags;
  `;

  const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

  try {
    const res = await fetch(overpassUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn('[water-bodies] Overpass API request failed', { status: res.status });
      return null;
    }

    const data = (await res.json()) as {
      elements: Array<{
        type: string;
        id: number;
        tags: Record<string, string | null>;
        bbox?: number[];
        center?: { lat: number; lon: number };
      }>;
    };

    const results = data.elements.map((el): {
      osm_id: number;
      name: string | null;
      lat: number;
      lon: number;
      water_type: string | null;
      tags: Record<string, string | null>;
    } | null => {
      const tags = el.tags || {};
      const natural = tags.natural;
      const water = tags.water;

      if (natural !== 'water') {
        return null;
      }

      // Determine water type from tags
      let waterType: string | null = null;
      if (water === 'lake') waterType = 'lake';
      else if (water === 'reservoir') waterType = 'reservoir';
      else if (water === 'pond') waterType = 'pond';
      else if (tags.landuse === ' reservoir') waterType = 'reservoir';
      else if (tags.landuse === ' pond') waterType = 'pond';

      // Extract name
      const name = tags.name || null;

      // Compute a rough lat/lon from the element
      const latVal = el.center?.lat ?? el.bbox?.[1] ?? lat;
      const lonVal = el.center?.lon ?? el.bbox?.[0] ?? lon;

      return {
        osm_id: el.id,
        name,
        lat: typeof latVal === 'number' ? latVal : lat,
        lon: typeof lonVal === 'number' ? lonVal : lon,
        water_type: waterType,
        tags,
      };
    }).filter((result): result is NonNullable<typeof result> => result !== null);

    return { results };
  } catch (error) {
    console.warn('[water-bodies] Overpass API request failed', error);
    return null;
  }
}

// ── AI classification helper ─────────────────────────────────────────────

async function classifyWaterBodyWithAI(
  tags: Record<string, string | null>,
  providerTargets: Awaited<ReturnType<typeof getAiProviderTargets>>
): Promise<WaterBodyAIResponse> {
  // Build a constrained prompt with the OSM tags
  const tagsJson = JSON.stringify(tags, (key, value) =>
    typeof value === 'string' ? value : undefined
  );

  const prompt = `Given these OpenStreetMap tags for a water body: ${tagsJson}. Classify fishing access as exactly one of: PUBLIC (explicit public access, boat ramp, park, leisure=fishing, or government-managed), PRIVATE (explicit private, access=no, or access=private), UNKNOWN (insufficient tag data). Respond with JSON only: {status: "PUBLIC"|"PRIVATE"|"UNKNOWN", confidence: 0-100, reasoning: "one sentence citing specific tags"}`;

  // Try each provider in the fallback chain
  for (const target of providerTargets) {
    try {
      const client = target.client;
      const model = target.model;

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 256,
        top_p: 1,
        stream: false,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        continue; // try next provider
      }

      const parsed: unknown = JSON.parse(raw);
      const validated = WaterBodyAIResponseSchema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      // If parsing succeeded but validation failed, try next provider
      continue;
    } catch (error) {
      console.warn(`[water-bodies] AI classification failed for provider ${target.provider}`, error);
      continue; // try next provider
    }
  }

  // All providers failed – return UNKNOWN
  return {
    status: 'UNKNOWN',
    confidence: 0,
    reasoning: 'classification unavailable',
  };
}

// ── Main GET handler ──────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // 1️⃣ Rate limiting
  const limited = await enforceRateLimit(req, { name: 'water-bodies', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  // 2️⃣ Auth check
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // 3️⃣ Parse and validate query params
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const radiusMiles = Number(url.searchParams.get('radius_miles'));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    radiusMiles < 1 ||
    radiusMiles > 100
  ) {
    return NextResponse.json(
      { error: 'Invalid coordinates or radius. lat: -90..90, lon: -180..180, radius: 1..100.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured.' },
      { status: 503 }
    );
  }

  // 4️⃣ Query Supabase for cached labels
  const { data: cachedLabels, error: dbError } = await supabase
    .from('water_body_labels')
    .select('osm_id, access_status, ai_confidence, ai_reasoning, last_verified, raw_tags')
    .limit(1000);

  if (dbError) {
    console.error('[water-bodies] Supabase query error:', dbError);
  }

  const labelCache = new Map<number, { access_status: string; ai_confidence: number; ai_reasoning: string; last_verified: string }>();
  if (cachedLabels && Array.isArray(cachedLabels)) {
    for (const row of cachedLabels) {
      labelCache.set(row.osm_id, {
        access_status: row.access_status,
        ai_confidence: row.ai_confidence,
        ai_reasoning: row.ai_reasoning,
        last_verified: row.last_verified,
      });
    }
  }

  // 5️⃣ Query Overpass API for water bodies
  const overpassResult = await queryOverpassAPI(lat, lon, radiusMiles);

  if (!overpassResult || overpassResult.results.length === 0) {
    return NextResponse.json(
      {
        water_bodies: [],
        source: 'overpass-ai',
        data_mode: 'fallback',
        warning: 'Water body data unavailable',
      },
      { status: 200 }
    );
  }

  // 6️⃣ Filter out already-classified osm_ids, classify new ones with AI
  const osmsToClassify = overpassResult.results.filter(
    (r) => !labelCache.has(r.osm_id)
  );

  const newClassifications = await Promise.all(
    osmsToClassify.map(async (result) => {
      // Check cache first
      const cached = labelCache.get(result.osm_id);
      if (cached && cached.access_status !== 'UNKNOWN') {
        return {
          ...result,
          access_status: cached.access_status as 'PUBLIC' | 'PRIVATE' | 'UNKNOWN',
          ai_confidence: cached.ai_confidence,
          ai_reasoning: cached.ai_reasoning,
          last_verified: cached.last_verified,
          data_mode: 'cached',
        } as WaterBodyLabel;
      }

      // Classify with AI
      const providerTargets = await getAiProviderTargets();
      const aiResponse = await classifyWaterBodyWithAI(result.tags, providerTargets);

      // Validate against Zod schema (already done inside classifyWaterBodyWithAI,
      // but we double-check here for the stored response)
      const validated = WaterBodyAIResponseSchema.safeParse(aiResponse);
      const finalResponse = validated.success ? validated.data : {
        status: 'UNKNOWN',
        confidence: 0,
        reasoning: 'classification unavailable',
      };

      // Store the result in Supabase for future cache hits
      try {
        await supabase.from('water_body_labels').upsert(
          {
            osm_id: result.osm_id,
            name: result.name,
            lat: result.lat,
            lon: result.lon,
            water_type: result.water_type,
            raw_tags: result.tags,
            access_status: finalResponse.status,
            ai_confidence: finalResponse.confidence,
            ai_reasoning: finalResponse.reasoning,
            last_verified: new Date().toISOString(),
          },
          { onConflict: 'osm_id' }
        );
      } catch (storeError) {
        console.error('[water-bodies] Failed to store AI classification:', storeError);
        // Continue without crashing — the response is still valid
      }

      return {
        ...result,
        access_status: finalResponse.status as 'PUBLIC' | 'PRIVATE' | 'UNKNOWN',
        ai_confidence: finalResponse.confidence,
        ai_reasoning: finalResponse.reasoning,
        last_verified: new Date().toISOString(),
        data_mode: 'provider',
      } as WaterBodyLabel;
    })
  );

  // 7️⃣ Merge cached results with newly classified ones

  // Build the final response: include both cached and new, plus any fully cached
  const allWaterBodies: WaterBodyLabel[] = [];

  // Add cached results first
  for (const result of overpassResult.results) {
    const cached = labelCache.get(result.osm_id);
    if (cached) {
      allWaterBodies.push({
        osm_id: result.osm_id,
        name: result.name,
        lat: result.lat,
        lon: result.lon,
        water_type: result.water_type,
        access_status: cached.access_status as 'PUBLIC' | 'PRIVATE' | 'UNKNOWN',
        ai_confidence: cached.ai_confidence,
        ai_reasoning: cached.ai_reasoning,
        last_verified: cached.last_verified,
        data_mode: 'cached',
      });
    }
  }

  // Add newly classified results
  for (const lbl of newClassifications) {
    allWaterBodies.push(lbl);
  }

  return NextResponse.json(
    {
      water_bodies: allWaterBodies,
      source: 'overpass-ai',
      data_mode: 'provider',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'x-fishfinder-data-mode': 'provider',
      },
    }
  );
}
