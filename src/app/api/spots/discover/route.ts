import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';
import { enforceRateLimit, isHttpUrl, isSameOrigin, readJsonBody } from '@/lib/security';

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
  source_url: z.string().url().max(2000).refine(isHttpUrl, 'Use an HTTP or HTTPS source URL.'),
  source_title: z.string().max(160).default('Public web source'),
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
  source_url?: string;
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
      source_url: undefined,
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
    source_url: undefined,
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

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'spot-discovery', limit: 6, windowMs: 60_000 });
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

  if (!process.env.OPENAI_API_KEY) {
    return discoveryResponse(
      bundledCandidates(input),
      'bundled-catalog',
      'AI discovery is not configured; showing nearby spots from the bundled public catalog.',
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000, maxRetries: 1 });
    const prompt = `Find public fishing spots near latitude ${input.lat}, longitude ${input.lng}, within about ${input.radiusMiles} miles. Search official parks, fish and wildlife pages, public access guides, and reputable local fishing resources. Return only spots with a precise public name, coordinates, and a source URL. Exclude private ponds, businesses, vague regions, and duplicates. Respond as JSON matching {"candidates":[{"name":"...","lat":0,"lng":0,"water_type":"freshwater|saltwater","spot_type":"lake|river|reservoir|bay|coast|pond|marsh|sound","notes":"short access or fishery context","source_url":"https://...","source_title":"..."}]}.`;
    const result = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    });
    const text = result.output_text.replace(/```(?:json)?\s*|\s*```$/gi, '').trim();
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
        source_url: undefined,
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
