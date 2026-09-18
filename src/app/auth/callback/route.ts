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

  if (code || (tokenHash && otpType)) {
    const supabase = await createClient()
    if (supabase) {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else if (tokenHash && otpType) {
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        })
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
