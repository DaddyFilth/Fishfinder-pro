import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalRedisUrl = process.env.REDIS_URL

const redisMock = vi.hoisted(() => ({
  status: 'wait',
  connect: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  exec: vi.fn(),
  ttl: vi.fn(),
}))

vi.mock('ioredis', () => ({
  default: class {
    get status() {
      return redisMock.status
    }

    connect() {
      return redisMock.connect()
    }

    on(...args: unknown[]) {
      redisMock.on(...args)
      return this
    }

    once(...args: unknown[]) {
      redisMock.once(...args)
      return this
    }

    multi() {
      const transaction = {
        incr: (key: string) => {
          redisMock.incr(key)
          return transaction
        },
        expire: (key: string, seconds: number, condition: string) => {
          redisMock.expire(key, seconds, condition)
          return transaction
        },
        exec: () => redisMock.exec(),
      }
      return transaction
    }

    ttl(key: string) {
      return redisMock.ttl(key)
    }
  },
}))

beforeEach(() => {
  process.env.REDIS_URL = 'redis://localhost:6379'
  redisMock.status = 'wait'
  redisMock.connect.mockReset().mockImplementation(async () => {
    redisMock.status = 'ready'
  })
  redisMock.on.mockReset()
  redisMock.once.mockReset()
  redisMock.incr.mockReset()
  redisMock.expire.mockReset()
  redisMock.exec.mockReset().mockResolvedValue([[null, 1], [null, 1]])
  redisMock.ttl.mockReset().mockResolvedValue(37)
})

afterEach(() => {
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL
  else process.env.REDIS_URL = originalRedisUrl
  vi.resetModules()
  vi.restoreAllMocks()
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

  it('uses Redis transactions for shared counting and repairs missing expiry', async () => {
    redisMock.exec
      .mockResolvedValueOnce([[null, 1], [null, 1]])
      .mockResolvedValueOnce([[null, 2], [null, 0]])
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })
    const options = { name: 'test', limit: 2, windowMs: 60_000 }

    expect(await enforceRateLimit(request, options)).toBeNull()
    expect(await enforceRateLimit(request, options)).toBeNull()
    expect(redisMock.incr).toHaveBeenCalledTimes(2)
    expect(redisMock.incr).toHaveBeenCalledWith('fishfinder:ratelimit:test:198.51.100.10')
    expect(redisMock.expire).toHaveBeenCalledTimes(2)
    expect(redisMock.expire).toHaveBeenCalledWith('fishfinder:ratelimit:test:198.51.100.10', 60, 'NX')
  })

  it('shares the Redis connection promise during concurrent cold starts', async () => {
    let finishConnect!: () => void
    redisMock.connect.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishConnect = () => {
          redisMock.status = 'ready'
          resolve()
        }
      }),
    )
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })
    const options = { name: 'test', limit: 2, windowMs: 60_000 }
    const first = enforceRateLimit(request, options)
    const second = enforceRateLimit(request, options)

    expect(redisMock.connect).toHaveBeenCalledTimes(1)
    finishConnect()
    expect(await Promise.all([first, second])).toEqual([null, null])
    expect(redisMock.exec).toHaveBeenCalledTimes(2)
  })

  it('fails closed when configured Redis is unavailable', async () => {
    redisMock.connect.mockRejectedValueOnce(new Error('Redis unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test')

    const response = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(503)
    expect(response?.headers.get('retry-after')).toBe('15')
    expect(redisMock.exec).not.toHaveBeenCalled()
  })

  it('returns 429 with the Redis TTL in Retry-After', async () => {
    redisMock.exec.mockResolvedValueOnce([[null, 2], [null, 1]])
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })

    const response = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(429)
    expect(response?.headers.get('retry-after')).toBe('37')
    expect(redisMock.ttl).toHaveBeenCalledWith('fishfinder:ratelimit:test:198.51.100.10')
  })
})
