import { z } from 'zod';
const StrategySchema = z.object({ strategy: z.string().trim().min(1).max(8_000) });
const RequestSchema = z.object({
  speciesId: z.string().trim().min(1).max(80),
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
}).strict();
import { NextRequest, NextResponse } from 'next/server';
import { getAiModel, getGroqClient } from '@/lib/ollama';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';
import { SPECIES } from '@/lib/speciesCatalog';
import { hasVerifiedCurrentConditions } from '@/lib/verifiedConditions';

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'species-strategy', limit: 15, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });

  const bodyResult = await readJsonBody(req, 16_384);
  if (!bodyResult.ok) return bodyResult.response;

  const parsedRequest = RequestSchema.safeParse(bodyResult.value);
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Species ID and valid coordinates are required.' }, { status: 400 });
  }
  const { speciesId, lat, lon } = parsedRequest.data;

  const species = SPECIES.find(s => s.id === speciesId);
  if (!species) {
    return NextResponse.json({ error: 'Species not found in catalog.' }, { status: 404 });
  }

  try {
    // Fetch environmental context for the coordinates
    const envUrl = new URL(process.env.SPOTS_API || 'https://seamcast-spots.vercel.app/api/spots');
    envUrl.searchParams.set('lat', lat.toString());
    envUrl.searchParams.set('lon', lon.toString());
    const envRes = await fetch(envUrl, { cache: 'no-store' });
    const envData = envRes.ok ? await envRes.json() : null;
    const conditionsAreCurrent = hasVerifiedCurrentConditions(envData);
    const conditionContext = conditionsAreCurrent
      ? JSON.stringify(envData, null, 2)
      : 'Unavailable as a verified recent live observation. Do not infer or invent current environmental readings.';

    const client = getGroqClient();
    const prompt = `
      You are a Master Fishing Guide. Create a hyper-personalized strategy for targeting ${species.name} (${species.scientificName}) at coordinates ${lat}, ${lon}.
      
      SPECIES BIOLOGY:
      - Habitat: ${species.habitat}
      - Optimal Temp: ${species.advice.optTempMin}°C to ${species.advice.optTempMax}°C
      - Best Baits: ${species.bestBait.join(', ')}
      - General Tips: ${species.tips}
      
      CURRENT LOCAL CONDITIONS:
      ${conditionContext}
      
      TASK:
      Use supplied environmental conditions as current only when the context is explicitly verified as recent live provider data. Otherwise explain that current conditions are unavailable and keep advice general.
      Provide a "Tactical Blueprint" including:
      1. CURRENT VIABILITY: Assess current activity only if verified recent live conditions are supplied; otherwise say it cannot be determined from available data.
      2. GEAR: Offer general species-specific gear, and tailor it to conditions only when verified readings are available.
      3. LOCATION: Give general habitat guidance; do not claim unprovided local structure, access, or depth.
      4. TIP: Give a species-specific tip without claiming personal experience or unverified local observations.
      
      Response format: Concise, authoritative, and formatted with clear headings.
    `;

    const response = await client.chat.completions.create({
      model: getAiModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    });

    const result = { strategy: response.choices[0]?.message?.content || '' };
    const validated = StrategySchema.parse(result);
    return NextResponse.json({
      ...validated,
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: false,
      provider: 'groq',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[species-strategy] error:', error);
    return NextResponse.json({ error: 'AI strategy is unavailable; no strategy was generated.', source: 'none', data_mode: 'unavailable', live_data: false }, { status: 503 });
  }
}
