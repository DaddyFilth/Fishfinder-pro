import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

function generateFallbackAnalysis(spotName: string): string {
  return `### 🎣 FishBot Spot Briefing: ${spotName}
- **Pattern:** Fish are staging around secondary drop-offs and shoreline cover.
- **Top Baits:** 3/8oz bladed jig in shad patterns, squarebill crankbaits around riprap, or 4" finesse worms.
- **Key Strategy:** Target windward banks in early morning, moving out to 10-15ft structure as the sun climbs.`;
}

export async function POST(req: NextRequest) {
  let body: { conditions?: unknown; spot?: unknown; species?: unknown; solunar?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
  }

  const { conditions, spot, species, solunar } = body;
  const spotData = (spot && typeof spot === 'object' ? spot : {}) as Record<string, unknown>;
  const spotName = typeof spotData.name === 'string' ? spotData.name : 'this spot';

  try {
    const openai = getOllama();
    const prompt = `You are FishBot, an expert Oklahoma fishing guide.
Spot: "${spotName}" (${spotData.water_type || 'lake'}, ${spotData.spot_type || 'public access'}).
Target species: ${species || 'General Gamefish'}.
Conditions: ${JSON.stringify(conditions || {})}.
Solunar: ${JSON.stringify(solunar || {})}.

Provide concise, high-impact tactical advice:
1. Best current depth and structure
2. Top 2 specific lure/presentation recommendations
3. Optimal bite timing window Always use Fahrenheit only for every temperature. Never use Celsius or °C.`;

    const response = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 450,
    });

    const advice = response.choices[0]?.message?.content?.trim();
    if (advice) {
      return NextResponse.json({ advice });
    }
  } catch {
    // API or network failure; safely fall back to verified lake guidance
  }

  return NextResponse.json({ advice: generateFallbackAnalysis(spotName) });
}
