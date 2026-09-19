import { describe, expect, it } from 'vitest'
import {
  getAuthCallbackUrl,
  getPasswordResetRedirectTo,
  getSafeNextPath,
  shouldFollowUpPasswordSignIn,
} from './redirect'

describe('getSafeNextPath', () => {
  it('allows same-origin paths', () => {
    expect(getSafeNextPath('/auth/reset?mode=update')).toBe('/auth/reset?mode=update')
    expect(getSafeNextPath('/account')).toBe('/account')
  })

  it('rejects open redirects', () => {
    expect(getSafeNextPath('https://evil.example')).toBe('/')
    expect(getSafeNextPath('//evil.example')).toBe('/')
    expect(getSafeNextPath('/\\evil.example')).toBe('/')
    expect(getSafeNextPath('')).toBe('/')
    expect(getSafeNextPath(null)).toBe('/')
  })
})

describe('auth callback and reset URLs', () => {
  it('keeps production reset links on the allow-listed callback', () => {
    expect(getAuthCallbackUrl('https://www.fishfinder-pro.online')).toBe(
      'https://www.fishfinder-pro.online/auth/callback',
    )
    expect(getPasswordResetRedirectTo('https://www.fishfinder-pro.online')).toBe(
      'https://www.fishfinder-pro.online/auth/callback?next=%2Fauth%2Freset%3Fmode%3Dupdate',
    )
  })

  it('does not send reset links to an unknown origin', () => {
    expect(getPasswordResetRedirectTo('https://evil.example')).toBe(
      'https://www.fishfinder-pro.online/auth/callback?next=%2Fauth%2Freset%3Fmode%3Dupdate',
    )
  })

  it('allows local development', () => {
    expect(getAuthCallbackUrl('http://localhost:3000/')).toBe('http://localhost:3000/auth/callback')
  })

  it('preserves safe next paths for auth callbacks', () => {
    expect(getAuthCallbackUrl('https://www.fishfinder-pro.online', '/account')).toBe(
      'https://www.fishfinder-pro.online/auth/callback?next=%2Faccount',
    )
    expect(getAuthCallbackUrl('https://www.fishfinder-pro.online', 'https://evil.example')).toBe(
      'https://www.fishfinder-pro.online/auth/callback',
    )
  })
})

describe('signup follow-up sign-in', () => {
  it('signs in after signup when confirm-email is off but no session was returned', () => {
    expect(shouldFollowUpPasswordSignIn('signup', null)).toBe(true)
    expect(shouldFollowUpPasswordSignIn('signup', { access_token: 'tok' })).toBe(false)
    expect(shouldFollowUpPasswordSignIn('login', null)).toBe(false)
  })
})
