import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, methodNotAllowed, requestBodyTooLarge, tooLarge } from '@/lib/security'
import {
  getSafeNextPath,
  isAllowedAuthRequestOrigin,
  shouldFollowUpPasswordSignIn,
} from '../../../lib/supabase/redirect'

const authSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.enum(['login', 'signup']),
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(256),
    fullName: z.string().trim().max(100).optional().default(''),
    redirectTo: z.string().url().optional(),
  }).strict(),
  z.object({
    mode: z.literal('forgot-password'),
    email: z.string().trim().email().max(254),
    redirectTo: z.string().url().optional(),
  }).strict(),
])

function safeRedirectTo(value: string | undefined, requestUrl: URL) {
  if (!value) return undefined
  let redirect: URL
  try {
    redirect = new URL(value)
  } catch {
    return undefined
  }

  if (redirect.origin !== requestUrl.origin || redirect.pathname !== '/auth/callback') {
    return undefined
  }

  const next = redirect.searchParams.get('next')
  const safeNext = getSafeNextPath(next)
  if (next && safeNext !== next) {
    return undefined
  }

  const callbackUrl = new URL('/auth/callback', requestUrl.origin)
  if (safeNext !== '/') {
    callbackUrl.searchParams.set('next', safeNext)
  }
  return callbackUrl.toString()
}

function hasSession(data: unknown): data is { session: unknown } {
  return typeof data === 'object' && data !== null && 'session' in data
}

export async function POST(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  if (requestBodyTooLarge(request, 8_192)) return tooLarge()
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  if (!isAllowedAuthRequestOrigin(origin, requestUrl, request.headers.get('sec-fetch-site'))) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const rateLimited = enforceRateLimit(request, { limit: 10, windowMs: 60_000, name: 'auth' })
  if (rateLimited) return rateLimited

  try {
    const raw = await request.json().catch(() => null)
    if (raw === null) return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 })
    const parsed = authSchema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid authentication details.' }, { status: 400 })
    const { email, mode } = parsed.data
    const redirectTo = safeRedirectTo(parsed.data.redirectTo, requestUrl)

    if ((mode === 'signup' || mode === 'login') && parsed.data.password.length < (mode === 'signup' ? 8 : 1)) {
      return NextResponse.json({ error: 'Invalid authentication details.' }, { status: 400 })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 })
    }

    if (mode === 'forgot-password') {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        ...(redirectTo ? { redirectTo } : {}),
      })

      if (result.error) {
        const message = result.error.message.toLowerCase()
        if (message.includes('rate')) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
        return NextResponse.json({ sent: true })
      }

      return NextResponse.json({ sent: true })
    }

    if (mode === 'signup') {
      const signup = await supabase.auth.signUp({
        email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.fullName || null },
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        },
      })

      if (signup.error) {
        const message = signup.error.message.toLowerCase()
        const safeError = message.includes('confirm')
          ? 'Please confirm your email before logging in.'
          : message.includes('rate')
            ? 'Too many attempts. Please try again later.'
            : 'Unable to create the account. Check your details and try again.'
        return NextResponse.json({ error: safeError }, { status: 400 })
      }

      let confirmed = hasSession(signup.data) && Boolean(signup.data.session)
      let confirmationRequired = false

      if (shouldFollowUpPasswordSignIn(mode, hasSession(signup.data) ? signup.data.session as { access_token?: string } | null | undefined : undefined)) {
        const followUp = await supabase.auth.signInWithPassword({ email, password: parsed.data.password })
        if (followUp.error) {
          confirmationRequired = followUp.error.message.toLowerCase().includes('confirm')
        } else {
          confirmed = hasSession(followUp.data) && Boolean(followUp.data.session)
        }
      }

      return NextResponse.json(
        confirmed
          ? { confirmed: true }
          : { confirmed: false, confirmationRequired },
      )
    }

    const result = await supabase.auth.signInWithPassword({ email, password: parsed.data.password })
    if (result.error) {
      const message = result.error.message.toLowerCase()
      const safeError = message.includes('confirm')
        ? 'Please confirm your email before logging in.'
        : message.includes('rate')
          ? 'Too many attempts. Please try again later.'
          : 'Invalid email or password.'
      return NextResponse.json({ error: safeError }, { status: 400 })
    }

    const confirmed = hasSession(result.data) && Boolean(result.data.session)
    return NextResponse.json({ confirmed })
  } catch (error) {
    console.error('[auth] Auth route failure:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 })
  }
}
