'use client'

<<<<<<< HEAD
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      const timer = window.setTimeout(() => {
        setError('Authentication service is not configured.')
      }, 0)
      return () => window.clearTimeout(timer)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const supabase = createClient()
    if (!supabase) {
      setError('Authentication service is not configured.')
=======
import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const isRecoverySession = Boolean(searchParams.get('code')) || searchParams.get('mode') === 'update'

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('Enter the email address for your account.')
>>>>>>> origin/v0/ux-flow-overhaul
      return
    }

    setBusy(true)
<<<<<<< HEAD

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('The reset link is invalid or expired. Request a new one.')
    } else {
      setMessage('Password updated. Redirecting to login...')
      window.setTimeout(() => router.replace('/auth/login'), 1200)
    }

    setBusy(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reset-title">
        <p className="eyebrow">FishFinder Pro</p>
        <h1 id="reset-title">Choose a new password</h1>
        <p className="auth-copy">
          Use at least 8 characters. You can return to the app after saving.
        </p>

        {!ready && !error && (
          <p role="status">Validating your reset link...</p>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="auth-success" role="status">
            {message}
          </p>
        )}

        {ready && (
          <form onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>

            <button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Update password'}
            </button>
          </form>
        )}
=======
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'forgot-password',
          email: email.trim(),
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/reset?mode=update')}`,
        }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to send the reset email.')
      setSent(true)
      setMessage('If an account exists for that email, a password reset link is on its way.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send the reset email.')
    } finally {
      setBusy(false)
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    const supabase = createClient()
    if (!supabase) {
      setError('Authentication service unavailable.')
      return
    }

    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) {
      setError('This reset link is invalid or has expired. Request a new one.')
      return
    }
    setMessage('Your password has been updated. You can now log in.')
    setTimeout(() => router.replace('/auth/login'), 900)
  }

  const showUpdateForm = isRecoverySession || searchParams.get('mode') === 'update'

  return (
    <main style={{ minHeight: '100dvh', background: '#030712', color: '#e2e8f0', display: 'grid', placeItems: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: '430px', background: 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(7,15,30,0.98))', border: '1px solid #1e293b', borderRadius: '20px', padding: '28px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
        <Link href="/auth/login" style={{ color: '#7dd3fc', fontSize: '12px', textDecoration: 'none' }}>← Back to login</Link>
        <div style={{ marginTop: '28px', marginBottom: '24px' }}>
          <div style={{ color: '#22d3ee', fontSize: '12px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>FishFinder Pro</div>
          <h1 style={{ margin: '8px 0', fontSize: '30px', lineHeight: 1.1, color: '#f8fafc' }}>{showUpdateForm ? 'Choose a new password' : 'Reset your password'}</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>{showUpdateForm ? 'Use a strong password you have not used elsewhere.' : 'We will send a secure reset link if the account exists.'}</p>
        </div>

        <form onSubmit={showUpdateForm ? updatePassword : requestReset} noValidate>
          {!showUpdateForm && <label style={labelStyle}>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" style={inputStyle} /></label>}
          {showUpdateForm && <>
            <label style={labelStyle}>New password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} required placeholder="At least 8 characters" style={inputStyle} /></label>
            <label style={labelStyle}>Confirm new password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} required placeholder="Repeat your password" style={inputStyle} /></label>
          </>}
          {error && <div role="alert" style={messageStyle('#7f1d1d', '#fecaca')}>{error}</div>}
          {message && <div role="status" style={messageStyle('#064e3b', '#bbf7d0')}>{message}</div>}
          {!showUpdateForm && sent && <p style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>Check your inbox and spam folder. You can request another link if needed.</p>}
          <button type="submit" disabled={busy} style={{ width: '100%', border: 0, borderRadius: '10px', padding: '12px 14px', background: busy ? '#164e63' : 'linear-gradient(90deg, #0891b2, #0284c7)', color: '#f0f9ff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', marginTop: '6px' }}>{busy ? 'Working…' : showUpdateForm ? 'Update password' : sent ? 'Send another link' : 'Send reset link'}</button>
        </form>
>>>>>>> origin/v0/ux-flow-overhaul
      </section>
    </main>
  )
}
<<<<<<< HEAD
=======

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', background: '#030712' }} />}> 
      <ResetPasswordContent />
    </Suspense>
  )
}

const labelStyle = { display: 'block', marginBottom: '14px', fontSize: '12px', color: '#cbd5e1' }
const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, marginTop: '6px', border: '1px solid #334155', borderRadius: '9px', background: '#020617', color: '#f8fafc', padding: '11px 12px', outline: 'none' }
const messageStyle = (background: string, color: string) => ({ background, color, borderRadius: '8px', padding: '10px 12px', fontSize: '12px', lineHeight: 1.45, marginBottom: '12px' })
>>>>>>> origin/v0/ux-flow-overhaul
