import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProLogger } from '@/lib/logbook/pro-logger';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, isSameOrigin, readJsonBody } from '@/lib/security';

const CatchSchema = z.object({
  species: z.string().trim().min(1).max(80),
  weight_lbs: z.number().finite().nonnegative().max(1000).nullable().optional(),
  length_in: z.number().finite().positive().max(1000).nullable().optional(),
  bait: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  spot_id: z.string().trim().min(1).max(128),
  spot_name: z.string().trim().max(200),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  photo_url: z.string().max(10_000_000).optional(),
  caught_at: z.string().datetime().optional(),
}).strict().refine(data =>
  (typeof data.lat === 'number' || typeof data.latitude === 'number') &&
  (typeof data.lng === 'number' || typeof data.longitude === 'number'),
  { message: 'lat/lng or latitude/longitude is required.' },
);

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'pro-logger', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = await readJsonBody(req, 32_768);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value as { catchData?: unknown };
    const parsed = CatchSchema.safeParse(body.catchData);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid catch data.' }, { status: 400 });
    }

    const latitude = parsed.data.latitude ?? parsed.data.lat!;
    const longitude = parsed.data.longitude ?? parsed.data.lng!;

    const result = await ProLogger.logCatchPro(user.id, {
      species: parsed.data.species,
      weight_lbs: parsed.data.weight_lbs ?? null,
      length_in: parsed.data.length_in ?? null,
      bait: parsed.data.bait,
      notes: parsed.data.notes,
      spot_id: parsed.data.spot_id,
      spot_name: parsed.data.spot_name,
      latitude,
      longitude,
      photo_url: parsed.data.photo_url ?? null,
      caught_at: parsed.data.caught_at ?? new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('ProLogger API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
