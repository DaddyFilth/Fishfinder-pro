import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/middleware';
import { getSupabaseProjectUrl, getSupabasePublishableKey } from './lib/supabase/config';
import { findSpotBySlug } from './lib/publicSeo';

const CANONICAL_HOST = 'www.fishfinder-pro.online';
const APEX_HOST = 'fishfinder-pro.online';

const PUBLIC_PATHS = [
  '/',
  '/fishing-spots',
  '/species',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/auth/login',
  '/auth/reset',
  '/auth/callback',
  '/api/auth',
  '/api/auth/recover',
  '/api/feed/cloudflare',
  '/api/health',
  '/api/ai',
  '/api/spots/public',
  '/api/errors',
  '/api/rum/vitals',
  '/offline',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/google9b802e8e87b013ca.html',
];

const GOOGLE_VERIFICATION_FILE_RE = /^\/google[0-9a-f]{10,64}\.html$/i;

export function resolveLegacyLocationRedirect(pathname: string): string | null {
  if (pathname === '/locations') {
    return '/fishing-spots';
  }
  if (pathname.startsWith('/locations/')) {
    const rawSlug = pathname.slice('/locations/'.length);
    if (!rawSlug || rawSlug.includes('/')) {
      return '/fishing-spots';
    }
    const spot = findSpotBySlug(rawSlug);
    return spot ? `/fishing-spots/${spot.slug}` : `/fishing-spots/${encodeURIComponent(rawSlug)}`;
  }
  return null;
}

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    GOOGLE_VERIFICATION_FILE_RE.test(pathname) ||
    pathname.startsWith('/api/ai/') ||
    pathname.startsWith('/fishing-spots/') ||
    pathname.startsWith('/species/') ||
    pathname.startsWith('/fish/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/')
  );
}

function createNonce() {
  return crypto.randomUUID().replace(/-/g, '');
}

function normalizeProxyUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://tile.openstreetmap.org https://server.arcgisonline.com https://basemap.nationalmap.gov https://tiles.openseamap.org https://cdnjs.cloudflare.com",
    "connect-src 'self' https://*.supabase.co https://api.weather.gov https://api.waterdata.usgs.gov https://marine-api.open-meteo.com https://api.tidesandcurrents.noaa.gov",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, protocol: string, contentSecurityPolicy: string) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);

  if (protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  // Next.js extracts the nonce from the *request* `Content-Security-Policy` header and stamps it
  // onto every framework script it renders. Setting it only on the response leaves the nonce
  // undefined, and because `script-src` carries a nonce source, `'strict-dynamic'` makes browsers
  // ignore `'self'` — so every script without a nonce is blocked. Both sides must be set.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  const requestWithNonce = new NextRequest(request, { headers: requestHeaders });
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = forwardedHost ?? request.headers.get('host')?.split(',')[0].trim();

  const legacyRedirectPath = resolveLegacyLocationRedirect(request.nextUrl.pathname);

  if (host === CANONICAL_HOST || host === APEX_HOST) {
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();

    if (host === APEX_HOST || forwardedProtocol === 'http') {
      const url = request.nextUrl.clone();
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      if (legacyRedirectPath) {
        url.pathname = legacyRedirectPath;
      }
      return applySecurityHeaders(
        NextResponse.redirect(url, 308),
        request.nextUrl.protocol,
        contentSecurityPolicy,
      );
    }
  }

  if (legacyRedirectPath) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = legacyRedirectPath;
    return applySecurityHeaders(
      NextResponse.redirect(targetUrl, 308),
      request.nextUrl.protocol,
      contentSecurityPolicy,
    );
  }

  if (isPublicPath(request.nextUrl.pathname)) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      request.nextUrl.protocol,
      contentSecurityPolicy,
    );
  }

  const url = getSupabaseProjectUrl() ?? normalizeProxyUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    getSupabasePublishableKey() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return applySecurityHeaders(
      NextResponse.json(
        { error: 'Authentication is unavailable because Supabase is not configured.' },
        { status: 503 },
      ),
      request.nextUrl.protocol,
      contentSecurityPolicy,
    );
  }

  const { response, user } = await updateSession(requestWithNonce);
  const secured = applySecurityHeaders(response, request.nextUrl.protocol, contentSecurityPolicy);

  if (user) {
    return secured;
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
      request.nextUrl.protocol,
      contentSecurityPolicy,
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return applySecurityHeaders(
    NextResponse.redirect(loginUrl),
    request.nextUrl.protocol,
    contentSecurityPolicy,
  );
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|apple-touch-icon\\.png|manifest\\.json|robots\\.txt|sitemap\\.xml|\\.well-known/.*).*)',
};
