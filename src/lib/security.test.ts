import { afterEach, describe, expect, it, vi } from 'vitest'

const originalRedisUrl = process.env.REDIS_URL

afterEach(() => {
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL
  else process.env.REDIS_URL = originalRedisUrl
  vi.resetModules()
})

describe('enforceRateLimit', () => {
  it('uses the local fallback when Redis is not configured', async () => {
    delete process.env.REDIS_URL
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })

    expect(await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })).toBeNull()
    const limited = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })
    expect(limited?.status).toBe(429)
  })
})
