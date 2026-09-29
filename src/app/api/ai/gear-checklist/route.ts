import { NextRequest, NextResponse } from 'next/server';
import { getGroqClient } from '@/lib/ollama';
import { getAiModel } from '@/lib/ollama';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';
import { SPECIES } from '@/lib/speciesCatalog';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'gear-checklist', limit: 15, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });

  const bodyResult = await readJsonBody(req, 16_384);
  if (!bodyResult.ok) return bodyResult.response;

  const { speciesId, lat, lon } = bodyResult.value as { speciesId?: string; lat?: number; lon?: number };

  if (!speciesId || typeof lat !== 'number' || typeof lon !== 'number') {
    return NextResponse.json({ error: 'Species ID and coordinates are required.' }, { status: 400 });
  }

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

    const client = getGroqClient();
    const prompt = `
      You are a Master Fishing Guide. Generate a precise GEAR CHECKLIST for targeting ${species.name} at coordinates ${lat}, ${lon}.
      
      BIOLOGY: ${species.habitat}, ${species.bestBait.join(', ')}.
      CURRENT CONDITIONS: ${JSON.stringify(envData, null, 2)}
      
      Provide a JSON array of objects. Each object must have:
      - item: The name of the gear (e.g., "Z lures", "Fluorocarbon Leader").
      - spec: Specific detail (e.g., "Chartreuse/Silver, 3.5 inch", "8lb test").
      - priority: "Essential" or "Recommended".
      - reason: Why this is needed for current conditions.

      Respond ONLY with the JSON array. No markdown formatting, no prose.
    `;

    const response = await client.chat.completions.create({
      model: getAiModel(),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const parsed = JSON.parse(content.replace(/```json|```/g, ''));

    return NextResponse.json({ checklist: parsed });
  } catch (error) {
    console.error('[gear-checklist] error:', error);
    return NextResponse.json({ error: 'Failed to generate checklist.' }, { status: 500 });
  }
}
