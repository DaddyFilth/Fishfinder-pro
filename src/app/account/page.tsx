'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ROLE_LABELS, type AppRole } from '@/lib/auth/roles'

type Profile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  role: AppRole
  created_at: string
}

type ProfileResponse = {
  profile: Profile
  email: string | null
  role: AppRole
}

export default function AccountPage() {
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'success' } | null>(null)

  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Sign in to manage your profile.')
        return body as ProfileResponse
      })
      .then((result) => {
        setData(result)
        setUsername(result.profile.username ?? '')
        setFullName(result.profile.full_name ?? '')
        setAvatarUrl(result.profile.avatar_url ?? '')
      })
      .catch((error) => setMessage({ text: error instanceof Error ? error.message : 'Unable to load profile.', kind: 'error' }))
      .finally(() => setLoading(false))
  }, [])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || null,
          full_name: fullName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Unable to save profile.')
      setData((current) => current ? { ...current, profile: body.profile, role: body.role } : current)
      setMessage({ text: 'Profile saved.', kind: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to save profile.', kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <Link href="/" style={backLinkStyle}>← Back to FishFinder Pro</Link>
        <div style={{ marginTop: '26px', marginBottom: '22px' }}>
          <div style={eyebrowStyle}>Your account</div>
          <h1 style={headingStyle}>Profile settings</h1>
          <p style={mutedStyle}>Manage the identity shown alongside your catches and fishing activity.</p>
        </div>

        {loading && <div style={mutedStyle}>Loading profile…</div>}
        {!loading && !data && (
          <div style={noticeStyle('#7f1d1d', '#fecaca')}>
            <div>{message?.text || 'Sign in to manage your profile.'}</div>
            <Link href="/auth/login?next=/account" style={{ ...buttonStyle, display: 'inline-flex', marginTop: '14px', textDecoration: 'none' }}>Log in</Link>
          </div>
        )}

        {data && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#020617', border: '1px solid #1e293b', borderRadius: '12px', marginBottom: '20px' }}>
              {data.profile.avatar_url ? <img src={data.profile.avatar_url} alt="Profile avatar" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #0e7490' }} /> : <div style={{ width: '52px', height: '52px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#164e63', color: '#a5f3fc', fontSize: '20px', fontWeight: 800 }}>{(data.profile.full_name || data.email || 'A').slice(0, 1).toUpperCase()}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>{data.profile.full_name || data.profile.username || 'FishFinder angler'}</div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.email}</div>
              </div>
              <span style={roleBadgeStyle(data.role)}>{ROLE_LABELS[data.role]}</span>
            </div>

            <form onSubmit={saveProfile}>
              <label style={labelStyle}>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} autoComplete="name" style={inputStyle} /></label>
              <label style={labelStyle}>Username<input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={32} pattern="[A-Za-z0-9_]+" autoComplete="username" placeholder="angler_123" style={inputStyle} /><span style={hintStyle}>Letters, numbers, and underscores only.</span></label>
              <label style={labelStyle}>Avatar URL <span style={{ color: '#64748b' }}>(optional)</span><input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} type="url" maxLength={500} placeholder="https://…" style={inputStyle} /></label>
              {message && <div role={message.kind === 'error' ? 'alert' : 'status'} style={noticeStyle(message.kind === 'error' ? '#7f1d1d' : '#064e3b', message.kind === 'error' ? '#fecaca' : '#bbf7d0')}>{message.text}</div>}
              <button type="submit" disabled={saving} style={{ ...buttonStyle, width: '100%', cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Saving…' : 'Save profile'}</button>
            </form>

            {data.role === 'admin' && <Link href="/admin/users" style={{ display: 'block', marginTop: '18px', color: '#7dd3fc', fontSize: '13px', textDecoration: 'none' }}>Open user management →</Link>}
          </>
        )}
      </section>
    </main>
  )
}

const pageStyle = { minHeight: '100dvh', background: '#030712', color: '#e2e8f0', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }
const cardStyle = { width: '100%', maxWidth: '560px', boxSizing: 'border-box' as const, background: 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(7,15,30,0.98))', border: '1px solid #1e293b', borderRadius: '20px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }
const backLinkStyle = { color: '#7dd3fc', fontSize: '12px', textDecoration: 'none' }
const eyebrowStyle = { color: '#22d3ee', fontSize: '12px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const }
const headingStyle = { margin: '8px 0', fontSize: '30px', lineHeight: 1.1, color: '#f8fafc' }
const mutedStyle = { margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }
const labelStyle = { display: 'block', marginBottom: '14px', color: '#cbd5e1', fontSize: '12px' }
const hintStyle = { display: 'block', marginTop: '5px', color: '#64748b', fontSize: '11px' }
const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, marginTop: '6px', border: '1px solid #334155', borderRadius: '9px', background: '#020617', color: '#f8fafc', padding: '11px 12px', outline: 'none' }
const buttonStyle = { border: 0, borderRadius: '10px', padding: '12px 14px', background: 'linear-gradient(90deg, #0891b2, #0284c7)', color: '#f0f9ff', fontWeight: 800, cursor: 'pointer' }
const noticeStyle = (background: string, color: string) => ({ background, color, borderRadius: '8px', padding: '10px 12px', fontSize: '12px', lineHeight: 1.45, marginBottom: '14px' })
const roleBadgeStyle = (role: AppRole) => ({ background: role === 'admin' ? '#713f12' : role === 'moderator' ? '#164e63' : '#14532d', color: role === 'admin' ? '#fde68a' : role === 'moderator' ? '#a5f3fc' : '#bbf7d0', borderRadius: '999px', padding: '5px 9px', fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' as const })
