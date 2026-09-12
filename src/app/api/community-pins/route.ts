import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';
import {
  enforceRateLimit,
  isSameOrigin,
  requestBodyTooLarge,
  tooLarge,
} from '@/lib/security';

const PinSchema = z.object({
  knownSpotId: z.string().uuid(),
  pinType: z.enum([
    'structure',
    'hazard',
    'ramp',
    'shore_access',
    'tip',
  ]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).default(''),
  lat: z.number().min(33.615).max(37.002),
  lng: z.number().min(-103.003).max(-94.430),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const MAX_PIN_DISTANCE_DEGREES = 0.35;

function isNearKnownSpot(
  knownSpot: { lat: number; lng: number },
  pin: { lat: number; lng: number },
) {
  return (
    Math.abs(knownSpot.lat - pin.lat) <= MAX_PIN_DISTANCE_DEGREES &&
    Math.abs(knownSpot.lng - pin.lng) <= MAX_PIN_DISTANCE_DEGREES
  );
}

function validHazardExpiry(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;

  const time = new Date(expiresAt).getTime();
  const max = Date.now() + 90 * 24 * 60 * 60 * 1000;

  return Number.isFinite(time) && time > Date.now() && time <= max;
}

export async function GET(request: NextRequest) {
  const context = await getAuthContext();

  if (!context) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const knownSpotId = new URL(request.url).searchParams.get('knownSpotId');

  if (!knownSpotId || !z.string().uuid().safeParse(knownSpotId).success) {
    return NextResponse.json(
      { error: 'A valid knownSpotId is required.' },
      { status: 400 },
    );
  }

  const knownSpot = DEFAULT_SPOTS.find((spot) => spot.id === knownSpotId);

  if (!knownSpot) {
    return NextResponse.json(
      { error: 'Pins must be attached to a known public-access spot.' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  const { data, error } = await context.supabase
    .from('community_map_pins')
    .select('id, known_spot_id, pin_type, title, description, lat, lng, source_url, expires_at, created_at')
    .eq('known_spot_id', knownSpotId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    name: 'community-pins-write',
    limit: 12,
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

  const parsed = PinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pin = parsed.data;
  const knownSpot = DEFAULT_SPOTS.find((spot) => spot.id === pin.knownSpotId);

  if (!knownSpot) {
    return NextResponse.json(
      { error: 'Pins must be attached to a known public-access spot.' },
      { status: 400 },
    );
  }

  if (!isNearKnownSpot(knownSpot, pin)) {
    return NextResponse.json(
      { error: 'This pin is too far from the selected public-access spot.' },
      { status: 400 },
    );
  }

  if (pin.pinType === 'hazard' && !validHazardExpiry(pin.expiresAt)) {
    return NextResponse.json(
      { error: 'Hazard pins need an expiry date within the next 90 days.' },
      { status: 400 },
    );
  }

  const { data, error } = await context.supabase
    .from('community_map_pins')
    .insert({
      user_id: context.user.id,
      known_spot_id: pin.knownSpotId,
      pin_type: pin.pinType,
      title: pin.title,
      description: pin.description,
      lat: pin.lat,
      lng: pin.lng,
      source_url: pin.sourceUrl ?? null,
      expires_at: pin.expiresAt ?? null,
    })
    .select('id, known_spot_id, pin_type, title, description, lat, lng, source_url, expires_at, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      pin: data,
      message: pin.pinType === 'hazard'
        ? 'Community hazard report published. Verify conditions before navigating.'
        : 'Community pin published and labeled community-reported.',
    },
    { status: 201 },
  );
}
