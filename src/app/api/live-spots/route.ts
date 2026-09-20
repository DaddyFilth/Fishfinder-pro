import { NextResponse } from 'next/server';
import { loadLiveSpots } from '@/lib/spotsLoader';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat') ?? '34.999');
  const lon = Number(url.searchParams.get('lon') ?? '-97.366');

  try {
    const ctx = await loadLiveSpots(lat, lon);
    return NextResponse.json(ctx);
  } catch (e) {
    return NextResponse.json({ spots: [], source: 'offline', savedAt: null }, { status: 500 });
  }
}
TS'