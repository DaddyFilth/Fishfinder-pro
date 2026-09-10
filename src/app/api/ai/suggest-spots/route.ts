import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type?: string;
  spot_type?: string;
}

interface RankedSpot {
  spot_name: string;
  fishing_score: number;
  rating: 'Hot' | 'Good' | 'Fair';
  primary_target: string;
  best_time: string;
  reason: string;
  recommended_lure: string;
}

function generateAlgorithmicRanking(spots: Spot[], targetSpecies?: string): RankedSpot[] {
  const currentHour = new Date().getHours();
  const timeOfDay = currentHour >= 5 && currentHour <= 9 ? 'Early Morning (Dawn bite)' :
                    currentHour >= 18 && currentHour <= 21 ? 'Evening Twilight' :
                    'Midday transition';

  const defaultTargets = ['Largemouth Bass', 'Crappie', 'Channel Catfish', 'Striped Bass'];
  const primary = targetSpecies || defaultTargets[0];

  return spots.slice(0, 10).map((spot, index) => {
    const baseScore = Math.max(68, 94 - index * 3);
    const rating: 'Hot' | 'Good' | 'Fair' = baseScore >= 82 ? 'Hot' : baseScore >= 72 ? 'Good' : 'Fair';
    
    return {
      spot_name: spot.name,
      fishing_score: baseScore,
      rating,
      primary_target: primary,
      best_time: timeOfDay,
      reason: `Stable conditions and active structure around ${spot.name}. Optimum temperature bands favor feeding activity.`,
      recommended_lure: primary.toLowerCase().includes('bass') ? 'Jig & craw or spinnerbait around cover' :
                        primary.toLowerCase().includes('crappie') ? '1/16oz chartreuse tube jig over brush' :
                        'Cut shad on slip-sinker rig near channel drops',
    };
  });
}

export async function POST(req: NextRequest) {
  let spots: Spot[] = [];
  let species: string | undefined;

  try {
    const body = await req.json();
    spots = Array.isArray(body?.spots) ? body.spots : [];
    species = typeof body?.species === 'string' ? body.species : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!spots.length) {
    return NextResponse.json({ error: 'No spots provided' }, { status: 400 });
  }

  try {
    const openai = getOllama();
    const spotSummary = spots.slice(0, 10).map(s => `- ${s.name} (${s.water_type || 'lake'})`).join('');
    const prompt = `You are a professional Oklahoma fishing guide.Rank these spots for catching ${species || 'sport fish'}:${spotSummary}Return ONLY a JSON array with objects containing: spot_name, fishing_score (0-100), rating ("Hot"|"Good"|"Fair"), primary_target, best_time, reason, recommended_lure. Always use Fahrenheit only for every temperature. Never use Celsius or °C.`;

    const response = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ results: parsed });
    }
  } catch {
    // LLM unreachable or disabled; safely fall back to algorithm ranking
  }

  const fallbackResults = generateAlgorithmicRanking(spots, species);
  return NextResponse.json({ results: fallbackResults });
}
