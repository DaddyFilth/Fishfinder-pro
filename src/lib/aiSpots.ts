export async function getAiSpots(lat: number, lon: number) {
  const res = await fetch(`/api/spots?lat=${lat}&lon=${lon}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Spots API failed: ${res.status}`);
  return res.json();
}
