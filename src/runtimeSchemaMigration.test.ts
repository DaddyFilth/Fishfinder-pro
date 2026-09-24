import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260924_align_runtime_schema.sql';
const migration = readFileSync(resolve(process.cwd(), migrationPath), 'utf8');

describe('runtime schema alignment migration', () => {
  it('creates public.spots table if missing', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.spots');
    expect(migration).toContain('usgs_site_id text');
    expect(migration).toContain('noaa_station_id text');
  });

  it('creates community_map_pins and community_spot_submissions with RLS', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.community_map_pins');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.community_spot_submissions');
    expect(migration).toContain('ALTER TABLE public.community_map_pins ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE public.community_spot_submissions ENABLE ROW LEVEL SECURITY');
  });

  it('aligns catches table schema and locks down select policy to owner', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.catches');
    expect(migration).toContain('ALTER TABLE public.catches ALTER COLUMN is_public SET DEFAULT false');
    expect(migration).toContain('CREATE POLICY "catches_select_policy" ON public.catches');
    expect(migration).toContain('USING (auth.uid() = user_id)');
  });

  it('protects profiles and isolates environmental_snapshots to service_role', () => {
    expect(migration).toContain('CREATE POLICY "profiles_select_own" ON public.profiles');
    expect(migration).toContain('CREATE POLICY "profiles_select_admin" ON public.profiles');
    expect(migration).toContain('REVOKE ALL ON public.environmental_snapshots FROM anon, authenticated');
    expect(migration).toContain('GRANT SELECT, INSERT, DELETE ON public.environmental_snapshots TO service_role');
  });
});
