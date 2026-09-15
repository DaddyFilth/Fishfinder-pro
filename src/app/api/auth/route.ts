import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimit, methodNotAllowed, requestBodyTooLarge, tooLarge } from '@/lib/security'

const authSchema = z.object({
  mode: z.enum(['login', 'signup']),
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
  fullName: z.string().trim().max(100).optional().default(''),
  redirectTo: z.string().url().optional(),
}).strict()

const CANONICAL_ORIGIN = 'https://www.fishfinder-pro.online'

export async function POST(request: Request) {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  if (requestBodyTooLarge(request, 8_192)) return tooLarge()
  const origin = request.headers.get('origin')
  if (origin && origin !== CANONICAL_ORIGIN) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const rateLimited = enforceRateLimit(request, { limit: 10, windowMs: 60_000, name: 'auth' })
  if (rateLimited) return rateLimited

  try {
    const parsed = authSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid authentication details.' }, { status: 400 })
    const { email, password, mode, fullName } = parsed.data
    const redirectTo = parsed.data.redirectTo === `${CANONICAL_ORIGIN}/auth/callback` || parsed.data.redirectTo?.startsWith(`${CANONICAL_ORIGIN}/auth/callback?`) ? parsed.data.redirectTo : undefined

    if (mode === 'signup' && password.length < 8) {
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
  } catch {
    return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 503 })
  }
}
