import { describe, expect, it } from 'vitest'
import {
  getAuthCallbackUrl,
  getPasswordResetRedirectTo,
  getSafeNextPath,
  isAllowedAuthRequestOrigin,
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

  it('keeps HTTPS reset links on the current origin', () => {
    expect(getPasswordResetRedirectTo('https://staging.fishfinder-pro.online')).toBe(
      'https://staging.fishfinder-pro.online/auth/callback?next=%2Fauth%2Freset%3Fmode%3Dupdate',
    )
  })

  it('allows local development', () => {
    expect(getAuthCallbackUrl('http://localhost:3000/')).toBe('http://localhost:3000/auth/callback')
  })

  it('keeps preview and custom HTTPS origins for callbacks', () => {
    expect(getAuthCallbackUrl('https://fishfinder-pro-git-feature.vercel.app', '/account')).toBe(
      'https://fishfinder-pro-git-feature.vercel.app/auth/callback?next=%2Faccount',
    )
    expect(getAuthCallbackUrl('https://app.example.com', '/account')).toBe(
      'https://app.example.com/auth/callback?next=%2Faccount',
    )
  })

  it('preserves safe next paths for auth callbacks', () => {
    expect(getAuthCallbackUrl('https://www.fishfinder-pro.online', '/account')).toBe(
      'https://www.fishfinder-pro.online/auth/callback?next=%2Faccount',
    )
    expect(getAuthCallbackUrl('https://www.fishfinder-pro.online', 'https://evil.example')).toBe(
      'https://www.fishfinder-pro.online/auth/callback',
    )
  })

  it('falls back to production when the origin is invalid', () => {
    expect(getAuthCallbackUrl('http://staging.fishfinder-pro.online', '/account')).toBe(
      'https://www.fishfinder-pro.online/auth/callback?next=%2Faccount',
    )
  })
})

describe('auth request origins', () => {
  it('accepts same-origin and preview-origin auth requests', () => {
    const previewUrl = new URL('https://fishfinder-pro-git-feature.vercel.app/api/auth')
    expect(isAllowedAuthRequestOrigin(previewUrl.origin, previewUrl)).toBe(true)
    expect(
      isAllowedAuthRequestOrigin('https://fishfinder-pro-git-other.vercel.app', previewUrl),
    ).toBe(true)
  })

  it('rejects unrelated cross-site origins', () => {
    expect(
      isAllowedAuthRequestOrigin(
        'https://evil.example',
        new URL('https://www.fishfinder-pro.online/api/auth'),
      ),
    ).toBe(false)
  })
})

describe('signup follow-up sign-in', () => {
  it('signs in after signup when confirm-email is off but no session was returned', () => {
    expect(shouldFollowUpPasswordSignIn('signup', null)).toBe(true)
    expect(shouldFollowUpPasswordSignIn('signup', { access_token: 'tok' })).toBe(false)
    expect(shouldFollowUpPasswordSignIn('login', null)).toBe(false)
  })
})
