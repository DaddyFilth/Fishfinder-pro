import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthContext } from '@/lib/auth/server';
import {
  enforceRateLimit,
  isHttpUrl,
  isSameOrigin,
  readJsonBody,
} from '@/lib/security';

const PinSchema = z.object({
  knownSpotId: z.string().trim().min(1).max(128),
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
  sourceUrl: z.string().url().max(2000).refine(isHttpUrl, 'Use an HTTP or HTTPS source URL.').nullable().optional(),
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

async function fetchKnownSpot(
  supabase: SupabaseClient,
  knownSpotId: string,
) {
  const { data, error } = await supabase
    .from('spots')
    .select('id, lat, lng')
    .eq('id', knownSpotId)
    .maybeSingle();

  if (error) return { knownSpot: null, lookupFailed: true } as const;
  return { knownSpot: data, lookupFailed: false } as const;
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

  if (!knownSpotId || knownSpotId.length > 128) {
    return NextResponse.json(
      { error: 'A valid knownSpotId is required.' },
      { status: 400 },
    );
  }

  const { knownSpot, lookupFailed } = await fetchKnownSpot(context.supabase, knownSpotId);
  if (lookupFailed) {
    return NextResponse.json(
      { error: 'Unable to validate the selected spot.' },
      { status: 500 },
    );
  }

  if (!knownSpot || typeof knownSpot.lat !== 'number' || typeof knownSpot.lng !== 'number') {
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
    return NextResponse.json({ error: 'Unable to load community pins.' }, { status: 500 });
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

  const parsed = PinSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pin = parsed.data;
  const knownSpotResult = await fetchKnownSpot(context.supabase, pin.knownSpotId);
  if (knownSpotResult.lookupFailed) {
    return NextResponse.json(
      { error: 'Unable to validate the selected spot.' },
      { status: 500 },
    );
  }

  if (
    !knownSpotResult.knownSpot ||
    typeof knownSpotResult.knownSpot.lat !== 'number' ||
    typeof knownSpotResult.knownSpot.lng !== 'number'
  ) {
    return NextResponse.json(
      { error: 'Pins must be attached to a known public-access spot.' },
      { status: 400 },
    );
  }

  if (!isNearKnownSpot(knownSpotResult.knownSpot, pin)) {
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
    return NextResponse.json({ error: 'Unable to publish community pin.' }, { status: 500 });
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
