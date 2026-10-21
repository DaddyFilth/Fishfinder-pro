import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import { enforceRateLimit, readJsonBody } from '@/lib/security';

export const dynamic = 'force-dynamic';

const AddSchema = z.object({ spot_id: z.string().trim().min(1).max(128) }).strict();

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'saved-spots', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { data, error } = await context.supabase
    .from('saved_spots')
    .select('spot_id, created_at')
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Could not load saved spots.' }, { status: 500 });
  return NextResponse.json({ saved: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'saved-spots', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const bodyResult = await readJsonBody(req, 4_096);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = AddSchema.safeParse(bodyResult.value);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid spot id.' }, { status: 400 });

  const { error } = await context.supabase
    .from('saved_spots')
    .upsert({ user_id: context.user.id, spot_id: parsed.data.spot_id }, { onConflict: 'user_id,spot_id' });

  if (error) return NextResponse.json({ error: 'Could not save spot.' }, { status: 500 });
  return NextResponse.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'saved-spots', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const url = new URL(req.url);
  const spotId = url.searchParams.get('spot_id');
  if (!spotId) return NextResponse.json({ error: 'spot_id is required.' }, { status: 400 });

  const { error } = await context.supabase
    .from('saved_spots')
    .delete()
    .eq('user_id', context.user.id)
    .eq('spot_id', spotId);

  if (error) return NextResponse.json({ error: 'Could not remove saved spot.' }, { status: 500 });
  return NextResponse.json({ saved: false }, { headers: { 'Cache-Control': 'no-store' } });
}
