import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production Supabase schema & RLS audit remediation', () => {
  it('enforces role = angler on profiles_insert_own in 20261004_production_access_controls.sql', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261004_production_access_controls.sql'),
      'utf8',
    )
    expect(sql).toMatch(
      /CREATE POLICY "profiles_insert_own"\s+ON public\.profiles FOR INSERT(?: TO authenticated)?\s+WITH CHECK \(auth\.uid\(\) = id AND role = 'angler'\);/,
    )
  })

  it('reconciles live production tables, columns, triggers, and submission RLS in 20261031024646_reconcile_production_schema_and_rls.sql', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261031024646_reconcile_production_schema_and_rls.sql'),
      'utf8',
    )

    // Role escalation blocked on both INSERT and UPDATE
    expect(sql).toContain("WITH CHECK (auth.uid() = id AND role = 'angler')")
    expect(sql).toContain('BEFORE INSERT OR UPDATE ON public.profiles')
    expect(sql).toContain("IF TG_OP = 'INSERT' THEN")

    // Community spot submission self-approval closed
    expect(sql).toContain('DROP POLICY IF EXISTS "community_spot_submissions_owner" ON public.community_spot_submissions;')
    expect(sql).toContain("WITH CHECK (auth.uid() = submitted_by AND status = 'pending');")

    // Reconciled runtime columns & missing tables
    for (const identifier of [
      'ADD COLUMN IF NOT EXISTS username text',
      'ADD COLUMN IF NOT EXISTS full_name text',
      'ADD COLUMN IF NOT EXISTS avatar_url text',
      'ADD COLUMN IF NOT EXISTS spot_id text',
      'ADD COLUMN IF NOT EXISTS weight_lbs numeric',
      'ADD COLUMN IF NOT EXISTS length_in numeric',
      'ADD COLUMN IF NOT EXISTS photo_url text',
      'CREATE TABLE IF NOT EXISTS public.saved_spots',
      'CREATE TABLE IF NOT EXISTS public.logbook_trips',
      'CREATE TABLE IF NOT EXISTS public.logbook_trip_photos',
      'CREATE TABLE IF NOT EXISTS public.rum_field_vitals',
      'CREATE TABLE IF NOT EXISTS public.admin_audit_log',
      'seamcast_on_auth_user_created',
    ]) {
      expect(sql).toContain(identifier)
    }
  })

  it('keeps db/full-supabase-schema.sql aligned with dkafqgapepebzjtoghos and BEFORE INSERT OR UPDATE role protection', () => {
    const schema = readFileSync(resolve(process.cwd(), 'db/full-supabase-schema.sql'), 'utf8')
    expect(schema).toContain('dkafqgapepebzjtoghos')
    expect(schema).not.toContain('ediqyixbyqrojvgktxky')
    expect(schema).toContain('BEFORE INSERT OR UPDATE ON public.profiles')
  })

  it('ensures every file in supabase/migrations has a unique numeric version prefix', () => {
    const files = readdirSync(resolve(process.cwd(), 'supabase/migrations')).filter((f) => f.endsWith('.sql'))
    const versions = files.map((file) => {
      const match = /^([0-9]+)_([a-zA-Z0-9_-]+)\.sql$/.exec(file)
      expect(match, `Invalid migration filename: ${file}`).not.toBeNull()
      return match![1]
    })
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('points ios-build.yml at Capacitor SPM App.xcodeproj with shared App scheme', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/ios-build.yml'), 'utf8')
    expect(workflow).toContain('-project App.xcodeproj')
    expect(workflow).not.toContain('-workspace App.xcworkspace')
    expect(workflow).toContain('set -euo pipefail')
    expect(
      existsSync(resolve(process.cwd(), 'ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')),
    ).toBe(true)
  })
})
