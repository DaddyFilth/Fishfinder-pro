import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export { isHttpUrl, isImageDataUrl } from './urls'

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: Request) {
  // Prefer platform-set identity headers. Never use the first arbitrary
  // X-Forwarded-For value as the primary rate-limit identity.
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (vercelForwarded) return vercelForwarded
  if (realIp) return realIp
  if (process.env.NODE_ENV === 'production') return 'unknown'

  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
  return forwarded || 'unknown'
}

export function enforceRateLimit(
  request: Request,
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
    for (const bucketKey of buckets.keys()) {
      if (buckets.size <= 5000) break
      buckets.delete(bucketKey)
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
  const length = contentLength === null ? 0 : Number(contentLength)
  return contentLength !== null && (!Number.isFinite(length) || length > maxBytes)
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse }

export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<JsonBodyResult> {
  if (requestBodyTooLarge(request, maxBytes)) {
    return { ok: false, response: tooLarge() }
  }

  if (!request.body) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let totalBytes = 0
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      return { ok: false, response: tooLarge() }
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()

  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }),
    }
  }
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
  if (origin) {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
    try {
      return new URL(origin).origin === request.nextUrl.origin
    } catch {
      return false
    }
  }

  return request.headers.get('sec-fetch-site') === 'same-origin'
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
