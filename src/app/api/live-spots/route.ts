import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat') || '34.999';
  const lon = searchParams.get('lon') || '-97.366';

  const remoteUrl = `https://seamcast-spots.vercel.app/api/spots?lat=${lat}&lon=${lon}`;

  try {
    const res = await fetch(remoteUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: 'Remote spots API failed', detail, live: false },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ...data, live: true, source: 'seamcast-spots' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Error connecting to remote spots API', detail: message, live: false },
      { status: 500 }
    );
  }
}
