import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

interface Spot { id: string; name: string; lat: number; lng: number; water_type: string; spot_type: string; }

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function POST(req: NextRequest) {
  const openai = getOllama();
  let body: { spots?: unknown; userLat?: unknown; userLng?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { spots, userLat, userLng } = body;
  if (!Array.isArray(spots) || spots.length === 0) return NextResponse.json({ error: 'No spots provided' }, { status: 400 });
  const uLat = typeof userLat === 'number' ? userLat : null;
  const uLng = typeof userLng === 'number' ? userLng : null;
  const spotsWithDist = (spots as Spot[]).map(s => ({
    ...s,
    miles: uLat !== null && uLng !== null ? Math.round(haversineMiles(uLat, uLng, s.lat, s.lng)*10)/10 : null,
  }));
  const nearby = uLat !== null ? spotsWithDist.filter(s => s.miles !== null && s.miles <= 25) : spotsWithDist;
  if (nearby.length === 0) return NextResponse.json({ error: 'No fishing spots found within 25 miles of your location.' }, { status: 404 });
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const hour = now.getHours();
  const season = ['December','January','February'].includes(month) ? 'Winter'
    : ['March','April','May'].includes(month) ? 'Spring'
    : ['June','July','August'].includes(month) ? 'Summer' : 'Fall';
  const spotList = nearby.slice(0,20).map(s =>
    `- ${s.name} (${s.water_type}, ${s.spot_type}${s.miles !== null ? `, ${s.miles} miles away` : ''})`
  ).join('');
  const prompt = [
    `You are an expert fishing guide AI. It is currently ${season} (${month}), ${hour}:00 local time.`,
    '',
    uLat !== null
      ? `The angler is located near (${uLat?.toFixed(3)}, ${uLng?.toFixed(3)}) and looking for the best fishing spots within 25 miles.`
      : 'The angler is looking for the best fishing spots nearby.',
    '',
    'Available nearby spots:',
    spotList,
    '',
    'Rank the TOP 5 best spots for RIGHT NOW based on season, time of day, water type, and spot type.',
    '',
    'Respond with ONLY valid JSON array:',
    '[',
    '  {',
    '    "spot_name": "Exact name from list above",',
    '    "fishing_score": 88,',
    '    "miles_away": 4.2,',
    '    "primary_species": ["Largemouth Bass", "Catfish"],',
    '    "best_technique": "One sentence technique tip",',
    '    "best_time_today": "6:00 AM - 9:00 AM",',
    '    "reason": "One sentence why this spot is top-rated right now",',
    '    "rating": "Hot|Good|Fair"',
    '  }',
    ']',
  ].join('');
  try {
    const res = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = res.choices[0].message.content ?? '[]';
    const cleaned = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
    const ranked = JSON.parse(cleaned);
    const withIds = ranked.map((r: { spot_name: string }) => ({
      ...r,
      spot_id: nearby.find(s => s.name === r.spot_name)?.id ?? null,
      spot_lat: nearby.find(s => s.name === r.spot_name)?.lat ?? null,
      spot_lng: nearby.find(s => s.name === r.spot_name)?.lng ?? null,
    }));
    return NextResponse.json({ results: withIds, total_nearby: nearby.length, radius_miles: 25 });
  } catch { return NextResponse.json({ error: 'AI ranking failed' }, { status: 500 }); }
}
