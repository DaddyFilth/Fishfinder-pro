import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import {
  enforceRateLimit,
  isSameOrigin,
  readJsonBody,
} from '@/lib/security';

const TripSchema = z.object({
  title: z.string().trim().min(1).max(120),
  waterBody: z.string().trim().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weather: z.string().trim().max(300).default(''),
  species: z.string().trim().max(160).default(''),
  catchesCount: z.number().int().min(0).max(10000).default(0),
  notes: z.string().trim().max(2000).default(''),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
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
    .from('logbook_trips')
    .select('*')
    .eq('user_id', context.user.id)
    .order('trip_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Unable to load trips.' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    name: 'logbook-trips-write',
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-site requests are not allowed.' },
      { status: 403 },
    );
  }

  const context = await getAuthContext();

  if (!context) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const bodyResult = await readJsonBody(request, 32_768)
  if (!bodyResult.ok) return bodyResult.response
  const body = bodyResult.value

  const parsed = TripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const trip = parsed.data;

  const { data, error } = await context.supabase
    .from('logbook_trips')
    .insert({
      user_id: context.user.id,
      title: trip.title,
      water_body: trip.waterBody,
      trip_date: trip.date,
      weather: trip.weather,
      species: trip.species,
      catches_count: trip.catchesCount,
      notes: trip.notes,
      latitude: trip.lat,
      longitude: trip.lng,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Unable to save trip.' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
