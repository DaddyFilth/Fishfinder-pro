import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseProjectUrl, getSupabasePublishableKey } from '@/lib/supabase/config';

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

function isPublicPath(pathname: string) {
  const isPublicSpotRead =
    pathname === '/api/spots' ||
    /^\/api\/spots\/[^/]+\/conditions$/.test(pathname);

  return (
    PUBLIC_PATHS.includes(pathname) ||
    isPublicSpotRead ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}

export async function proxy(request: NextRequest) {
if (request.nextUrl.pathname === "/.well-known/assetlinks.json") {
  return NextResponse.next();
}
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = forwardedHost ?? request.headers.get('host')?.split(',')[0].trim();

  if (host === CANONICAL_HOST || host === APEX_HOST) {
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();

    if (host === APEX_HOST || forwardedProtocol === 'http') {
      const url = request.nextUrl.clone();
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return NextResponse.redirect(url, 308);
    }
  }

  const response = await updateSession(request);

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  if (isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  const url = getSupabaseProjectUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return NextResponse.json(
      { error: 'Authentication is unavailable because Supabase is not configured.' },
      { status: 503 },
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
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
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  loginUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|\\.well-known/.*).*)',
};
