import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseProjectUrl } from './config'

describe('getSupabaseProjectUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when the Supabase URL is missing', () => {
    expect(getSupabaseProjectUrl()).toBeNull()
  })

  it('returns the configured Supabase URL origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://newproject.supabase.co/path/ignored')
    expect(getSupabaseProjectUrl()).toBe('https://newproject.supabase.co')
  })

  it('falls back to SUPABASE_URL', () => {
    vi.stubEnv('SUPABASE_URL', 'https://fallback.supabase.co')
    expect(getSupabaseProjectUrl()).toBe('https://fallback.supabase.co')
  })

  it('returns null for invalid URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not a url')
    expect(getSupabaseProjectUrl()).toBeNull()
  })
})
