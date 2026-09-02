import { NextResponse } from 'next/server';

export async function GET() {
  const mockData = {
    points: [
      { lat: 40.0, lng: -90.0, temp: 72, depth: 15 },
      { lat: 40.1, lng: -90.1, temp: 68, depth: 25 },
    ]
  };
  
  return NextResponse.json(mockData);
}
