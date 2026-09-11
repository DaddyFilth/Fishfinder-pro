import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';

// `id` and `user_id` are intentionally excluded — they are set server-side.
const CatchSchema = z.object({
  species: z.string().min(1).max(80),
  weight_lbs: z.number().nullable(),
  length_in: z.number().nullable(),
  bait: z.string().max(100),
  notes: z.string().max(500),
  spot_id: z.string().uuid(),
  spot_name: z.string().max(200),
  lat: z.number(),
  lng: z.number(),
  caught_at: z.string().datetime(),
  photo_url: z.string().url().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // user_id is always set from the verified session — never from the client.
  const record = { ...parsed.data, user_id: context.user.id };

  const { data, error } = await context.supabase
    .from('catches')
    .insert(record)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    .order('caught_at', { ascending: false })
    .limit(50);

  if (spotId) query = query.eq('spot_id', spotId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
