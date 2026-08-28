import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const CatchSchema = z.object({
  id: z.string().uuid(),
  species: z.string().min(1).max(80),
  weight_lbs: z.number().nullable(),
  length_in: z.number().nullable(),
  bait: z.string().max(100),
  notes: z.string().max(500),
  spot_id: z.string().uuid(),
  spot_name: z.string(),
  lat: z.number(),
  lng: z.number(),
  caught_at: z.string().datetime(),
  photo_url: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = CatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabase.from('catches').insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const spotId = searchParams.get('spot_id');
  let query = supabase.from('catches').select('*').order('caught_at', { ascending: false }).limit(20);
  if (spotId) query = query.eq('spot_id', spotId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
