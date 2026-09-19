const ALLOWED_ORIGINS = new Set([
  'https://www.fishfinder-pro.online',
  'https://fishfinder-pro.online',
  'http://localhost:3000',
])

const RESET_NEXT_PATH = '/auth/reset?mode=update'

export function getSafeNextPath(value: string | null | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/'
}

export function getAuthCallbackUrl(origin: string, next?: string | null) {
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin
  const safe = ALLOWED_ORIGINS.has(base) ? base : 'https://www.fishfinder-pro.online'
  const url = new URL('/auth/callback', safe)
  const nextPath = getSafeNextPath(next)
  if (nextPath !== '/') {
    url.searchParams.set('next', nextPath)
  }
  return url.toString()
}

export function getPasswordResetRedirectTo(origin: string) {
  const url = new URL(getAuthCallbackUrl(origin))
  url.searchParams.set('next', RESET_NEXT_PATH)
  return url.toString()
}

export function shouldFollowUpPasswordSignIn(
  mode: 'login' | 'signup',
  session: { access_token?: string } | null | undefined,
) {
  return mode === 'signup' && !session?.access_token
}
