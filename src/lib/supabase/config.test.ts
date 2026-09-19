import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseProjectUrl, getSupabasePublicConfig, getSupabasePublishableKey } from './config'

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

describe('getSupabasePublishableKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the publishable key when configured', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    expect(getSupabasePublishableKey()).toBe('publishable-key')
  })

  it('falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    expect(getSupabasePublishableKey()).toBe('anon-key')
  })
})

describe('getSupabasePublicConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when either public setting is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
    expect(getSupabasePublicConfig()).toBeNull()
  })

  it('combines the normalized URL with the anon-key fallback', () => {
    vi.stubEnv('SUPABASE_URL', 'https://fallback.supabase.co/rest/v1')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')

    expect(getSupabasePublicConfig()).toEqual({
      url: 'https://fallback.supabase.co',
      key: 'anon-key',
    })
  })
})
