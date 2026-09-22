// Guards the profile-roles migration that Supabase preview branches and the
// production migration workflow both execute. It previously assumed the
// `profiles.role` column already existed, which failed those checks with
// `column "role" does not exist (SQLSTATE 42703)`. Assertions on migration
// source match the style of androidSdkWorkflows.test.ts.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260921123000_fix_profile_roles_and_admin_rls.sql'
const migration = readFileSync(resolve(process.cwd(), migrationPath), 'utf8')

describe('profile roles migration', () => {
  it('creates the role column before any statement reads or writes it', () => {
    const addColumnIndex = migration.indexOf('ADD COLUMN IF NOT EXISTS role text')
    const firstRoleUseIndex = migration.indexOf("SET role = 'angler'")

    expect(addColumnIndex).toBeGreaterThan(-1)
    expect(firstRoleUseIndex).toBeGreaterThan(addColumnIndex)
  })

  it('normalizes legacy roles and keeps the RBAC constraint aligned', () => {
    expect(migration).toContain("WHERE role = 'user' OR role IS NULL")
    expect(migration).toContain("ALTER COLUMN role SET DEFAULT 'angler'")
    expect(migration).toContain('ALTER COLUMN role SET NOT NULL')
    expect(migration).toContain("CHECK (role IN ('angler', 'moderator', 'admin'))")
  })

  it('uses guarded statements so a re-run cannot fail the check', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS')
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS profiles_role_check')
    expect(migration).toContain('DROP POLICY IF EXISTS "Admins can manage profiles"')
    expect(migration).toContain('DROP TRIGGER IF EXISTS prevent_profile_role_escalation')
  })
})