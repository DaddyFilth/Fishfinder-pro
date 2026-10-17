import { NextRequest, NextResponse } from 'next/server';
import { askBrainVision } from '@/ai/brain';
import { parseFishIdentification } from '@/lib/aiResponse';
import { SPECIES } from '@/lib/speciesCatalog';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';

const CATALOG_SPECIES_CONTEXT = SPECIES.map(({ name, aliases, scientificName }) =>
  `- ${name}${aliases.length ? ` (also: ${aliases.join(', ')})` : ''}: ${scientificName}`,
).join('\n');
const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'ai-identify', limit: 8, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  const bodyResult = await readJsonBody(req, 3_000_000)
  if (!bodyResult.ok) return bodyResult.response
  const { image_base64 } = bodyResult.value as { image_base64?: unknown }
  if (typeof image_base64 !== 'string' || !SUPPORTED_IMAGE_DATA_URL.test(image_base64)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image' }, { status: 400 });
  }
  // ~2 MB limit: base64 expands ~33%, so 2_750_000 chars ≈ 2 MB of binary.
  if (image_base64.length > 2_750_000) {
    return NextResponse.json({ error: 'Image too large. Maximum size is 2 MB.' }, { status: 413 });
  }

  try {
    const prompt = `You are an expert fish biologist and angler. Analyze this fishing photo and respond with ONLY valid JSON in this exact format:
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
Use a canonical guide name when the fish matches this catalog; otherwise return the most specific accurate common name. Do not force an identification to this list.\n\nCatalog names:\n${CATALOG_SPECIES_CONTEXT}\n\nIf no fish is visible set is_fish to false and only include that field.`;

    const { text, degraded } = await askBrainVision(prompt, image_base64, { maxTokens: 600 });

    if (degraded) {
      return NextResponse.json(
        { error: 'AI identification is temporarily unavailable; no identification was generated.', is_fish: false, source: 'none', data_mode: 'unavailable', live_data: false },
        { status: 200, headers: { 'x-fishfinder-source': 'none', 'x-fishfinder-data-mode': 'unavailable', 'x-fishfinder-live-data': 'false' } },
      );
    }

    return NextResponse.json(parseFishIdentification(text || '{}'), { status: 200, headers: { 'x-fishfinder-source': 'ai', 'x-fishfinder-data-mode': 'ai-generated', 'x-fishfinder-live-data': 'false' } });
  } catch (e) {
    console.error('[AI Identify]', e);
    return NextResponse.json({ error: 'AI identification failed; no identification was generated.', is_fish: false, source: 'none', data_mode: 'unavailable', live_data: false }, { status: 200 });
  }
}
