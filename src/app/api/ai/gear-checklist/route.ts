import { z } from 'zod';
const ChecklistSchema = z.array(z.object({ item: z.string().trim().min(1).max(200), spec: z.string().trim().max(500), priority: z.enum(['Essential', 'Recommended']), reason: z.string().trim().max(800) })).max(30);
const RequestSchema = z.object({
  speciesId: z.string().trim().min(1).max(80),
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
}).strict();
import { NextRequest, NextResponse } from 'next/server';
import { getGroqClient } from '@/lib/ollama';
import { getAiModel } from '@/lib/ollama';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';
import { SPECIES } from '@/lib/speciesCatalog';
import { hasVerifiedCurrentConditions } from '@/lib/verifiedConditions';

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'gear-checklist', limit: 15, windowMs: 60_000 });
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
    const envUrl = new URL(process.env.SPOTS_API || 'https://seamcast-spots.vercel.app/api/spots');
    envUrl.searchParams.set('lat', lat.toString());
    envUrl.searchParams.set('lon', lon.toString());
    const envRes = await fetch(envUrl, { cache: 'no-store' });
    const envData = envRes.ok ? await envRes.json() : null;
    const conditionContext = hasVerifiedCurrentConditions(envData)
      ? JSON.stringify(envData, null, 2)
      : 'Unavailable as a verified recent live observation. Recommend general species-specific gear only; do not claim it is needed for current conditions.';

    const client = getGroqClient();
    const prompt = `
      You are a Master Fishing Guide. Generate a precise GEAR CHECKLIST for targeting ${species.name} at coordinates ${lat}, ${lon}.
      
      BIOLOGY: ${species.habitat}, ${species.bestBait.join(', ')}.
      CURRENT CONDITIONS: ${conditionContext}
      
      Provide a JSON array of objects. Each object must have:
      - item: The name of the gear (e.g., "Z lures", "Fluorocarbon Leader").
      - spec: Specific detail (e.g., "Chartreuse/Silver, 3.5 inch", "8lb test").
      - priority: "Essential" or "Recommended".
      - reason: Explain whether this is general species guidance or tailored to verified supplied conditions. Never invent readings or claim current-condition necessity when verified readings are unavailable.

      Respond ONLY with the JSON array. No markdown formatting, no prose.
    `;

    const response = await client.chat.completions.create({
      model: getAiModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content.replace(/```json|```/g, ''));

    const validated = ChecklistSchema.parse(parsed);
    return NextResponse.json({
      checklist: validated,
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: false,
      provider: 'groq',
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[gear-checklist] error:', error);
    return NextResponse.json({ error: 'AI gear checklist is unavailable; no checklist was generated.', source: 'none', data_mode: 'unavailable', live_data: false }, { status: 503 });
  }
}
