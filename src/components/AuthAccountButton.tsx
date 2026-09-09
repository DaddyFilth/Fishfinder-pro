'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient, hasSupabasePublicConfig } from '@/lib/supabase/client'

export default function AuthAccountButton() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(() => !hasSupabasePublicConfig())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data.user)
      setReady(true)
    }).catch(() => {
      if (mounted) setReady(true)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setReady(true)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const supabase = createClient()
    if (!supabase) return
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
  }

  if (!ready) return <span style={{ width: '62px', height: '28px' }} aria-hidden="true" />

  if (!user) {
    return (
      <Link href="/auth/login?next=/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px', padding: '0 10px', border: '1px solid #155e75', borderRadius: '8px', color: '#a5f3fc', background: 'rgba(8,47,73,0.72)', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
        Log in
      </Link>
    )
  }

  const label = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Link href="/account" title={user.email ?? undefined} style={{ maxWidth: '92px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#bae6fd', fontSize: '10px', textDecoration: 'none' }}>{label}</Link>
      <button type="button" onClick={signOut} disabled={busy} style={{ border: '1px solid #334155', borderRadius: '8px', background: 'transparent', color: '#94a3b8', padding: '5px 7px', fontSize: '10px', cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? '…' : 'Log out'}
      </button>
    </div>
  )
}
