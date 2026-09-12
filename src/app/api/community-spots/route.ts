import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import {
  enforceRateLimit,
  isSameOrigin,
  requestBodyTooLarge,
  tooLarge,
} from '@/lib/security';

const OklahomaSpotSchema = z.object({
  name: z.string().trim().min(3).max(120),
  lat: z.number().min(33.615).max(37.002),
  lng: z.number().min(-103.003).max(-94.430),
  waterType: z.enum([
    'freshwater',
    'lake',
    'reservoir',
    'river',
    'pfa',
    'wma',
    'municipal',
    'trout',
  ]),
  spotType: z.enum([
    'lake',
    'reservoir',
    'river',
    'pfa',
    'wma',
    'municipal',
    'trout',
    'public_access',
  ]),
  accessType: z.string().trim().min(3).max(80),
  region: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(1000).default(''),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  accessConfirmation: z.literal(true),
});

export async function GET() {
  const context = await getAuthContext();

  if (!context) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const { data, error } = await context.supabase
    .from('community_spot_submissions')
    .select('*')
    .eq('submitted_by', context.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    name: 'community-spot-submissions',
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (limited) return limited;

  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-site requests are not allowed.' },
      { status: 403 },
    );
  }

  if (requestBodyTooLarge(request)) return tooLarge();

  const context = await getAuthContext();

  if (!context) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const parsed = OklahomaSpotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const spot = parsed.data;

  const { data, error } = await context.supabase
    .from('community_spot_submissions')
    .insert({
      submitted_by: context.user.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      water_type: spot.waterType,
      spot_type: spot.spotType,
      access_type: spot.accessType,
      region: spot.region,
      notes: spot.notes,
      access_confirmation: true,
      source_url: spot.sourceUrl ?? null,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      submission: data,
      message: 'Submission received. It will appear on the public map only after review.',
    },
    { status: 201 },
  );
}
