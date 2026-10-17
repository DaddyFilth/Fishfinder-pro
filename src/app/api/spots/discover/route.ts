import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';
import { runBrainPrompt } from '@/ai/brain';
import { envValue } from '@/lib/env';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMiles: z.number().min(5).max(100).default(35),
}).strict();

const candidateSchema = z.object({
  name: z.string().min(2).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  water_type: z.enum(['freshwater', 'saltwater']),
  spot_type: z.string().min(2).max(40),
  notes: z.string().max(280).default(''),
  source_title: z.string().max(160).default('AI suggestion (unverified)'),
}).strict();

const responseSchema = z.object({ candidates: z.array(candidateSchema).max(12) }).strict();

function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

type Candidate = {
  name: string;
  lat: number;
  lng: number;
  water_type: 'freshwater' | 'saltwater';
  spot_type: string;
  notes: string;
  source_title: string;
  distance_miles?: number;
};

function withDistance(candidates: Candidate[], input: { lat: number; lng: number; radiusMiles: number }) {
  return candidates
    .filter((candidate) => distanceMiles(input.lat, input.lng, candidate.lat, candidate.lng) <= input.radiusMiles * 1.35)
    .filter((candidate, index, list) =>
      list.findIndex((other) => other.name.toLowerCase() === candidate.name.toLowerCase()) === index)
    .map((candidate) => ({
      ...candidate,
      distance_miles: Math.round(distanceMiles(input.lat, input.lng, candidate.lat, candidate.lng)),
    }));
}

/**
 * Discovery must still return usable spots when the AI provider is unconfigured
 * or fails: the bundled Oklahoma catalog is searched with the same radius and
 * clearly labeled as an unverified catalog listing instead of an AI result.
 */
function bundledCandidates(input: { lat: number; lng: number; radiusMiles: number }) {
  const candidates: Candidate[] = DEFAULT_SPOTS.map((spot) => ({
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    water_type: spot.water_type === 'saltwater' ? 'saltwater' : 'freshwater',
    spot_type: spot.spot_type,
    notes: spot.notes ?? '',
    source_title: 'Bundled public catalog',
  }));

  return withDistance(candidates, input);
}

function discoveryResponse(
  candidates: Array<Record<string, unknown>>,
  source: string,
  warning?: string,
) {
  return NextResponse.json(
    {
      candidates,
      source,
      verified: false,
      searched_at: new Date().toISOString(),
      ...(warning ? { warning } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

function nearbyCatalogSummary(input: { lat: number; lng: number; radiusMiles: number }) {
  return DEFAULT_SPOTS
    .map((spot) => ({ spot, distance: distanceMiles(input.lat, input.lng, spot.lat, spot.lng) }))
    .filter(({ spot, distance }) =>
      spot.water_type === 'saltwater' || distance <= input.radiusMiles * 2)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 25)
    .map(({ spot, distance }) =>
      `- ${spot.name} | ${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)} | ${spot.water_type} | ${spot.spot_type} | ~${Math.round(distance)} mi`)
    .join(String.fromCharCode(10));
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'spot-discovery', limit: 6, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }

  const bodyResult = await readJsonBody(request, 16_384);
  if (!bodyResult.ok) return bodyResult.response;
  const inputResult = requestSchema.safeParse(bodyResult.value);
  if (!inputResult.success) {
    return NextResponse.json({ error: 'Valid coordinates and radius are required.' }, { status: 400 });
  }
  const input = inputResult.data;

  if (!envValue(process.env.GROQ_API_KEY)) {
    return discoveryResponse(
      bundledCandidates(input),
      'bundled-catalog',
      'AI discovery is not configured; showing nearby spots from the bundled public catalog.',
    );
  }

  try {
    const prompt = `
You are a fishing-spot discovery assistant. Suggest plausible public fishing spots near latitude ${input.lat}, longitude ${input.lng}, within about ${input.radiusMiles} miles.

Known spots in the bundled catalog near this area (use these as anchors — suggest a mix of these and other publicly known waters in the same region):
${nearbyCatalogSummary(input) || '(none listed)'}

Rules:
- Every suggestion must have a specific public name and coordinates (4-decimal precision is fine).
- water_type must be "freshwater" or "saltwater".
- spot_type must be one of: lake, river, reservoir, pond, marsh, bay, coast, sound.
- notes: one short sentence on access or fishery character. Do not claim verified conditions.
- Exclude private ponds, businesses, vague regions, and duplicates of catalog anchors.
- These are AI suggestions from model knowledge, not verified or live data. Do not invent source URLs.

Return ONLY valid JSON matching {"candidates":[{"name":"...","lat":0,"lng":0,"water_type":"freshwater|saltwater","spot_type":"lake","notes":"..."}]}. Return at most 8 candidates. No Markdown, no commentary.`.trim();

    const text = (await runBrainPrompt({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    })).replace(/```(?:json)?\s*|\s*```$/gi, '').trim();
    let responseJson: unknown;
    try {
      responseJson = JSON.parse(text) as unknown;
    } catch {
      responseJson = null;
    }

    const parsed = responseSchema.safeParse(responseJson);
    if (!parsed.success) {
      console.warn('[spot-discovery] provider returned an unusable result; using the bundled catalog.');
      return discoveryResponse(
        bundledCandidates(input),
        'bundled-catalog',
        'AI discovery returned an unusable result; showing nearby spots from the bundled public catalog.',
      );
    }

    const candidates = withDistance(
      parsed.data.candidates.map((candidate) => ({
        ...candidate,
        source_title: 'AI suggestion (unverified)',
      })),
      input,
    );

    if (candidates.length === 0) {
      return discoveryResponse(
        bundledCandidates(input),
        'bundled-catalog',
        'AI discovery found no spots in range; showing nearby spots from the bundled public catalog.',
      );
    }

    return discoveryResponse(candidates, 'ai-discovered');
  } catch (error) {
    console.error('[spot-discovery] provider failed:', error);
    return discoveryResponse(
      bundledCandidates(input),
      'bundled-catalog',
      'AI discovery is temporarily unavailable; showing nearby spots from the bundled public catalog.',
    );
  }
}
