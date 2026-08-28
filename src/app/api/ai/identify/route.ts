import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const baseURL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
const model = process.env.OLLAMA_MODEL || 'llama3.2-vision';

const client = new OpenAI({
  baseURL,
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
});

export async function POST(req: NextRequest) {
  try {
    const { image_base64 } = await req.json();
    if (!image_base64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const response = await client.chat.completions.create({
      model,
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
          { type: 'image_url', image_url: { url: image_base64 } }
        ]
      }]
    });

    const raw = response.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[AI Identify Error]', e?.message || e);
    return NextResponse.json(
      { error: e?.message || 'AI identification failed' },
      { status: 500 }
    );
  }
}
