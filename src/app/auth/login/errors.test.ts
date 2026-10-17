import { describe, expect, it } from 'vitest'
import { mapAuthError } from './errors'

describe('mapAuthError', () => {
  it('reports rate limiting for 429 responses', () => {
    expect(mapAuthError('login', 'Too many requests. Please try again later.', 429).message)
      .toBe('Too many attempts. Please try again later.')
  })

  it('does not report rate limiting when the limiter backend is unavailable', () => {
    expect(mapAuthError('login', 'Rate limiting service is temporarily unavailable.', 503).message)
      .toBe('Authentication is temporarily unavailable. Please try again in a minute.')
  })

  it('asks unconfirmed users to confirm their email', () => {
    expect(mapAuthError('login', 'Email not confirmed', 400).message)
      .toBe('Please confirm your email before logging in.')
  })

  it('does not leak credential details for invalid logins', () => {
    expect(mapAuthError('login', 'Invalid login credentials', 400).message)
      .toBe('Invalid email or password.')
  })

  it('maps duplicate signups to a login suggestion', () => {
    expect(mapAuthError('signup', 'User already registered', 400).message)
      .toBe('An account with this email already exists. Try logging in instead.')
  })
})
