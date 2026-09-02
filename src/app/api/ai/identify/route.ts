import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_VISION_MODEL } from '@/lib/ollama';
import { SPECIES } from '@/lib/speciesCatalog';

const CATALOG_SPECIES_CONTEXT = SPECIES.map(({ name, aliases, scientificName }) =>
  `- ${name}${aliases.length ? ` (also: ${aliases.join(', ')})` : ''}: ${scientificName}`,
).join('\n');
const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const openai = getOllama();

export async function POST(req: NextRequest) {
  let image_base64: unknown;
  try {
    ({ image_base64 } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof image_base64 !== 'string' || !SUPPORTED_IMAGE_DATA_URL.test(image_base64)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image' }, { status: 400 });
  }

  try {
    const response = await openai.chat.completions.create({
      model: OLLAMA_VISION_MODEL,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an expert fish biologist and angler. Analyze this fishing photo and respond with ONLY valid JSON in this exact format:
{
  "species": "Common Name",
  "scientific_name": "Genus species",
  "confidence": 0.95,
  "size_estimate": "14-18 inches estimated",
  "weight_estimate": "2-3 lbs estimated",
  "distinguishing_features": ["feature 1", "feature 2", "feature 3"],
  "habitat": "Rivers, lakes with rocky substrate",
  "best_baits": ["Spinnerbait", "Crankbait", "Live minnow"],
  "fun_fact": "One interesting fact about this species",
  "legal_notes": "Check local regulations for size/bag limits",
  "is_fish": true
}
Use a canonical guide name when the fish matches this catalog; otherwise return the most specific accurate common name. Do not force an identification to this list.\n\nCatalog names:\n${CATALOG_SPECIES_CONTEXT}\n\nIf no fish is visible set is_fish to false and only include that field.`
          },
          { type: 'image_url', image_url: { url: image_base64 } }
        ]
      }]
    });

    const raw = response.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch (e) {
    console.error('[AI Identify]', e);
    return NextResponse.json({ error: 'AI identification failed' }, { status: 500 });
  }
}
