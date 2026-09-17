'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSafeNextPath } from '@/lib/supabase/redirect'

type Mode = 'login' | 'signup'

const fieldStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '6px',
  border: '1px solid #334155',
  borderRadius: '9px',
  background: '#020617',
  color: '#f8fafc',
  padding: '11px 12px',
  outline: 'none',
} as const

function bannerStyle(background: string, color: string) {
  return {
    background,
    color,
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    lineHeight: 1.45,
    marginBottom: '12px',
  } as const
}

function mapAuthError(mode: Mode, message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return new Error('An account with this email already exists. Try logging in instead.')
  }
  return new Error(
    mode === 'login'
      ? 'Invalid email or password.'
      : 'Unable to create the account. Check your details and try again.',
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') return '/'
    return getSafeNextPath(new URLSearchParams(window.location.search).get('next'))
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!email.trim() || !password) {
      setErrorMessage('Enter an email address and password to continue.')
      return
    }
    if (mode === 'signup' && password.length < 8) {
      setErrorMessage('Use a password with at least 8 characters.')
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      if (!supabase) {
        throw new Error('Authentication is not configured. Please try again later.')
      }

      const redirectTo = `${window.location.origin}/auth/callback`

      if (mode === 'signup') {
        const created = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: fullName.trim() ? { full_name: fullName.trim() } : {},
            emailRedirectTo: redirectTo,
          },
        })
        if (created.error) throw mapAuthError('signup', created.error.message)

        if (!created.data.session) {
          const signedIn = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
          if (signedIn.error || !signedIn.data.session) {
            throw new Error('Account created. Log in with the same email and password.')
          }
        }
      } else {
        const signedIn = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signedIn.error) throw mapAuthError('login', signedIn.error.message)
      }

      router.replace(nextPath)
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#030712',
        color: '#e2e8f0',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(7,15,30,0.98))',
          border: '1px solid #1e293b',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        <Link href="/" style={{ color: '#7dd3fc', fontSize: '12px', textDecoration: 'none' }}>
          ← Back to SeamCast
        </Link>
        <div style={{ marginTop: '28px', marginBottom: '24px' }}>
          <div
            style={{
              color: '#22d3ee',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            SeamCast
          </div>
          <h1 style={{ margin: '8px 0 8px', fontSize: '30px', lineHeight: 1.1, color: '#f8fafc' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: 1.5 }}>
            {mode === 'login'
              ? 'Sign in to keep your fishing profile and logbook connected across devices.'
              : 'Save catches, preferences, and fishing plans to a persistent account.'}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Authentication mode"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            padding: '4px',
            background: '#020617',
            borderRadius: '10px',
            marginBottom: '22px',
          }}
        >
          {(['login', 'signup'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => {
                setMode(item)
                setErrorMessage('')
                setSuccessMessage('')
              }}
              style={{
                border: 0,
                borderRadius: '7px',
                padding: '9px 8px',
                background: mode === item ? '#075985' : 'transparent',
                color: mode === item ? '#e0f2fe' : '#64748b',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {item === 'login' ? 'Log in' : 'Create account'}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} noValidate>
          {mode === 'signup' ? (
            <label style={{ display: 'block', marginBottom: '14px', fontSize: '12px', color: '#cbd5e1' }}>
              Name <span style={{ color: '#64748b' }}>(optional)</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
                style={fieldStyle}
              />
            </label>
          ) : null}
          <label style={{ display: 'block', marginBottom: '14px', fontSize: '12px', color: '#cbd5e1' }}>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: 'block', marginBottom: '18px', fontSize: '12px', color: '#cbd5e1' }}>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              style={fieldStyle}
            />
          </label>
          {errorMessage ? (
            <div role="alert" style={bannerStyle('#7f1d1d', '#fecaca')}>
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div role="status" style={bannerStyle('#064e3b', '#bbf7d0')}>
              {successMessage}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              border: 0,
              borderRadius: '10px',
              padding: '12px 14px',
              background: busy ? '#164e63' : 'linear-gradient(90deg, #0891b2, #0284c7)',
              color: '#f0f9ff',
              fontWeight: 800,
              cursor: busy ? 'wait' : 'pointer',
              marginTop: '4px',
            }}
          >
            {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        {mode === 'login' ? (
          <Link
            href={`/auth/reset?email=${encodeURIComponent(email.trim())}`}
            style={{
              display: 'block',
              marginTop: '16px',
              color: '#7dd3fc',
              fontSize: '12px',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            Forgot your password?
          </Link>
        ) : null}
        <p style={{ margin: '18px 0 0', color: '#64748b', fontSize: '11px', lineHeight: 1.5 }}>
          Accounts are stored by Supabase Auth.
        </p>
      </section>
    </main>
  )
}
