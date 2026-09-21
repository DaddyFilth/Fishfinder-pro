import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const speciesName = decodeURIComponent(species);

  // Check if we have a stock image for this species
  if (STOCK_IMAGES[speciesName]) {
    return NextResponse.redirect(new URL(STOCK_IMAGES[speciesName], request.url));
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'AI image generation is not configured' }, { status: 503 });
  }

  try {
    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `A realistic field-guide photograph of a ${speciesName} fish underwater in a clear Oklahoma lake, side profile, natural lighting, no text, no labels, no frame.`,
      size: '1024x1024',
      quality: 'low',
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) {
      return NextResponse.json({ error: 'AI image generation returned no image' }, { status: 502 });
    }

    return new NextResponse(Buffer.from(base64, 'base64'), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[v0] Species image generation failed:', error);
    return NextResponse.json({ error: 'Unable to generate species image' }, { status: 502 });
  }
}
