import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
  methodNotAllowed: vi.fn(),
  readJsonBody: vi.fn(async (request: Request) => ({ ok: true, value: await request.json() })),
}))

const createClientMock = vi.mocked(createClient)

function loginRequest() {
  return new Request('https://fishfinder-pro.online/api/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({
      mode: 'login',
      email: 'angler@example.com',
      password: 'secret',
    }),
  })
}

function previewLoginRequest(origin = 'https://fishfinder-pro-git-feature.vercel.app') {
  return new Request('https://fishfinder-pro-git-feature.vercel.app/api/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({
      mode: 'login',
      email: 'angler@example.com',
      password: 'secret',
    }),
  })
}

function signupRequest(body: Record<string, unknown> = {}) {
  return new Request('https://fishfinder-pro.online/api/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({
      mode: 'signup',
      email: 'angler@example.com',
      password: 'very-secret',
      fullName: 'River Runner',
      ...body,
    }),
  })
}

function mockLoginResult(data: unknown) {
  createClientMock.mockResolvedValue({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn().mockResolvedValue({ data, error: null }),
      resetPasswordForEmail: vi.fn(),
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

  it('accepts preview deployment origins for login requests', async () => {
    mockLoginResult({ session: { access_token: 'test-token' } })

    const response = await POST(previewLoginRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ confirmed: true })
  })
})

describe('POST /api/auth signup follow-up sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs the user in when signup succeeds without an initial session', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    })
    createClientMock.mockResolvedValue({
      auth: {
        signUp,
        signInWithPassword,
        resetPasswordForEmail: vi.fn(),
      },
    } as never)

    const response = await POST(signupRequest())

    expect(signUp).toHaveBeenCalledWith({
      email: 'angler@example.com',
      password: 'very-secret',
      options: {
        data: { full_name: 'River Runner' },
      },
    })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'angler@example.com',
      password: 'very-secret',
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ confirmed: true })
  })

  it('keeps the email confirmation flow when follow-up sign-in requires confirmation', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'Email not confirmed' },
    })
    createClientMock.mockResolvedValue({
      auth: {
        signUp,
        signInWithPassword,
        resetPasswordForEmail: vi.fn(),
      },
    } as never)

    const response = await POST(signupRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      confirmed: false,
      confirmationRequired: true,
    })
  })

  it('passes callback next paths through signup redirects', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    })
    createClientMock.mockResolvedValue({
      auth: {
        signUp,
        signInWithPassword: vi.fn(),
        resetPasswordForEmail: vi.fn(),
      },
    } as never)

    const response = await POST(signupRequest({
      redirectTo: 'https://fishfinder-pro.online/auth/callback?next=%2Faccount',
    }))

    expect(signUp).toHaveBeenCalledWith({
      email: 'angler@example.com',
      password: 'very-secret',
      options: {
        data: { full_name: 'River Runner' },
        emailRedirectTo: 'https://fishfinder-pro.online/auth/callback?next=%2Faccount',
      },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ confirmed: true })
  })

  it('rejects unsafe callback next paths from redirectTo payloads', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    })
    createClientMock.mockResolvedValue({
      auth: {
        signUp,
        signInWithPassword: vi.fn(),
        resetPasswordForEmail: vi.fn(),
      },
    } as never)

    const response = await POST(signupRequest({
      redirectTo: 'https://fishfinder-pro.online/auth/callback?next=%2F%5Cevil',
    }))

    expect(signUp).toHaveBeenCalledWith({
      email: 'angler@example.com',
      password: 'very-secret',
      options: {
        data: { full_name: 'River Runner' },
      },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ confirmed: true })
  })
})
