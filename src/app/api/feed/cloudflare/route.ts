import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { enforceRateLimit, readJsonBody } from '@/lib/security'
import { getSupabaseServiceRoleKey } from '@/lib/supabase/config'

const snapshotSchema = z.object({
  spot_id: z.string().trim().min(1).max(160),
  captured_at: z.string().datetime({ offset: true }).optional(),
  air_temp_c: z.number().finite().nullable().optional(),
  wind_speed_ms: z.number().finite().nullable().optional(),
  water_temp_c: z.number().finite().nullable().optional(),
  water_level_m: z.number().finite().nullable().optional(),
  flow_rate_cfs: z.number().finite().nullable().optional(),
  dissolved_oxygen_mgl: z.number().finite().nullable().optional(),
  wave_height_m: z.number().finite().nullable().optional(),
  wave_period_s: z.number().finite().nullable().optional(),
  swell_direction_deg: z.number().finite().nullable().optional(),
  tide_height_m: z.number().finite().nullable().optional(),
  fishing_score: z.number().finite().nullable().optional(),
  score_breakdown: z.record(z.string(), z.unknown()).optional(),
  data_sources: z.array(z.unknown()).optional(),
  data_mode: z.string().trim().max(80).optional(),
}).strict()

const payloadSchema = z.union([
  snapshotSchema,
  z.object({ snapshots: z.array(snapshotSchema).min(1).max(500) }).strict(),
])

function getWorkerSecret() {
  return process.env.CLOUDFLARE_WORKER_FEED_SECRET || getSupabaseServiceRoleKey()
}

export async function POST(request: Request) {
  const expectedSecret = getWorkerSecret()
  const suppliedSecret = request.headers.get('x-cloudflare-worker-secret')
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const limited = await enforceRateLimit(request, { name: 'cloudflare-feed', limit: 120, windowMs: 60_000 })
  if (limited) return limited

  const bodyResult = await readJsonBody(request, 512_000)
  if (!bodyResult.ok) return bodyResult.response
  const parsed = payloadSchema.safeParse(bodyResult.value)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid feed payload.' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })

  const rows = 'snapshots' in parsed.data ? parsed.data.snapshots : [parsed.data]
  const { error } = await supabase.from('environmental_snapshots').insert(rows)
  if (error) {
    console.error('[cloudflare-feed] insert failed:', error.message)
    return NextResponse.json({ error: 'Unable to store feed data.' }, { status: 502 })
  }

  return NextResponse.json({ accepted: rows.length })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'cloudflare-feed' })
}
