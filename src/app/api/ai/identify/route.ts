import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import OpenAI from 'openai';

const baseURL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
const model = process.env.OLLAMA_MODEL || 'llama3.2-vision';

const client = new OpenAI({
  baseURL,
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
});

export async function POST(req: NextRequest) {
=======
import { getOpenAI } from '@/lib/openai';

export async function POST(req: NextRequest) {
  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });

  let body: { image_base64?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { image_base64 } = body;
  if (typeof image_base64 !== 'string' || !image_base64.startsWith('data:image/') || image_base64.length > 10_000_000) {
    return NextResponse.json({ error: 'A valid image under 10MB is required' }, { status: 400 });
  }

>>>>>>> bdf67f5c98ebdd10e1473250a2798f70a8b7614e
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
<<<<<<< HEAD
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[AI Identify Error]', e?.message || e);
    return NextResponse.json(
      { error: e?.message || 'AI identification failed' },
      { status: 500 }
    );
=======
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: 'AI identification failed' }, { status: 500 });
>>>>>>> bdf67f5c98ebdd10e1473250a2798f70a8b7614e
  }
}
