import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext } from '@/lib/auth/server';
import { speciesImagePlaceholder } from '@/lib/speciesImagePlaceholder';
import { isSafeGeneratedSvg } from '@/lib/svg';
import { getAiModel, getGroqClient } from '@/lib/ollama';
import { enforceRateLimit } from '@/lib/security';

export const runtime = 'nodejs';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SVG_HEADERS = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=86400, s-maxage=31536000',
};

function svgResponse(svg: string, status = 200) {
  return new NextResponse(svg, { status, headers: SVG_HEADERS });
}

/** Next decodes route params, but guard against malformed percent-encoding. */
function decodeSpeciesParam(species: string) {
  try {
    return decodeURIComponent(species).trim();
  } catch {
    return species.trim();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ species: string }> }
) {
  const limited = await enforceRateLimit(request, { name: 'species-image', limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { species } = await params;
  const speciesName = decodeSpeciesParam(species);

  if (!/^[a-zA-Z0-9][a-zA-Z0-9 /-]{0,79}$/.test(speciesName)) {
    return NextResponse.json({ error: 'Invalid species name' }, { status: 400 });
  }

  const auth = await getAuthContext();
  if (!auth) {
    return svgResponse(speciesImagePlaceholder(speciesName));
  }

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getGroqClient().apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getAiModel(),
        temperature: 0.2,
        max_tokens: 5000,
        messages: [
          {
            role: 'system',
            content: 'Return only valid standalone SVG markup. Create a polished, naturalistic field-guide fish illustration with a blue underwater background. Do not use external images, scripts, text labels, or markdown fences. Use a 1024 square viewBox.',
          },
          {
            role: 'user',
            content: `Create an accurate side-profile illustration of a ${speciesName} fish. Make the fish large and centered, with recognizable species-specific body shape, fins, markings, and coloring.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawSvg = payload.choices?.[0]?.message?.content?.replace(/^```(?:svg)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const svg = rawSvg;

    if (!isSafeGeneratedSvg(svg)) {
      throw new Error('Groq returned unsafe or invalid SVG artwork');
    }

    return svgResponse(svg);
  } catch (error) {
    console.error('[species-image] Groq species image generation failed:', error);
    return svgResponse(speciesImagePlaceholder(speciesName), 502);
  }
}
