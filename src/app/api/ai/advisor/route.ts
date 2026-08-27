import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { conditions, spot, species, solunar } = await req.json();

  const prompt = `You are FishBot, an expert AI fishing guide with 30 years of experience. 
A user wants to fish at "${spot?.name ?? 'this spot'}" (${spot?.water_type}, ${spot?.spot_type}).

Current conditions:
- Water temp: ${conditions?.water_temp_c ?? 'unknown'}°C
- Air temp: ${conditions?.air_temp_c ?? 'unknown'}°C  
- Wind: ${conditions?.wind_speed_ms ?? 'unknown'} m/s
- Pressure: ${conditions?.pressure_hpa ?? 'unknown'} hPa
- Dissolved oxygen: ${conditions?.dissolved_oxygen_mgl ?? 'unknown'} mg/L
- Flow rate: ${conditions?.flow_rate_cfs ?? 'unknown'} cfs
- Wave height: ${conditions?.wave_height_m ?? 'unknown'}m
- Fishing score: ${conditions?.fishing_score ?? 'unknown'}/100
- Moon phase: ${solunar?.moonPhaseName ?? 'unknown'} (${solunar?.moonIllumination ?? '?'}% lit)
- Solunar score: ${solunar?.solunarScore ?? 'unknown'}/100
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
      model: 'gpt-4o-mini',
      max_tokens: 700,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = response.choices[0].message.content ?? '{}';
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch (e) {
    console.error('[AI Advisor]', e);
    return NextResponse.json({ error: 'AI advisor failed' }, { status: 500 });
  }
}
