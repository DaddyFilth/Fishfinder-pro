import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const urlObj = new URL(req.url);
  const lat =
    Number(urlObj.searchParams.get('lat')) || 34.999;
  const lon =
    Number(urlObj.searchParams.get('lon')) || -97.366;

  const remoteUrl = `https://seamcast-spots.vercel.app/api/spots?lat=${lat}&lon=${lon}`;

  try {
    const res = await fetch(remoteUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'Remote spots API failed', detail: text },
        { status: 502 },
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Error calling remote spots API',
        detail: err?.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
