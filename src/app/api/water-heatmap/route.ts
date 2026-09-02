import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeTemp = searchParams.get('temp') === 'true';
  const includeDepth = searchParams.get('depth') === 'true';

  const mockData = {
    points: [
      {
        lat: 40.0,
        lng: -90.0,
        ...(includeTemp ? { temp: 72 } : {}),
        ...(includeDepth ? { depth: 15 } : {}),
      },
      {
        lat: 40.1,
        lng: -90.1,
        ...(includeTemp ? { temp: 68 } : {}),
        ...(includeDepth ? { depth: 25 } : {}),
      },
    ],
  };

  return NextResponse.json(mockData);
}
