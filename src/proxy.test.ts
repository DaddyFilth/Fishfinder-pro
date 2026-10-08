import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('./lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
}))

const { config, isPublicPath, proxy } = await import('./proxy')
const { updateSession } = await import('./lib/supabase/middleware')

const updateSessionMock = vi.mocked(updateSession)

function makeRequest(url: string, init: { headers?: Record<string, string> } = {}) {
  return new NextRequest(url, { headers: { origin: 'https://example.com', ...(init.headers ?? {}) } })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test')
  vi.stubEnv('SUPABASE_URL', undefined)
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', undefined)
  vi.stubEnv('SUPABASE_ANON_KEY', undefined)
  updateSessionMock.mockReset()
  updateSessionMock.mockResolvedValue({ response: NextResponse.next(), user: { sub: 'user-1' } })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function doesProxyMatch(url: string) {
  const pathname = new URL(url, 'http://localhost').pathname
  return new RegExp(`^${config.matcher}$`).test(pathname)
}

describe('proxy matcher', () => {
  it.each([
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2Flogo.png&w=64&q=75',
    '/favicon.ico',
    '/manifest.json',
    '/robots.txt',
    '/sitemap.xml',
    '/.well-known/assetlinks.json',
    '/.well-known/acme/challenge',
  ])('bypasses the proxy for the public asset %s', (url) => {
    expect(doesProxyMatch(url)).toBe(false)
  })

  it.each([
    '/dashboard',
    '/api/profile',
    '/robotsXtxt',
    '/sitemapXxml',
    '/manifestXjson',
    '/.well-knownish/assetlinks.json',
  ])('runs the proxy for the non-excluded route %s', (url) => {
    expect(doesProxyMatch(url)).toBe(true)
  })
})

describe('proxy public path allowlist', () => {
  it.each([
    '/offline',
    '/manifest.json',
    '/sw.js',
    '/robots.txt',
    '/sitemap.xml',
    '/auth/login',
    '/auth/reset',
    '/auth/callback',
    '/api/auth',
    '/api/auth/recover',
    '/locations',
    '/locations/lake-texoma',
    '/species',
    '/species/largemouth-bass',
    '/favicon.ico',
    '/icons/icon-192.png',
    '/_next/static/chunks/app.js',
  ])('lets anonymous visitors reach %s', (pathname) => {
    expect(isPublicPath(pathname)).toBe(true)
  })

  it.each([
    '/api/profile',
    '/api/catches',
    '/api/live-spots',
    '/api/community-pins',
    '/api/admin/users',
    '/account',
    '/admin/users',
    '/locationsX',
    '/speciesX',
    '/api/spots/lake-9/conditions/extra',
  ])('still requires authentication for %s', (pathname) => {
    expect(isPublicPath(pathname)).toBe(false)
  })
})

describe('proxy CSP nonce propagation', () => {
  // Regression: the policy is only effective if Next.js can read the nonce off the *request*
  // headers. Because `script-src` carries a nonce source, `'strict-dynamic'` makes browsers ignore
  // `'self'`, so a response-only policy blocks every framework script in production.
  it('forwards the CSP on the request headers so Next.js can stamp the nonce onto its scripts', async () => {
    const response = await proxy(makeRequest('https://www.fishfinder-pro.online/locations'))

    const forwardedPolicy = response.headers.get('x-middleware-request-content-security-policy')
    expect(forwardedPolicy).toBeTruthy()
    expect(forwardedPolicy).toContain('script-src')
    expect(forwardedPolicy).toMatch(/'nonce-[0-9a-f]{32}'/)
    expect(response.headers.get('x-middleware-request-x-nonce')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('sends the same policy on the response and reuses the forwarded nonce', async () => {
    const response = await proxy(makeRequest('https://www.fishfinder-pro.online/locations'))

    const forwardedNonce = response.headers.get('x-middleware-request-x-nonce')
    const responsePolicy = response.headers.get('Content-Security-Policy')

    expect(responsePolicy).toBeTruthy()
    expect(responsePolicy).toContain(`'nonce-${forwardedNonce}'`)
    // A nonce must be unique per request.
    const other = await proxy(makeRequest('https://www.fishfinder-pro.online/locations'))
    expect(other.headers.get('x-middleware-request-x-nonce')).not.toBe(forwardedNonce)
  })
})

describe('proxy access control', () => {
  it('lets an authenticated request through untouched', async () => {
    const response = await proxy(makeRequest('https://www.fishfinder-pro.online/'))

    expect(response.headers.get('location')).toBeNull()
    expect(response.status).toBe(200)
  })

  it('answers anonymous API calls with 401 JSON instead of a redirect', async () => {
    updateSessionMock.mockResolvedValue({ response: NextResponse.next(), user: null })

    const response = await proxy(makeRequest('https://www.fishfinder-pro.online/api/catches'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Authentication required.' })
  })

  it('sends anonymous page visits to login while preserving the target path', async () => {
    updateSessionMock.mockResolvedValue({ response: NextResponse.next(), user: null })

    const response = await proxy(makeRequest('https://www.fishfinder-pro.online/account?tab=logs'))

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/auth/login')
    expect(location.searchParams.get('next')).toBe('/account?tab=logs')
  })

  it('fails closed with 503 when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', undefined)

    const response = await proxy(makeRequest('https://www.fishfinder-pro.online/'))

    expect(response.status).toBe(503)
    expect(updateSessionMock).not.toHaveBeenCalled()
  })
})
