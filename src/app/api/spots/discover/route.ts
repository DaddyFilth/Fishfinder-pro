import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

const requestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMiles: z.number().min(5).max(100).default(35),
});

const candidateSchema = z.object({
  name: z.string().min(2).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  water_type: z.enum(['freshwater', 'saltwater']),
  spot_type: z.string().min(2).max(40),
  notes: z.string().max(280).default(''),
  source_url: z.string().url(),
  source_title: z.string().max(160).default('Public web source'),
});

const responseSchema = z.object({ candidates: z.array(candidateSchema).max(12) });

function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export async function POST(request: NextRequest) {
  try {
    const input = requestSchema.parse(await request.json());
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Find public fishing spots near latitude ${input.lat}, longitude ${input.lng}, within about ${input.radiusMiles} miles. Search official parks, fish and wildlife pages, public access guides, and reputable local fishing resources. Return only spots with a precise public name, coordinates, and a source URL. Exclude private ponds, businesses, vague regions, and duplicates. Respond as JSON matching {"candidates":[{"name":"...","lat":0,"lng":0,"water_type":"freshwater|saltwater","spot_type":"lake|river|reservoir|bay|coast|pond|marsh|sound","notes":"short access or fishery context","source_url":"https://...","source_title":"..."}]}.`;
    const result = await openai.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    });
    const text = result.output_text.replace(/```json|```/gi, '').trim();
    const parsed = responseSchema.parse(JSON.parse(text));
    const candidates = parsed.candidates
      .filter((candidate) => distanceMiles(input.lat, input.lng, candidate.lat, candidate.lng) <= input.radiusMiles * 1.35)
      .filter((candidate, index, list) => list.findIndex((other) => other.name.toLowerCase() === candidate.name.toLowerCase()) === index)
      .map((candidate) => ({ ...candidate, distance_miles: Math.round(distanceMiles(input.lat, input.lng, candidate.lat, candidate.lng)) }));
    return NextResponse.json({ candidates, searched_at: new Date().toISOString() });
  } catch (error) {
    console.error('[v0] Spot discovery failed:', error);
    return NextResponse.json({ error: 'Unable to search public fishing spots right now.' }, { status: 400 });
  }
}
