import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error('Usage: npx tsx scripts/seed-spots.ts <csv-file>');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const rows = parse(readFileSync(csvPath), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const spots = rows.flatMap((row) => {
    const longitude = Number(row.LONG);
    const latitude = Number(row.LAT);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -103.1 ||
      longitude > -94.4 ||
      latitude < 33.6 ||
      latitude > 37.1
    ) {
      return [];
    }

    return [{
      name: row.AREA_NAME,
      water_body: row.LAKE,
      spot_type: 'fish_attractor',
      location: `POINT(${longitude} ${latitude})`,
      source: 'ODWC fish attractor data',
    }];
  });

  if (spots.length === 0) {
    console.log('No valid spots found.');
    return;
  }

  const { error } = await supabase
    .from('spots')
    .upsert(spots, { onConflict: 'name,water_body' });
  if (error) throw error;

  console.log(`Upserted ${spots.length} spots.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
