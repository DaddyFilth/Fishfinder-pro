import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalRedisUrl = process.env.REDIS_URL
const originalLocalFallback = process.env.RATE_LIMIT_ALLOW_LOCAL_FALLBACK
const originalKvUrl = process.env.NEXT_PUBLIC_KV_REST_API_URL
const originalKvToken = process.env.NEXT_PUBLIC_KV_REST_API_TOKEN

const redisMock = vi.hoisted(() => ({
  status: 'wait',
  connect: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  exec: vi.fn(),
  ttl: vi.fn(),
}))

const upstashMock = vi.hoisted(() => ({
  limit: vi.fn(),
  slidingWindow: vi.fn(),
  createLimiter: vi.fn(),
  createRedis: vi.fn(),
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

    off(...args: unknown[]) {
      redisMock.off(...args)
      return this
    }

    multi() {
      const transaction = {
        set: (...args: unknown[]) => {
          redisMock.set(...args)
          return transaction
        },
        incr: (key: string) => {
          redisMock.incr(key)
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

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    constructor(options: unknown) {
      upstashMock.createLimiter(options)
    }

    static slidingWindow(...args: unknown[]) {
      return upstashMock.slidingWindow(...args)
    }

    limit(identifier: string) {
      return upstashMock.limit(identifier)
    }
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(options: unknown) {
      upstashMock.createRedis(options)
    }
  },
}))

beforeEach(() => {
  process.env.REDIS_URL = 'redis://localhost:6379'
  delete process.env.NEXT_PUBLIC_KV_REST_API_URL
  delete process.env.NEXT_PUBLIC_KV_REST_API_TOKEN
  redisMock.status = 'wait'
  redisMock.connect.mockReset().mockImplementation(async () => {
    redisMock.status = 'ready'
  })
  redisMock.on.mockReset()
  redisMock.once.mockReset()
  redisMock.off.mockReset()
  redisMock.set.mockReset()
  redisMock.incr.mockReset()
  redisMock.exec.mockReset().mockResolvedValue([[null, 'OK'], [null, 1]])
  redisMock.ttl.mockReset().mockResolvedValue(37)
  upstashMock.limit.mockReset().mockResolvedValue({ success: true, reset: Date.now() + 60_000 })
  upstashMock.slidingWindow.mockReset().mockReturnValue({})
  upstashMock.createLimiter.mockReset()
  upstashMock.createRedis.mockReset()
})

afterEach(() => {
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL
  else process.env.REDIS_URL = originalRedisUrl
  if (originalLocalFallback === undefined) delete process.env.RATE_LIMIT_ALLOW_LOCAL_FALLBACK
  else process.env.RATE_LIMIT_ALLOW_LOCAL_FALLBACK = originalLocalFallback
  if (originalKvUrl === undefined) delete process.env.NEXT_PUBLIC_KV_REST_API_URL
  else process.env.NEXT_PUBLIC_KV_REST_API_URL = originalKvUrl
  if (originalKvToken === undefined) delete process.env.NEXT_PUBLIC_KV_REST_API_TOKEN
  else process.env.NEXT_PUBLIC_KV_REST_API_TOKEN = originalKvToken
  vi.unstubAllEnvs()
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

  it('fails closed in production when Redis is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.REDIS_URL
    delete process.env.RATE_LIMIT_ALLOW_LOCAL_FALLBACK
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test')

    const response = await enforceRateLimit(request, { name: 'production-test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(503)
    expect(response?.headers.get('retry-after')).toBe('15')
  })

  it('uses the local fallback in production only when explicitly enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.RATE_LIMIT_ALLOW_LOCAL_FALLBACK = 'true'
    delete process.env.REDIS_URL
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })
    const options = { name: 'production-fallback-test', limit: 1, windowMs: 60_000 }

    expect(await enforceRateLimit(request, options)).toBeNull()
    expect((await enforceRateLimit(request, options))?.status).toBe(429)
  })

  it('uses Redis transactions for shared counting and initializes expiry', async () => {
    redisMock.exec
      .mockResolvedValueOnce([[null, 'OK'], [null, 1]])
      .mockResolvedValueOnce([[null, null], [null, 2]])
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })
    const options = { name: 'test', limit: 2, windowMs: 60_000 }

    expect(await enforceRateLimit(request, options)).toBeNull()
    expect(await enforceRateLimit(request, options)).toBeNull()
    expect(redisMock.incr).toHaveBeenCalledTimes(2)
    expect(redisMock.incr).toHaveBeenCalledWith('fishfinder:ratelimit:test:198.51.100.10')
    expect(redisMock.set).toHaveBeenCalledTimes(2)
    expect(redisMock.set).toHaveBeenCalledWith('fishfinder:ratelimit:test:198.51.100.10', '0', 'EX', 60, 'NX')
  })

  it('uses separate Upstash keys for different rate limit names', async () => {
    process.env.NEXT_PUBLIC_KV_REST_API_URL = 'https://example.upstash.io'
    process.env.NEXT_PUBLIC_KV_REST_API_TOKEN = 'test-token'
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })

    await enforceRateLimit(request, { name: 'auth', limit: 10, windowMs: 60_000 })
    await enforceRateLimit(request, { name: 'weather', limit: 10, windowMs: 60_000 })

    expect(upstashMock.limit).toHaveBeenNthCalledWith(1, 'auth:198.51.100.10')
    expect(upstashMock.limit).toHaveBeenNthCalledWith(2, 'weather:198.51.100.10')
  })

  it('uses Upstash in production when Redis is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.REDIS_URL
    process.env.NEXT_PUBLIC_KV_REST_API_URL = 'https://example.upstash.io'
    process.env.NEXT_PUBLIC_KV_REST_API_TOKEN = 'test-token'
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test')

    const response = await enforceRateLimit(request, { name: 'upstash-only', limit: 1, windowMs: 60_000 })

    expect(response).toBeNull()
    expect(upstashMock.limit).toHaveBeenCalledWith('upstash-only:unknown')
    expect(redisMock.exec).not.toHaveBeenCalled()
    expect(upstashMock.createRedis).toHaveBeenCalledWith(expect.objectContaining({
      retry: false,
      signal: expect.any(Function),
    }))
  })

  it('fails closed with 503 when Upstash reports a timeout', async () => {
    process.env.NEXT_PUBLIC_KV_REST_API_URL = 'https://example.upstash.io'
    process.env.NEXT_PUBLIC_KV_REST_API_TOKEN = 'test-token'
    upstashMock.limit.mockResolvedValueOnce({ success: true, reason: 'timeout', reset: Date.now() + 60_000 })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test')

    const response = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(503)
    expect(response?.headers.get('retry-after')).toBe('15')
    expect(redisMock.exec).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when Upstash is unavailable', async () => {
    process.env.NEXT_PUBLIC_KV_REST_API_URL = 'https://example.upstash.io'
    process.env.NEXT_PUBLIC_KV_REST_API_TOKEN = 'test-token'
    upstashMock.limit.mockRejectedValueOnce(new Error('Upstash unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test')

    const response = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(503)
    expect(response?.headers.get('retry-after')).toBe('15')
    expect(redisMock.exec).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when Upstash initialization fails', async () => {
    process.env.NEXT_PUBLIC_KV_REST_API_URL = 'https://example.upstash.io'
    process.env.NEXT_PUBLIC_KV_REST_API_TOKEN = 'test-token'
    upstashMock.createRedis.mockImplementationOnce(() => {
      throw new Error('Invalid Upstash configuration')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test')

    const response = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(503)
    expect(response?.headers.get('retry-after')).toBe('15')
    expect(redisMock.exec).not.toHaveBeenCalled()
  })

  it('ignores client-supplied forwarded IPs in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { enforceRateLimit } = await import('./security')
    const options = { name: 'production-forwarded-test', limit: 2, windowMs: 60_000 }

    await enforceRateLimit(new Request('https://example.com/api/test', {
      headers: { 'x-forwarded-for': '198.51.100.10' },
    }), options)
    await enforceRateLimit(new Request('https://example.com/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.25' },
    }), options)

    expect(redisMock.incr).toHaveBeenNthCalledWith(1, 'fishfinder:ratelimit:production-forwarded-test:unknown')
    expect(redisMock.incr).toHaveBeenNthCalledWith(2, 'fishfinder:ratelimit:production-forwarded-test:unknown')
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
    redisMock.exec.mockResolvedValueOnce([[null, null], [null, 2]])
    const { enforceRateLimit } = await import('./security')
    const request = new Request('https://example.com/api/test', { headers: { 'x-real-ip': '198.51.100.10' } })

    const response = await enforceRateLimit(request, { name: 'test', limit: 1, windowMs: 60_000 })

    expect(response?.status).toBe(429)
    expect(response?.headers.get('retry-after')).toBe('37')
    expect(redisMock.ttl).toHaveBeenCalledWith('fishfinder:ratelimit:test:198.51.100.10')
  })
})
