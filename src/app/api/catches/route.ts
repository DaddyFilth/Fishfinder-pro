import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import { enforceRateLimit, isHttpUrl, isImageDataUrl, isSameOrigin, readJsonBody } from '@/lib/security';

// `id` and `user_id` are intentionally excluded — they are set server-side.
const CatchSchema = z.object({
  species: z.string().min(1).max(80),
  weight_lbs: z.number().nullable(),
  length_in: z.number().nullable(),
  bait: z.string().max(100),
  notes: z.string().max(500),
  spot_id: z.string().trim().min(1).max(128),
  spot_name: z.string().max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  caught_at: z.string().datetime(),
  photo_url: z.string().max(2_800_000).refine(
    (value) => isHttpUrl(value) || isImageDataUrl(value),
    'Use an HTTP or HTTPS URL or a JPEG, PNG, or WebP data URL.',
  ).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'catches-write', limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const bodyResult = await readJsonBody(req, 3_000_000)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value

  const parsed = CatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // user_id is always set from the verified session — never from the client.
  const record = {
    species: parsed.data.species,
    weight_lbs: parsed.data.weight_lbs,
    length_in: parsed.data.length_in,
    bait: parsed.data.bait,
    notes: parsed.data.notes,
    spot_id: parsed.data.spot_id,
    spot_name: parsed.data.spot_name,
    latitude: parsed.data.lat,
    longitude: parsed.data.lng,
    created_at: parsed.data.caught_at,
    photo_url: parsed.data.photo_url ?? null,
    user_id: context.user.id,
    is_public: false,
  };

  const { data, error } = await context.supabase
    .from('catches')
    .insert(record)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Unable to save catch.' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const spotId = searchParams.get('spot_id');

  // Always filter to the authenticated user's own catches.
  let query = context.supabase
    .from('catches')
    .select('*')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (spotId) query = query.eq('spot_id', spotId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Unable to load catches.' }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      caught_at: row.caught_at ?? row.created_at,
      lat: row.lat ?? row.latitude,
      lng: row.lng ?? row.longitude,
    })),
  );
}
