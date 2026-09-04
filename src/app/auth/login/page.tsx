'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/'
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 8) { setError('Your password must be at least 8 characters.'); return }
    setLoading(true)
    const supabase = createClient()
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() || undefined }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } })
    setLoading(false)
    if (result.error) { setError(result.error.message); return }
    if (mode === 'signup' && !result.data.session) { setMessage('Account created. Check your email to confirm your address, then come back to sign in.'); return }
    router.replace(next)
    router.refresh()
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">FishFinder Pro</div>
        <h1 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? 'Sign in to save your spots, catches, and preferences.' : 'Join FishFinder Pro and keep every trip in one place.'}</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /><span className="auth-hint">At least 8 characters</span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? 'New to FishFinder Pro? Create an account' : 'Already have an account? Sign in'}</button>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-page" />}><LoginForm /></Suspense>
}
