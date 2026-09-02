import { NextRequest, NextResponse } from 'next/server';
import { getOllama, OLLAMA_MODEL } from '@/lib/ollama';

export async function POST(req: NextRequest) {
  const openai = getOllama();

  let body: { conditions?: unknown; spot?: unknown; species?: unknown; solunar?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { conditions, spot, species, solunar } = body;
  const spotData = (spot && typeof spot === 'object' ? spot : {}) as Record<string, unknown>;
  const conditionData = (conditions && typeof conditions === 'object' ? conditions : {}) as Record<string, unknown>;
  const solunarData = (solunar && typeof solunar === 'object' ? solunar : {}) as Record<string, unknown>;

  const prompt = `You are FishBot, an expert AI fishing guide with 30 years of experience. 
A user wants to fish at "${spotData.name ?? 'this spot'}" (${spotData.water_type}, ${spotData.spot_type}).

Current conditions:
- Water temp: ${conditionData.water_temp_c ?? 'unknown'}°C
- Air temp: ${conditionData.air_temp_c ?? 'unknown'}°C  
- Wind: ${conditionData.wind_speed_ms ?? 'unknown'} m/s
- Pressure: ${conditionData.pressure_hpa ?? 'unknown'} hPa
- Dissolved oxygen: ${conditionData.dissolved_oxygen_mgl ?? 'unknown'} mg/L
- Flow rate: ${conditionData.flow_rate_cfs ?? 'unknown'} cfs
- Wave height: ${conditionData.wave_height_m ?? 'unknown'}m
- Fishing score: ${conditionData.fishing_score ?? 'unknown'}/100
- Moon phase: ${solunarData.moonPhaseName ?? 'unknown'} (${solunarData.moonIllumination ?? '?'}% lit)
- Solunar score: ${solunarData.solunarScore ?? 'unknown'}/100
- Target species: ${species ?? 'any'}
- Time of day: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
- Date: ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}

Respond with ONLY valid JSON:
{
  "overall_rating": "Good",
  "go_fishing": true,
  "best_time_today": "6:00 AM - 8:30 AM",
  "top_technique": "Slow-roll spinnerbaits along weed edges",
  "top_bait": "Chartreuse spinnerbait 3/8oz",
  "target_depth": "4-8 feet near structure",
  "hotspot_tip": "Focus on the shaded side of docks and fallen timber",
  "weather_impact": "Stable high pressure — fish are active and feeding",
  "moon_impact": "Waxing gibbous increases evening feeding window",
  "pro_tips": ["tip 1", "tip 2", "tip 3"],
  "caution": "Watch for afternoon thunderstorms — leave water by 2pm",
  "confidence": 0.82
}`;

  try {
    const response = await openai.chat.completions.create({
      model: OLLAMA_MODEL,
      max_tokens: 700,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = response.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: 'AI advisor failed' }, { status: 500 });
  }
}
