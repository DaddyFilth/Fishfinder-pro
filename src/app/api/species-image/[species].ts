import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Species with pre-generated/stock images
const STOCK_IMAGES: Record<string, string> = {
  'Largemouth Bass': '/species/largemouth-bass.jpg',
  'Smallmouth Bass': '/species/smallmouth-bass.jpg',
  'Spotted Bass': '/species/spotted-bass.jpg',
  'Channel Catfish': '/species/channel-catfish.jpg',
  'Blue Catfish': '/species/blue-catfish.jpg',
  'Flathead Catfish': '/species/flathead-catfish.jpg',
  'Walleye': '/species/walleye.jpg',
  'Rainbow Trout': '/species/rainbow-trout.jpg',
  'Brown Trout': '/species/brown-trout.jpg',
  'Crappie': '/species/crappie.jpg',
  'Black Crappie': '/species/black-crappie.jpg',
  'White Crappie': '/species/white-crappie.jpg',
  'Bluegill': '/species/bluegill.jpg',
  'Redear Sunfish': '/species/redear-sunfish.jpg',
  'Striped Bass': '/species/striped-bass.jpg',
  'White Bass': '/species/white-bass.jpg',
  'Hybrid Striper': '/species/hybrid-striper.jpg',
  'Redfish/Red Drum': '/species/redfish-red-drum.jpg',
  'Flounder': '/species/flounder.jpg',
  'Sauger': '/species/sauger.jpg',
  'Common Carp': '/species/common-carp.jpg',
  'Northern Pike': '/species/northern-pike.jpg',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ species: string }> }
) {
  const { species } = await params;
  const speciesName = decodeURIComponent(species).trim();

  if (!/^[a-zA-Z0-9][a-zA-Z0-9 /-]{0,79}$/.test(speciesName)) {
    return NextResponse.json({ error: 'Invalid species name' }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'Groq image generation is not configured' }, { status: 503 });
  }

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
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
    const svg = rawSvg
      ?.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/\s(?:on\w+|href|xlink:href)\s*=\s*(['"]).*?\1/gi, '');

    if (!svg?.startsWith('<svg') || !svg.includes('</svg>')) {
      throw new Error('Groq returned invalid SVG artwork');
    }

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000',
      },
    });
  } catch (error) {
    console.error('[v0] Groq species image generation failed:', error);
    return NextResponse.json({ error: 'Unable to generate species image with Groq' }, { status: 502 });
  }
}
