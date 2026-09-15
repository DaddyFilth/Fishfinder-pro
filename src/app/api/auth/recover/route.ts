import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  enforceRateLimit,
  requestBodyTooLarge,
  tooLarge,
} from '@/lib/security'

const ALLOWED_ORIGINS = new Set([
  'https://fishfinder-pro.online',
  'https://www.fishfinder-pro.online',
  'http://localhost:3000',
])

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    name: 'auth-recovery',
    limit: 5,
    windowMs: 15 * 60_000,
  })
  if (limited) return limited

  if (requestBodyTooLarge(request, 4_096)) {
    return tooLarge()
  }

  const origin = request.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !email.includes('@') || email.length > 254) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentication service unavailable.' },
        { status: 503 },
      )
    }

    const redirectTo = 'https://www.fishfinder-pro.online/auth/reset'

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    return NextResponse.json({
      message: 'If an account exists for that email, a reset link has been sent.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to process the request right now.' },
      { status: 503 },
    )
  }
}
