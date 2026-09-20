export async function getNearbySpots(lat: number, lon: number) {
  const res = await fetch(`/api/spots?lat=${lat}&lon=${lon}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Spots API failed: ${res.status}`);
  const json = await res.json();
  return json.spots ?? json.microSpots ?? json;
}
