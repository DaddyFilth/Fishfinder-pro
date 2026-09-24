import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
}))

const { config, isPublicPath } = await import('./proxy')

function doesProxyMatch(url: string) {
  return unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })
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
    '/',
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
    '/api/spots',
    '/api/spots/lake-9/conditions',
    '/favicon.ico',
    '/icons/icon-192.png',
    '/_next/static/chunks/app.js',
  ])('lets anonymous visitors reach %s', (pathname) => {
    expect(isPublicPath(pathname)).toBe(true)
  })

  it.each([
    '/api/species-image/Blue%20Catfish',
    '/api/species-image/Largemouth%20Bass',
  ])('lets anonymous visitors reach the species guide fallback %s', (pathname) => {
    // Guarded because the guide renders this endpoint as its <img> fallback on
    // the public landing page; returning 401 broke every fallback image.
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
    '/api/spots/lake-9/conditions/extra',
  ])('still requires authentication for %s', (pathname) => {
    expect(isPublicPath(pathname)).toBe(false)
  })
})
