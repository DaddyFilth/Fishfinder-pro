import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const body = await req.json();
  const parsed = CatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabase.from('catches').insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spotId = searchParams.get('spot_id');
  let query = supabase.from('catches').select('*').order('caught_at', { ascending: false }).limit(20);
  if (spotId) query = query.eq('spot_id', spotId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
