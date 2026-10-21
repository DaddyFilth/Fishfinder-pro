import { createClient } from '@supabase/supabase-js';
import type { ScrapeRecord } from './lib';

const BATCH = 200;

function resolveEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Upsert scraped records into public.spot_metadata using the Supabase service role. */
export async function pushToSupabase(records: ScrapeRecord[]): Promise<void> {
  const url = resolveEnv(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  const key = resolveEnv(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);

  if (!url || !key) {
    console.warn(
      'Supabase is not configured (need SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY) — skipping push.',
    );
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let total = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('spot_metadata')
      .upsert(batch, { onConflict: 'source_url,name' });
    if (error) throw new Error(`spot_metadata upsert failed: ${error.message}`);
    total += batch.length;
  }

  console.log(`pushed ${total} records -> supabase public.spot_metadata`);
}
