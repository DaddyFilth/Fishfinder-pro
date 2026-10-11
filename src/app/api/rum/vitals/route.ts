import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security'
import { requireRole } from '@/lib/auth/server'

const VitalSchema = z.object({
  route: z.string().min(1).max(512).regex(/^\/[a-zA-Z0-9/_:[\].-]*$/),
  device_class: z.enum(['mobile', 'desktop']),
  viewport_width: z.number().int().min(1).max(4000),
  connection_type: z.string().max(32).optional(),
  fcp_ms: z.number().finite().min(0).max(120_000).optional(),
  lcp_ms: z.number().finite().min(0).max(120_000).optional(),
  inp_ms: z.number().finite().min(0).max(120_000).optional(),
  cls: z.number().finite().min(0).max(10).optional(),
  ttfb_ms: z.number().finite().min(0).max(120_000).optional(),
}).strict()

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, { name: 'rum-vitals', limit: 20, windowMs: 60_000 })
  if (limited) return limited
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const bodyResult = await readJsonBody(request, 16_384)
  if (!bodyResult.ok) return bodyResult.response
  const parsed = VitalSchema.safeParse(bodyResult.value)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid field-vitals payload.' }, { status: 400 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ accepted: false, reason: 'collector-not-configured' }, { status: 202 })
  const { error } = await admin.from('rum_field_vitals').insert(parsed.data)
  if (error) return NextResponse.json({ accepted: false }, { status: 202 })
  return NextResponse.json({ accepted: true }, { status: 202 })
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? null
}

export async function GET(request: NextRequest) {
  const context = await requireRole('admin')
  if (!context) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'RUM storage is not configured.' }, { status: 503 })
  const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get('days') ?? 28)))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await admin
    .from('rum_field_vitals')
    .select('created_at, route, device_class, fcp_ms, lcp_ms, inp_ms, cls, ttfb_ms')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10_000)
  if (error) return NextResponse.json({ error: 'Unable to load field-vitals data.' }, { status: 500 })
  const rows = data ?? []
  const summarize = (items: typeof rows) => ({
    samples: items.length,
    fcp_p75_ms: percentile(items.flatMap((row) => row.fcp_ms == null ? [] : [Number(row.fcp_ms)]), 0.75),
    lcp_p75_ms: percentile(items.flatMap((row) => row.lcp_ms == null ? [] : [Number(row.lcp_ms)]), 0.75),
    inp_p75_ms: percentile(items.flatMap((row) => row.inp_ms == null ? [] : [Number(row.inp_ms)]), 0.75),
    cls_p75: percentile(items.flatMap((row) => row.cls == null ? [] : [Number(row.cls)]), 0.75),
    ttfb_p75_ms: percentile(items.flatMap((row) => row.ttfb_ms == null ? [] : [Number(row.ttfb_ms)]), 0.75),
  })
  const byRoute: Record<string, typeof rows> = {}
  for (const row of rows) (byRoute[row.route] ??= []).push(row)
  return NextResponse.json({ window_days: days, generated_at: new Date().toISOString(), overall: summarize(rows), routes: Object.fromEntries(Object.entries(byRoute).map(([route, items]) => [route, summarize(items)])) })
}
