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

    const client = getGroqClient();
    const prompt = `
      You are a Master Fishing Guide. Create a hyper-personalized strategy for targeting ${species.name} (${species.scientificName}) at coordinates ${lat}, ${lon}.
      
      SPECIES BIOLOGY:
      - Habitat: ${species.habitat}
      - Optimal Temp: ${species.advice.optTempMin}°C to ${species.advice.optTempMax}°C
      - Best Baits: ${species.bestBait.join(', ')}
      - General Tips: ${species.tips}
      
      CURRENT LOCAL CONDITIONS:
      ${JSON.stringify(envData, null, 2)}
      
      TASK:
      Synthesize the biological requirements of the ${species.name} with the actual current conditions at this location. 
      Provide a "Tactical Blueprint" including:
      1. CURRENT VIABILITY: Is this species likely active right now given the temperature and weather?
      2. TAILORED GEAR: Which of the best baits should be used specifically for these conditions? (Specify color and weight).
      3. PRECISION LOCATION: Where in this specific environment should the user cast?
      4. THE "SECRET SAUCE": One expert tip for this species in this exact scenario.
      
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
