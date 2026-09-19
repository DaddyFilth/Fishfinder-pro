import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'

import { config } from './proxy'

vi.mock('./lib/supabase/middleware', () => ({
  updateSession: vi.fn(),
}))

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
