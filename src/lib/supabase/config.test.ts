import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseProjectUrl } from './config'

describe('getSupabaseProjectUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns the pinned project URL when env matches the same project', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://dkafqgapepebzjtoghos.supabase.co')
    expect(getSupabaseProjectUrl()).toBe('https://dkafqgapepebzjtoghos.supabase.co')
  })

  it('returns null when an explicit env URL points to a different project', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wrongproject.supabase.co')
    expect(getSupabaseProjectUrl()).toBeNull()
  })
})
