import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const routes: Array<[string, string, string, Record<string, string>?]> = [
  ['admin/users', 'GET', 'admin/users/route'],
  ['admin/users', 'PATCH', 'admin/users/route'],
  ['ai/advisor', 'POST', 'ai/advisor/route'],
  ['ai/analyze', 'POST', 'ai/analyze/route'],
  ['ai/bite-times', 'POST', 'ai/bite-times/route'],
  ['ai/chat', 'POST', 'ai/chat/route'],
  ['ai/gear-checklist', 'POST', 'ai/gear-checklist/route'],
  ['ai/identify', 'POST', 'ai/identify/route'],
  ['ai/species-strategy', 'POST', 'ai/species-strategy/route'],
  ['ai/suggest-spots', 'POST', 'ai/suggest-spots/route'],
  ['auth/recover', 'POST', 'auth/recover/route'],
  ['auth', 'POST', 'auth/route'],
  ['catches', 'GET', 'catches/route'],
  ['catches', 'POST', 'catches/route'],
  ['community-pins', 'GET', 'community-pins/route'],
  ['community-pins', 'POST', 'community-pins/route'],
  ['community-spots', 'GET', 'community-spots/route'],
  ['community-spots', 'POST', 'community-spots/route'],
  ['feed/cloudflare', 'GET', 'feed/cloudflare/route'],
  ['feed/cloudflare', 'POST', 'feed/cloudflare/route'],
  ['live-spots', 'GET', 'live-spots/route'],
  ['logbook/trips', 'GET', 'logbook/trips/route'],
  ['logbook/trips', 'POST', 'logbook/trips/route'],
  ['pro-logger', 'POST', 'pro-logger/route'],
  ['profile', 'GET', 'profile/route'],
  ['profile', 'PATCH', 'profile/route'],
  ['spots/x/conditions', 'GET', 'spots/[id]/conditions/route', { id: 'x' }],
  ['spots/discover', 'POST', 'spots/discover/route'],
  ['spots', 'GET', 'spots/route'],
  ['water-heatmap', 'GET', 'water-heatmap/route'],
  ['weather', 'GET', 'weather/route'],
  ['species-image/bass', 'GET', 'species-image/[species]/route', { species: 'bass' }],
]

describe('API smoke: every endpoint answers invalid/unconfigured calls with a clean JSON/HTTP response', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled')))
  })

  for (const [path, method, mod, params] of routes) {
    it(`${method} /api/${path}`, async () => {
      const handler = (await import(`./${mod}`))[method]
      expect(typeof handler).toBe('function')
      const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers: { 'content-type': 'application/json', origin: 'http://localhost', host: 'localhost' } }
      if (method !== 'GET') init.body = '{}'
      const req = new NextRequest(`http://localhost/api/${path}`, init)
      const res: Response = await handler(req, { params: Promise.resolve(params ?? {}) })
      expect(res).toBeInstanceOf(Response)
      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
      const text = await res.text()
      if (res.headers.get('content-type')?.includes('json')) expect(() => JSON.parse(text)).not.toThrow()
      expect([500, 502].includes(res.status), `${method} /api/${path}: ${text.slice(0, 120)}`).toBe(false)
    })
  }
})
