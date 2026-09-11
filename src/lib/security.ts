import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export function enforceRateLimit(
  request: NextRequest,
  options: { limit: number; windowMs: number; name: string },
) {
  const now = Date.now()
  const key = `${options.name}:${clientKey(request)}`
  const current = buckets.get(key)
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current

  bucket.count += 1
  buckets.set(key, bucket)

  if (buckets.size > 5000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey)
    }
  }

  if (bucket.count > options.limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)),
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  return null
}

export function requestBodyTooLarge(request: Request, maxBytes = 32_768) {
  const contentLength = request.headers.get('content-length')
  return contentLength !== null && Number(contentLength) > maxBytes
}

export function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  return response
}

export function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  return origin === request.nextUrl.origin
}

export function badRequest(message = 'Invalid request.') {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function methodNotAllowed(allow: string) {
  return NextResponse.json(
    { error: 'Method not allowed.' },
    { status: 405, headers: { Allow: allow } },
  )
}

export function tooLarge() {
  return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
}
