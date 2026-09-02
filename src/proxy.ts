import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = 'fishfinder-pro.online';
const WWW_HOST = `www.${CANONICAL_HOST}`;

export function proxy(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = forwardedHost ?? request.headers.get('host')?.split(',')[0].trim();

  if (host !== CANONICAL_HOST && host !== WWW_HOST) {
    return NextResponse.next();
  }

  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (host === WWW_HOST || forwardedProtocol === 'http') {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};