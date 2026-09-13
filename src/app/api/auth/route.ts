import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const mode = body.mode === 'signup' ? 'signup' : 'login'
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined

    if (!email || !password || (mode === 'signup' && password.length < 8)) {
      return NextResponse.json({ error: 'Invalid authentication details.' }, { status: 400 })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 })
    }

    const result = mode === 'signup'
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || null },
            ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          },
        })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) {
      const message = result.error.message.toLowerCase()
      const safeError = message.includes('confirm')
        ? 'Please confirm your email before logging in.'
        : message.includes('rate')
          ? 'Too many attempts. Please try again later.'
          : mode === 'login'
            ? 'Invalid email or password.'
            : 'Unable to create the account. Check your details and try again.'
      return NextResponse.json({ error: safeError }, { status: 400 })
    }

    return NextResponse.json({ confirmed: Boolean(result.data.session) })
  } catch (error) {
    console.error('[v0] Auth route failure:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 })
  }
}
