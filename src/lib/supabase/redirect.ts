const DEFAULT_AUTH_ORIGIN = 'https://www.fishfinder-pro.online'
const RESET_NEXT_PATH = '/auth/reset?mode=update'

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function isPreviewHost(hostname: string) {
  return hostname.endsWith('.vercel.app') || hostname.endsWith('.vercel.run')
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value?.trim()) return null

  try {
    const parsed = new URL(value)
    if (isLoopbackHost(parsed.hostname)) {
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null
    }

    return parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

export function getSafeNextPath(value: string | null | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/'
}

export function isAllowedAuthRequestOrigin(
  origin: string | null,
  requestUrl: URL,
  secFetchSite?: string | null,
) {
  if (!origin) return true

  let requestOrigin: URL
  try {
    requestOrigin = new URL(origin)
  } catch {
    return false
  }

  if (origin === requestUrl.origin) return true

  const comparableHost = (hostname: string) => isLoopbackHost(hostname) || isPreviewHost(hostname)
  const samePreviewOrigin = (
    requestOrigin.protocol === requestUrl.protocol &&
    comparableHost(requestUrl.hostname) &&
    comparableHost(requestOrigin.hostname)
  )

  return samePreviewOrigin || secFetchSite === 'same-origin'
}

export function getAuthCallbackUrl(origin: string, next?: string | null) {
  const safe = normalizeOrigin(origin) ?? DEFAULT_AUTH_ORIGIN
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
