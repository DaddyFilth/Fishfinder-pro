'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { APP_ROLES, ROLE_LABELS, type AppRole } from '@/lib/auth/roles'

type UserProfile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  role: AppRole
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Unable to load users.')
      setUsers(body.users ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch synchronizes the page with the server-backed admin list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers()
  }, [])

  async function changeRole(userId: string, role: AppRole) {
    setSavingId(userId)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Unable to update role.')
      setUsers((current) => current.map((user) => user.id === userId ? body.user : user))
      setNotice('Role updated.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update role.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <Link href="/account" style={backLinkStyle}>← Back to profile</Link>
        <div style={{ marginTop: '26px', marginBottom: '22px' }}>
          <div style={eyebrowStyle}>Administrator tools</div>
          <h1 style={headingStyle}>User management</h1>
          <p style={mutedStyle}>Manage account roles. Authorization is enforced again by the server for every change.</p>
        </div>

        {loading && <div style={mutedStyle}>Loading users…</div>}
        {!loading && error && <div role="alert" style={noticeStyle('#7f1d1d', '#fecaca')}>{error}</div>}
        {notice && <div role="status" style={noticeStyle('#064e3b', '#bbf7d0')}>{notice}</div>}
        {!loading && !error && users.length === 0 && <div style={mutedStyle}>No profiles found. Run the Supabase schema and create an account first.</div>}

        {!loading && !error && users.length > 0 && (
          <div style={{ display: 'grid', gap: '8px' }}>
            {users.map((user) => (
              <article key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '50%' }} /> : <div style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#164e63', color: '#a5f3fc', fontSize: '15px', fontWeight: 800 }}>{(user.full_name || user.username || 'A').slice(0, 1).toUpperCase()}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '13px' }}>{user.full_name || user.username || 'Unnamed angler'}</div>
                  <div style={{ color: '#64748b', fontSize: '10px', marginTop: '3px' }}>{user.username ? `@${user.username}` : 'No username'} · joined {new Date(user.created_at).toLocaleDateString()}</div>
                </div>
                <select aria-label={`Role for ${user.full_name || user.username || user.id}`} value={user.role} disabled={savingId === user.id} onChange={(event) => changeRole(user.id, event.target.value as AppRole)} style={selectStyle}>
                  {APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

const pageStyle = { minHeight: '100dvh', background: '#030712', color: '#e2e8f0', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }
const cardStyle = { width: '100%', maxWidth: '700px', boxSizing: 'border-box' as const, background: 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(7,15,30,0.98))', border: '1px solid #1e293b', borderRadius: '20px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }
const backLinkStyle = { color: '#7dd3fc', fontSize: '12px', textDecoration: 'none' }
const eyebrowStyle = { color: '#fbbf24', fontSize: '12px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const }
const headingStyle = { margin: '8px 0', fontSize: '30px', lineHeight: 1.1, color: '#f8fafc' }
const mutedStyle = { margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }
const selectStyle = { border: '1px solid #334155', borderRadius: '8px', background: '#0f172a', color: '#e2e8f0', padding: '8px', fontSize: '11px' }
const noticeStyle = (background: string, color: string) => ({ background, color, borderRadius: '8px', padding: '10px 12px', fontSize: '12px', lineHeight: 1.45, marginBottom: '14px' })
