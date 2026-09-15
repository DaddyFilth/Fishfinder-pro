import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, methodNotAllowed, requestBodyTooLarge, tooLarge } from '@/lib/security'

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
  const redirect = new URL(value)
  return redirect.origin === requestUrl.origin && redirect.pathname === '/auth/callback' ? value : undefined
}


export async function POST(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  if (requestBodyTooLarge(request, 8_192)) return tooLarge()
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('origin')
  // Accept same-origin requests in local, preview, and production environments.
  // Cross-site requests are rejected without relying on a mutable allowlist.
  if (origin && origin !== requestUrl.origin) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const rateLimited = enforceRateLimit(request, { limit: 10, windowMs: 60_000, name: 'auth' })
  if (rateLimited) return rateLimited

  try {
    const parsed = authSchema.safeParse(await request.json())
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

    const result = mode === 'forgot-password'
      ? await supabase.auth.resetPasswordForEmail(email, {
          ...(redirectTo ? { redirectTo } : {}),
        })
      : mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password: parsed.data.password,
            options: {
              data: { full_name: parsed.data.fullName || null },
              ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
            },
          })
        : await supabase.auth.signInWithPassword({ email, password: parsed.data.password })

    if (result.error) {
      if (mode === 'forgot-password') {
        const message = result.error.message.toLowerCase()
        if (message.includes('rate')) return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
        return NextResponse.json({ sent: true })
      }

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

    return mode === 'forgot-password'
      ? NextResponse.json({ sent: true })
      : NextResponse.json({ confirmed: 'session' in result.data && Boolean(result.data.session) })
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 })
  }
}
