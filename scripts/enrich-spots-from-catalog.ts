import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';

/**
 * One-off enrichment for public.spots rows.
 *
 * The live table stores bare catalog rows (spot_type='other', null
 * access_type/region/notes). Copy the descriptive fields from the bundled
 * public-water catalog (matched by spot id) so stored rows render and filter
 * like the curated defaults, and verify stored coordinates against the catalog.
 *
 * Requires the lat/lng columns from
 * supabase/migrations/20261009_restore_spot_coordinates.sql to be applied for
 * coordinate verification (field enrichment works either way). Idempotent:
 * only differences are patched, so re-runs are no-ops.
 *
 * Usage:
 *   set -a; . ./.env.development.local; set +a
 *   npx tsx scripts/enrich-spots-from-catalog.ts [--dry-run]
 */

const COORDINATE_TOLERANCE = 0.001;

type SpotRow = {
  id: string;
  name: string;
  spot_type: string | null;
  access_type: string | null;
  region: string | null;
  notes: string | null;
};

type CoordRow = { id: string; name: string; lat: number | null; lng: number | null };

function short(value: string | null | undefined): string {
  if (!value) return '(none)';
  return value.length > 48 ? `${value.slice(0, 45)}...` : value;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const catalog = new Map(DEFAULT_SPOTS.map((spot) => [spot.id, spot]));

  const { data: rows, error } = await supabase
    .from('spots')
    .select('id, name, spot_type, access_type, region, notes')
    .order('id', { ascending: true });

  if (error) throw error;
  const spotRows = (rows ?? []) as SpotRow[];
  console.log(`read ${spotRows.length} rows from public.spots`);

  const unmatched: string[] = [];

  for (const row of spotRows) {
    const known = catalog.get(row.id);
    if (!known) {
      unmatched.push(`${row.id} (${row.name})`);
      continue;
    }

    const patch: Record<string, string | null> = {};
    if (row.spot_type !== known.spot_type) patch.spot_type = known.spot_type;
    if ((row.access_type ?? null) !== (known.access_type ?? null)) patch.access_type = known.access_type ?? null;
    if ((row.region ?? null) !== (known.region ?? null)) patch.region = known.region ?? null;
    if ((row.notes ?? null) !== (known.notes ?? null)) patch.notes = known.notes ?? null;

    if (Object.keys(patch).length === 0) continue;

    const changed = Object.entries(patch)
      .map(([field, value]) => `${field}=${short(value)}`)
      .join(', ');
    console.log(`${dryRun ? '[dry-run] ' : ''}updating ${row.id} ${known.name}: ${changed}`);

    if (dryRun) continue;
    const { error: patchError } = await supabase.from('spots').update(patch).eq('id', row.id);
    if (patchError) throw patchError;
  }

  console.log(
    unmatched.length > 0
      ? `${unmatched.length} row(s) have no bundled-catalog match: ${unmatched.join(', ')}`
      : 'every spot row matched a bundled-catalog entry',
  );

  const { data: coordRows, error: coordError } = await supabase
    .from('spots')
    .select('id, name, lat, lng')
    .order('id', { ascending: true });

  if (coordError) {
    console.warn(
      `coordinate verification skipped (${coordError.message}) - apply supabase/migrations/20261009_restore_spot_coordinates.sql first`,
    );
    return;
  }

  const mismatches: string[] = [];
  const missing: string[] = [];
  for (const row of (coordRows ?? []) as CoordRow[]) {
    const known = catalog.get(row.id);
    if (!known) continue;

    if (typeof row.lat !== 'number' || typeof row.lng !== 'number') {
      missing.push(known.name);
      continue;
    }
    if (
      Math.abs(row.lat - known.lat) > COORDINATE_TOLERANCE ||
      Math.abs(row.lng - known.lng) > COORDINATE_TOLERANCE
    ) {
      mismatches.push(
        `${known.name}: stored ${row.lat},${row.lng} vs catalog ${known.lat},${known.lng}`,
      );
    }
  }

  console.log(
    missing.length === 0 && mismatches.length === 0
      ? 'all stored coordinates match the bundled catalog'
      : `coordinate check -> ${missing.length} missing, ${mismatches.length} mismatched: ${mismatches.join(' | ')}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
