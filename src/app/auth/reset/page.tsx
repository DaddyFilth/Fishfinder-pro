'use client'

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
      return
    }

    setBusy(true)

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
      </section>
    </main>
  )
}
