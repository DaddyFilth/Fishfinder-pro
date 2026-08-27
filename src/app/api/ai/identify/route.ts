import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { image_base64 } = await req.json();
  if (!image_base64) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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
If no fish is visible set is_fish to false and only include that field.`
          },
          { type: 'image_url', image_url: { url: image_base64, detail: 'low' } }
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
