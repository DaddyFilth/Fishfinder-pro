import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getAuthContextMock = vi.fn()
const getSupabaseAdminMock = vi.fn()

vi.mock('@/lib/auth/server', () => ({
  getAuthContext: () => getAuthContextMock(),
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}))

const { DELETE } = await import('./route')

function makeDeleteRequest(body: unknown, origin = 'http://localhost') {
  return new NextRequest('http://localhost/api/profile', {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      origin,
      host: 'localhost',
    },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/profile self-service account deletion', () => {
  beforeEach(() => {
    getAuthContextMock.mockReset()
    getSupabaseAdminMock.mockReset()
  })

  it('rejects cross-site DELETE requests with 403', async () => {
    const res = await DELETE(makeDeleteRequest({ confirm: 'DELETE' }, 'https://evil.example'))
    expect(res.status).toBe(403)
  })

  it('requires authentication', async () => {
    getAuthContextMock.mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest({ confirm: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  it('requires explicit { confirm: "DELETE" } confirmation payload', async () => {
    getAuthContextMock.mockResolvedValue({
      user: { id: 'user-1', email: 'angler@example.com' },
      role: 'angler',
      supabase: { auth: { signOut: vi.fn() } },
    })
    const res = await DELETE(makeDeleteRequest({ confirm: 'yes' }))
    expect(res.status).toBe(400)
  })

  it('prevents deleting the final administrator account', async () => {
    getAuthContextMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com' },
      role: 'admin',
      supabase: { auth: { signOut: vi.fn() } },
    })
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: async () => ({ count: 1, error: null }),
        }),
      }),
    })

    const res = await DELETE(makeDeleteRequest({ confirm: 'DELETE' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('final administrator'),
    })
  })

  it('cleans up private photos, deletes the auth user, and signs out the session', async () => {
    const signOutMock = vi.fn().mockResolvedValue({})
    const removeMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const deleteUserMock = vi.fn().mockResolvedValue({ data: {}, error: null })
    const insertAuditMock = vi.fn().mockResolvedValue({ error: null })

    getAuthContextMock.mockResolvedValue({
      user: { id: 'user-42', email: 'angler@example.com' },
      role: 'angler',
      supabase: { auth: { signOut: signOutMock } },
    })
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: () => ({
          list: async () => ({ data: [{ name: 'bass.jpg' }], error: null }),
          remove: removeMock,
        }),
      },
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
      from: () => ({
        insert: insertAuditMock,
      }),
    })

    const res = await DELETE(makeDeleteRequest({ confirm: 'DELETE' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ deleted: true })
    expect(removeMock).toHaveBeenCalledWith(['user-42/bass.jpg'])
    expect(deleteUserMock).toHaveBeenCalledWith('user-42')
    expect(signOutMock).toHaveBeenCalledOnce()
  })
})
