import { NextRequest, NextResponse } from 'next/server';
import { OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OWRB_CONTOURS = 'https://owrb-dev.csa.ou.edu/server/rest/services/Surface_Water/LOK_Lakes/MapServer/2/query';
const MAX_BBOX_SPAN = 5;

type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

function numberParam(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBounds(req: NextRequest): Bounds | null {
  const url = new URL(req.url);
  const minLat = numberParam(url.searchParams.get('minLat'));
  const minLng = numberParam(url.searchParams.get('minLng'));
  const maxLat = numberParam(url.searchParams.get('maxLat'));
  const maxLng = numberParam(url.searchParams.get('maxLng'));
  if ([minLat, minLng, maxLat, maxLng].some((value) => value === null)) return null;
  const bounds = { minLat: minLat as number, minLng: minLng as number, maxLat: maxLat as number, maxLng: maxLng as number };
  if (bounds.minLat >= bounds.maxLat || bounds.minLng >= bounds.maxLng) return null;
  if (bounds.maxLat - bounds.minLat > MAX_BBOX_SPAN || bounds.maxLng - bounds.minLng > MAX_BBOX_SPAN) return null;
  if (
    bounds.minLat < OKLAHOMA_BOUNDS.minLat - 0.2 ||
    bounds.maxLat > OKLAHOMA_BOUNDS.maxLat + 0.2 ||
    bounds.minLng < OKLAHOMA_BOUNDS.minLng - 0.2 ||
    bounds.maxLng > OKLAHOMA_BOUNDS.maxLng + 0.2
  ) return null;
  return bounds;
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'bathymetry', limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const bounds = parseBounds(req);
  if (!bounds) return NextResponse.json({ error: 'A valid Oklahoma map bounding box is required.' }, { status: 400 });

  const params = new URLSearchParams({
    geometry: `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'lake,depth,elevation,source,year',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  });

  try {
    const response = await fetch(`${OWRB_CONTOURS}?${params.toString()}`, {
      headers: { Accept: 'application/geo+json,application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return NextResponse.json({ error: 'OWRB bathymetry is temporarily unavailable.' }, { status: 502 });
    const payload = await response.json() as { type?: string; features?: unknown[] };
    if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
      return NextResponse.json({ error: 'OWRB returned an invalid contour response.' }, { status: 502 });
    }
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=3600', 'x-depth-source': 'OWRB measured contours' },
    });
  } catch {
    return NextResponse.json({ error: 'OWRB bathymetry is temporarily unavailable.' }, { status: 502 });
  }
}
