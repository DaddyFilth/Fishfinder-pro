import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseProjectUrl, getSupabasePublishableKey } from './lib/supabase/config';

const CANONICAL_HOST = 'www.fishfinder-pro.online';
const APEX_HOST = 'fishfinder-pro.online';

const PUBLIC_PATHS = [
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/auth/login',
  '/auth/reset',
  '/auth/callback',
  '/api/auth',
  '/api/auth/recover',
  '/offline',
  '/manifest.json',
  '/sw.js',
];

export function isPublicPath(pathname: string) {
  const isPublicSpotRead =
    pathname === '/api/spots' ||
    /^\/api\/spots\/[^/]+\/conditions$/.test(pathname);

  // The species guide lives on the public landing route and falls back to this
  // endpoint when a catalog image fails, so anonymous visitors need it too.
  const isPublicSpeciesImage = pathname.startsWith('/api/species-image/');

  return (
    PUBLIC_PATHS.includes(pathname) ||
    isPublicSpotRead ||
    isPublicSpeciesImage ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}

function createNonce() {
  return crypto.randomUUID().replace(/-/g, '');
}

function applySecurityHeaders(response: NextResponse, protocol: string, nonce: string) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('Content-Security-Policy', [
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
  ].join('; '));

  if (protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const requestWithNonce = new NextRequest(request, { headers: requestHeaders });
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = forwardedHost ?? request.headers.get('host')?.split(',')[0].trim();

  if (host === CANONICAL_HOST || host === APEX_HOST) {
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();

    if (host === APEX_HOST || forwardedProtocol === 'http') {
      const url = request.nextUrl.clone();
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return applySecurityHeaders(NextResponse.redirect(url, 308), request.nextUrl.protocol, nonce);
    }
  }

  if (isPublicPath(request.nextUrl.pathname)) {
    return applySecurityHeaders(NextResponse.next({ request: requestWithNonce }), request.nextUrl.protocol, nonce);
  }

  const url = getSupabaseProjectUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Authentication is unavailable because Supabase is not configured.' },
      { status: 503 },
    ), request.nextUrl.protocol, nonce);
  }

  const response = applySecurityHeaders(await updateSession(requestWithNonce), request.nextUrl.protocol, nonce);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return requestWithNonce.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return response;
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    ), request.nextUrl.protocol, nonce);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  loginUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return applySecurityHeaders(NextResponse.redirect(loginUrl), request.nextUrl.protocol, nonce);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|\\.well-known/.*).*)',
};
