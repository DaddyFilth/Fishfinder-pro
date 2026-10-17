export type Mode = 'login' | 'signup'

/**
 * Maps the auth route's response to user-facing copy. Rate limiting (429) is
 * distinct from the rate-limit backend being unavailable (503): a 503 used to
 * surface as "Too many attempts", which sent users chasing the wrong fix.
 */
export function mapAuthError(mode: Mode, message: string, status: number) {
  if (status === 429) {
    return new Error('Too many attempts. Please try again later.')
  }
  if (status === 503) {
    return new Error('Authentication is temporarily unavailable. Please try again in a minute.')
  }
  const lower = message.toLowerCase()
  if (lower.includes('confirm')) {
    return new Error('Please confirm your email before logging in.')
  }
  if (lower.includes('rate') || lower.includes('too many')) {
    return new Error('Too many attempts. Please try again later.')
  }
  if (mode === 'signup' && (lower.includes('already registered') || lower.includes('already exists'))) {
    return new Error('An account with this email already exists. Try logging in instead.')
  }
  return new Error(
    mode === 'login'
      ? 'Invalid email or password.'
      : 'Unable to create the account. Check your details and try again.',
  )
}
