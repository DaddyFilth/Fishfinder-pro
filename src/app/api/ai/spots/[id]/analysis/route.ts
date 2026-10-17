import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { SPECIES } from '@/lib/speciesCatalog'
import { askBrain, type BrainContext } from '@/ai/brain'
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security'

const ConditionsSchema = z.record(z.string(), z.unknown()).default({})
const AnalysisSchema = z.object({
  spot_id: z.string(),
  spot_name: z.string(),
  bite_likelihood: z.enum(['very_likely', 'likely', 'possible', 'slow']),
  confidence: z.number().min(0).max(100),
  summary: z.string().min(1).max(800),
  best_species: z.array(z.object({
    species: z.string().min(1).max(100),
    reason: z.string().min(1).max(300),
  })).min(1).max(3),
  best_bait: z.string().min(1).max(160),
  target_depth: z.string().min(1).max(160),
  bite_window: z.string().min(1).max(160),
  technique: z.string().min(1).max(300),
  location_advice: z.string().min(1).max(300),
  evidence: z.array(z.string().min(1).max(240)).max(5),
}).strict()

type RouteProps = { params: Promise<{ id: string }> }

function groundingForSpot() {
  const freshwaterSpecies = SPECIES.filter((species) => species.habitat === 'Freshwater')
  return freshwaterSpecies.slice(0, 16).map((species) => ({
    species: species.name,
    habitat: species.habitatNotes,
    habits: species.tips,
    bait: species.bestBait,
    depth: species.depth,
    best_time: species.bestTime,
    seasonal_depth: species.advice.depthWarm,
  }))
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const limited = await enforceRateLimit(request, { name: 'ai-spot-analysis', limit: 12, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const { id } = await params
  const spot = DEFAULT_SPOTS.find((candidate) => candidate.id === id)
  if (!spot) return NextResponse.json({ error: 'Unknown fishing spot.' }, { status: 404 })
  const bodyResult = await readJsonBody(request, 24_576)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value && typeof bodyResult.value === 'object' ? bodyResult.value as Record<string, unknown> : {}
  const conditionsResult = ConditionsSchema.safeParse(body.conditions)
  if (!conditionsResult.success) return NextResponse.json({ error: 'Invalid spot conditions.' }, { status: 400 })
  const conditions = conditionsResult.data

  const context: BrainContext = {
    spot: spot as unknown as BrainContext['spot'],
    conditions,
    extra: `REFERENCE HABITAT AND HABIT DATA (biological grounding, not a claim that fish are present):\n${JSON.stringify(groundingForSpot()).slice(0, 24000)}\nTreat catalog depth as reference, never as a live measurement.`,
  }

  const question = `Analyze ONLY the canonical spot identified above. Do not use facts from another water and do not invent live readings.

CANONICAL SPOT (authoritative identity)
${JSON.stringify({ id: spot.id, name: spot.name, lat: spot.lat, lng: spot.lng, water_type: spot.water_type, spot_type: spot.spot_type, access_type: spot.access_type, region: spot.region, description: spot.description, depth_metadata: spot.depth_metadata, ada: spot.ada ?? 'ADA access not documented in catalog' })}

Return ONLY valid JSON matching this schema:
{
  "spot_id": "${spot.id}",
  "spot_name": "${spot.name}",
  "bite_likelihood": "very_likely|likely|possible|slow",
  "confidence": 0,
  "summary": "one concise spot-specific answer",
  "best_species": [{"species":"...","reason":"..."}],
  "best_bait": "bait or lure and why",
  "target_depth": "depth range or state unavailable",
  "bite_window": "best time window or state unavailable",
  "technique": "spot-specific presentation",
  "location_advice": "where on this water to fish (structure/shore/pier) using only catalog facts; state if exact location unavailable; mention ADA-accessible spots/accommodations when documented",
  "evidence": ["condition or catalog fact used"]
}

Rules: keep confidence lower when provider conditions are missing; never call catalog depth a live measurement; never claim a guaranteed catch; never mention another spot; include the exact canonical spot_id and spot_name.`

  try {
    const { text } = await askBrain(question, context, {
      temperature: 0.2,
      maxTokens: 900,
      responseFormat: { type: 'json_object' },
    })
    const raw = text || '{}'
    const parsedJson = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''))
    const analysis = AnalysisSchema.parse(parsedJson)
    if (analysis.spot_id !== spot.id || analysis.spot_name !== spot.name) {
      return NextResponse.json({ error: 'AI returned a mismatched spot identity.' }, { status: 502 })
    }
    return NextResponse.json({ ...analysis, ada: spot.ada ?? { accessible: false, label: 'ADA access not documented', accommodations: [], note: 'Contact the managing agency to confirm accessibility.' }, source: 'groq-grounded-by-seamcast-catalog', data_mode: 'ai-generated', live_data: false, conditions_source: conditions.source ?? 'not supplied', observed_at: conditions.captured_at ?? conditions.issuedAt ?? null, generated_at: new Date().toISOString() })
  } catch (error) {
    console.error('[ai-spot-analysis]', error)
    return NextResponse.json({ error: 'AI spot analysis is unavailable; no prediction was generated.', spot_id: spot.id, spot_name: spot.name, source: 'none', data_mode: 'unavailable', live_data: false }, { status: 503 })
  }
}
