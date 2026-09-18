import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/redirect', () => ({
  getSafeNextPath: (value: string | null | undefined) =>
    value && value.startsWith('/') && !value.startsWith('//') ? value : '/',
}))

const createClientMock = vi.mocked(createClient)

function mockAuthClient() {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null })
  const verifyOtp = vi.fn().mockResolvedValue({ error: null })
  createClientMock.mockResolvedValue({
    auth: {
      exchangeCodeForSession,
      verifyOtp,
    },
  } as never)
  return { exchangeCodeForSession, verifyOtp }
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exchanges auth code when provided', async () => {
    const auth = mockAuthClient()

    const response = await GET(
      new Request('https://www.fishfinder-pro.online/auth/callback?code=auth-code&next=%2Faccount'),
    )

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://www.fishfinder-pro.online/account')
  })

  it('verifies OTP token_hash for recovery links', async () => {
    const auth = mockAuthClient()

    const response = await GET(
      new Request('https://www.fishfinder-pro.online/auth/callback?token_hash=test-hash&type=recovery&next=%2Fauth%2Freset%3Fmode%3Dupdate'),
    )

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'test-hash',
      type: 'recovery',
    })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://www.fishfinder-pro.online/auth/reset?mode=update')
  })

  it('ignores unsafe next values', async () => {
    const auth = mockAuthClient()

    const response = await GET(
      new Request('https://www.fishfinder-pro.online/auth/callback?code=auth-code&next=https%3A%2F%2Fevil.example'),
    )

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(response.headers.get('location')).toBe('https://www.fishfinder-pro.online/')
  })
})
