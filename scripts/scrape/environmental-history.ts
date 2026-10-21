import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SPOTS } from '../../src/lib/defaultSpots';

const NWS_BASE = process.env.NWS_BASE ?? 'https://api.weather.gov';
const MARINE_BASE = process.env.OPEN_METEO_MARINE ?? 'https://marine-api.open-meteo.com/v1/marine';

async function nwsAirTempC(lat: number, lng: number): Promise<number | null> {
  try {
    const pointsRes = await fetch(`${NWS_BASE}/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
      headers: { 'User-Agent': 'Fishfinder-Pro/1.0', Accept: 'application/json' },
    });
    if (!pointsRes.ok) return null;
    const points = await pointsRes.json() as { properties?: { forecast?: string } };
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return null;
    const forecastRes = await fetch(forecastUrl, {
      headers: { 'User-Agent': 'Fishfinder-Pro/1.0', Accept: 'application/json' },
    });
    if (!forecastRes.ok) return null;
    const forecast = await forecastRes.json() as { properties?: { periods?: Array<{ temperature: number; temperatureUnit: string }> } };
    const period = forecast.properties?.periods?.[0];
    if (!period) return null;
    const f = period.temperatureUnit === 'F' ? (period.temperature - 32) * 5 / 9 : period.temperature;
    return Math.round(f * 10) / 10;
  } catch {
    return null;
  }
}

async function marineWaterTempC(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `${MARINE_BASE}?latitude=${lat}&longitude=${lng}&current=sea_surface_temperature&timezone=auto`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json() as { current?: { sea_surface_temperature?: number } };
    const v = data.current?.sea_surface_temperature;
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  } catch {
    return null;
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  const spots = DEFAULT_SPOTS.slice(0, Number.isFinite(limit) ? limit : DEFAULT_SPOTS.length);

  let inserted = 0;
  for (const spot of spots) {
    const [airTempC, waterTempC] = await Promise.all([
      nwsAirTempC(spot.lat, spot.lng),
      marineWaterTempC(spot.lat, spot.lng),
    ]);

    if (airTempC === null && waterTempC === null) {
      console.log(`skip ${spot.id}: no provider readings`);
      continue;
    }

    const { error } = await supabase.from('environmental_snapshots').insert({
      spot_id: spot.id,
      air_temp_c: airTempC,
      water_temp_c: waterTempC,
      captured_at: new Date().toISOString(),
      data_mode: 'scraped',
      data_sources: ['nws', 'open-meteo-marine'],
    });

    if (error) {
      console.error(`insert failed ${spot.id}:`, error.message);
      continue;
    }
    inserted += 1;
    console.log(`stored ${spot.id}`);
  }

  console.log(`Inserted ${inserted} environmental history rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
