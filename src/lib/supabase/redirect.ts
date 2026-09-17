const ALLOWED_ORIGINS = new Set([
  'https://www.fishfinder-pro.online',
  'https://fishfinder-pro.online',
  'http://localhost:3000',
])

const RESET_NEXT_PATH = '/auth/reset?mode=update'

export function getSafeNextPath(value: string | null | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function getAuthCallbackUrl(origin: string) {
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin
  const safe = ALLOWED_ORIGINS.has(base) ? base : 'https://www.fishfinder-pro.online'
  return safe + '/auth/callback'
}

export function getPasswordResetRedirectTo(origin: string) {
  return getAuthCallbackUrl(origin) + '?next=' + encodeURIComponent(RESET_NEXT_PATH)
}

export function shouldFollowUpPasswordSignIn(
  mode: 'login' | 'signup',
  session: { access_token?: string } | null | undefined,
) {
  return mode === 'signup' && !session?.access_token
}
