import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSafeNextPath } from '@/lib/supabase/redirect'

const OTP_TYPES = new Set([
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'email',
])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const next = getSafeNextPath(url.searchParams.get('next'))
  const otpType = type && OTP_TYPES.has(type) ? (type as EmailOtpType) : null

  let authFailed = false
  if (code || (tokenHash && otpType)) {
    const supabase = await createClient()
    if (supabase) {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        authFailed = Boolean(error)
      } else if (tokenHash && otpType) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        })
        authFailed = Boolean(error)
      }
    }
  }

  if (authFailed) {
    const fallbackPath = otpType === 'recovery'
      ? '/auth/reset?error=invalid-link'
      : '/auth/login?error=auth-callback'
    return NextResponse.redirect(new URL(fallbackPath, url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
