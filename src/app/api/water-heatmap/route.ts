import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { enforceRateLimit } from '@/lib/security';

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, { name: 'water-heatmap', limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Database is not configured.' },
      { status: 503 },
    );
  }

  const { data: snapshots, error: snapshotsError } = await supabase
    .from('environmental_snapshots')
    .select('spot_id, water_temp_c, water_level_m, captured_at')
    .order('captured_at', { ascending: false })
    .limit(500);

  if (snapshotsError) {
    return NextResponse.json(
      { error: 'Unable to load environmental snapshots.' },
      { status: 502 },
    );
  }

  const latestBySpot = new Map<
    string,
    {
      spot_id: string;
      water_temp_c: number | null;
      water_level_m: number | null;
      captured_at: string;
    }
  >();

  for (const snapshot of snapshots ?? []) {
    if (
      typeof snapshot.spot_id !== 'string' ||
      latestBySpot.has(snapshot.spot_id)
    ) {
      continue;
    }

    latestBySpot.set(snapshot.spot_id, {
      spot_id: snapshot.spot_id,
      water_temp_c:
        typeof snapshot.water_temp_c === 'number' ? snapshot.water_temp_c : null,
      water_level_m:
        typeof snapshot.water_level_m === 'number' ? snapshot.water_level_m : null,
      captured_at: snapshot.captured_at,
    });
  }

  const spotIds = [...latestBySpot.keys()];
  if (spotIds.length === 0) {
    return NextResponse.json({ points: [] });
  }

  const { data: spots, error: spotsError } = await supabase
    .from('fishing_spots')
    .select('id, name, lat, lng')
    .in('id', spotIds);

  if (spotsError) {
    return NextResponse.json(
      { error: 'Unable to load fishing spot coordinates.' },
      { status: 502 },
    );
  }

  const spotsById = new Map(
    (spots ?? []).map((spot) => [spot.id, spot]),
  );

  const points = spotIds
    .map((spotId) => {
      const spot = spotsById.get(spotId);
      const snapshot = latestBySpot.get(spotId);
      if (!spot || !snapshot) return null;
      if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') return null;

      return {
        spot_id: spot.id,
        spot_name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        water_temp_c: snapshot.water_temp_c,
        water_level_m: snapshot.water_level_m,
        captured_at: snapshot.captured_at,
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  return NextResponse.json(
    { points },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
      },
    },
  );
}
