import { describe, expect, it } from 'vitest'
import { validateRuntimeEnvironment } from './startup.js'

const supabaseEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
}

describe('validateRuntimeEnvironment', () => {
  it('requires valid Supabase public configuration', () => {
    expect(() => validateRuntimeEnvironment({ NODE_ENV: 'development' })).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL',
    )
  })

  it('rejects invalid Supabase URLs', () => {
    expect(() => validateRuntimeEnvironment({
      ...supabaseEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: 'file:///tmp/supabase',
      NODE_ENV: 'development',
    })).toThrow('http(s) URL')
  })

  it('allows development to use the in-memory rate limiter', () => {
    expect(() => validateRuntimeEnvironment({
      ...supabaseEnvironment,
      NODE_ENV: 'development',
    })).not.toThrow()
  })

  it('allows production startup without Redis when rate-limited routes are not used', () => {
    expect(() => validateRuntimeEnvironment({
      ...supabaseEnvironment,
      NODE_ENV: 'production',
    })).not.toThrow()
  })

  it('does not treat server-only Supabase aliases as browser configuration', () => {
    expect(() => validateRuntimeEnvironment({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      NODE_ENV: 'development',
    })).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })
})
