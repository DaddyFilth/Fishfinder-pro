export async function fetchSeamcastAiSpots(
  lat: number,
  lon: number,
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SPOTS_API_URL ??
    'https://seamcast-spots.vercel.app';

  const url = `${baseUrl}/api/spots?lat=${lat}&lon=${lon}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Spots API failed: ${res.status}`);
  }

  return res.json();
}
