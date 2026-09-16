import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
  methodNotAllowed: vi.fn(),
  requestBodyTooLarge: vi.fn(() => false),
  tooLarge: vi.fn(),
}))

const createClientMock = vi.mocked(createClient)

function loginRequest() {
  return new Request('https://fishfinder-pro.online/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'login',
      email: 'angler@example.com',
      password: 'secret',
    }),
  })
}

function mockLoginResult(data: unknown) {
  createClientMock.mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data, error: null }),
    },
  } as never)
}

describe('POST /api/auth login confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms a login when Supabase returns a session', async () => {
    mockLoginResult({ session: { access_token: 'test-token' } })

    const response = await POST(loginRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ confirmed: true })
  })

  it.each([
    ['a null session', { session: null }],
    ['an object without a session', {}],
    ['null data', null],
    ['undefined data', undefined],
    ['string data', 'unexpected'],
    ['numeric data', 42],
  ])('does not confirm a login for %s', async (_label, data) => {
    mockLoginResult(data)

    const response = await POST(loginRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ confirmed: false })
  })
})
